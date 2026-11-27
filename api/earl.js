/* POST /api/earl : one turn of the Ask Earl chat.

   Request:  { "messages": [ { "role": "user" | "assistant", "content": "..." }, ... ] }
   Response: text/plain, streamed as Earl writes it. Errors are JSON: { "error": code, "message": text }.

   Privacy: this function stores nothing. It writes no question or answer to any log, file, or
   database. The conversation lives in the visitor's browser tab and is sent here with each turn,
   then forwarded to Anthropic's API to write the answer. The rate limiter keeps a salted hash of
   the caller's IP address in memory for up to a day and never writes it anywhere.

   Environment (Vercel > Project > Settings > Environment Variables):
     ANTHROPIC_API_KEY   required. Until it is set, the endpoint answers 503 and the page says the chat is offline.
     EARL_MODEL          optional. Defaults to claude-sonnet-5-5.
     EARL_NOW            optional, ignored in production. An ISO date used as "today" so a preview
                         can be tested as if a module had opened (for example 2027-02-03).
     EARL_TEST_TOKEN     optional, ignored in production. See testAccess() below. */
const crypto = require("crypto");
const { buildSystem } = require("./_earl/prompt.js");

const MODEL_DEFAULT = "claude-sonnet-5-5";
const MAX_OUTPUT_TOKENS = 600;
const MAX_QUESTION_CHARS = 600;
const MAX_TURN_CHARS = 2400;
const MAX_TURNS = 8;          /* the latest question plus up to seven earlier turns */

/* Per-visitor limits, then a ceiling for everyone combined. Counts live in this server
   instance's memory, so they are a first line, not a guarantee: the firewall rule and the
   spending cap described in the status file are the durable limits. */
const LIMITS = [
  { windowMs: 60 * 1000, max: 6 },
  { windowMs: 60 * 60 * 1000, max: 30 },
  { windowMs: 24 * 60 * 60 * 1000, max: 60 }
];
const GLOBAL_LIMIT = { windowMs: 60 * 60 * 1000, max: 600 };
const SALT = crypto.randomBytes(16);
const hits = new Map();
let globalHits = [];

function clientKey(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = fwd || (req.socket && req.socket.remoteAddress) || "unknown";
  return crypto.createHmac("sha256", SALT).update(ip).digest("base64").slice(0, 22);
}

/* Returns 0 if allowed, or the number of seconds to wait. */
function rateLimit(key, now) {
  const longest = LIMITS[LIMITS.length - 1].windowMs;
  globalHits = globalHits.filter((t) => now - t < GLOBAL_LIMIT.windowMs);
  if (globalHits.length >= GLOBAL_LIMIT.max) return Math.ceil((GLOBAL_LIMIT.windowMs - (now - globalHits[0])) / 1000);
  const mine = (hits.get(key) || []).filter((t) => now - t < longest);
  for (const { windowMs, max } of LIMITS) {
    const inWindow = mine.filter((t) => now - t < windowMs);
    if (inWindow.length >= max) { hits.set(key, mine); return Math.ceil((windowMs - (now - inWindow[0])) / 1000); }
  }
  mine.push(now); hits.set(key, mine); globalHits.push(now);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > longest) hits.delete(k);
  return 0;
}

function allowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; /* same-origin requests from some browsers, and server-side tests */
  let host;
  try { host = new URL(origin).host; } catch (e) { return false; }
  if (host === req.headers.host) return true;
  return host === "getruralamericadone.com" || host === "www.getruralamericadone.com";
}

function send(res, status, error, message, extra) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (extra) for (const k in extra) res.setHeader(k, extra[k]);
  res.end(JSON.stringify({ error, message }));
}

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > 64 * 1024) throw new Error("too large"); }
  return JSON.parse(raw || "{}");
}

/* Keeps only well-formed recent turns, ending on the visitor's question. */
function cleanMessages(input) {
  if (!Array.isArray(input) || !input.length) return null;
  const turns = [];
  for (const m of input.slice(-MAX_TURNS)) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return null;
    const text = m.content.replace(/\u0000/g, "").trim();
    if (!text) return null;
    turns.push({ role: m.role, content: text.slice(0, MAX_TURN_CHARS) });
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  const merged = [];
  for (const t of turns) {
    if (merged.length && merged[merged.length - 1].role === t.role) merged[merged.length - 1] = t;
    else merged.push(t);
  }
  if (!merged.length || merged[merged.length - 1].role !== "user") return null;
  if (merged[merged.length - 1].content.length > MAX_QUESTION_CHARS) return "long";
  return merged;
}

function nowFor(req) {
  if (process.env.VERCEL_ENV !== "production" && process.env.EARL_NOW) {
    const d = new Date(process.env.EARL_NOW + "T18:00:00Z");
    if (!isNaN(d)) return d;
  }
  return new Date();
}

/* Test hook, never active in production. With EARL_TEST_TOKEN set on a preview, a request that
   carries the token skips the rate limit, and GET /api/earl?t=<token>&q=<question>&now=<date>
   returns one whole answer, so the test set in api/_earl/tests.json can be run against a preview. */
function testAccess(req) {
  const token = process.env.EARL_TEST_TOKEN;
  if (process.env.VERCEL_ENV === "production" || !token || token.length < 24) return null;
  const url = new URL(req.url, "http://local");
  const given = String(req.headers["x-earl-test"] || url.searchParams.get("t") || "");
  const a = Buffer.from(given), b = Buffer.from(token);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return url.searchParams;
}

async function handler(req, res) {
  res.setHeader("X-Robots-Tag", "noindex");
  const test = testAccess(req);
  if (req.method === "GET" && !(test && test.get("q"))) {
    /* Health check for the page: says whether the chat is switched on, and nothing else. */
    const on = Boolean(process.env.ANTHROPIC_API_KEY);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify({ on }));
  }
  const viaGet = req.method === "GET";
  if (!viaGet) {
    if (req.method !== "POST") return send(res, 405, "method", "Use POST.", { Allow: "GET, POST" });
    if (!allowedOrigin(req)) return send(res, 403, "origin", "This chat only runs on getruralamericadone.com.");
    if (!String(req.headers["content-type"] || "").includes("application/json")) return send(res, 415, "type", "Send JSON.");
  }
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 503, "offline", "Earl's chat isn't switched on yet.");

  const wait = test ? 0 : rateLimit(clientKey(req), Date.now());
  if (wait) {
    return send(res, 429, "slow_down",
      "That's a lot of questions in a short stretch. Give me " + (wait > 90 ? Math.ceil(wait / 60) + " minutes" : wait + " seconds") + " and ask again.",
      { "Retry-After": String(wait) });
  }

  let body;
  try {
    if (viaGet) {
      let earlier = [];
      try { earlier = JSON.parse(test.get("h") || "[]"); } catch (e) {}
      body = { messages: earlier.concat([{ role: "user", content: test.get("q") }]) };
    } else body = await readBody(req);
  } catch (e) { return send(res, 400, "bad_request", "I couldn't read that."); }
  const messages = cleanMessages(body && body.messages);
  if (messages === "long") return send(res, 413, "too_long", "That one's a bit long for me. Can you ask it in " + MAX_QUESTION_CHARS + " characters or fewer?");
  if (!messages) return send(res, 400, "bad_request", "I couldn't read that.");

  const asOf = test && test.get("now") ? new Date(test.get("now") + "T18:00:00Z") : null;
  const system = buildSystem(asOf && !isNaN(asOf) ? asOf : nowFor(req));
  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.EARL_MODEL || MODEL_DEFAULT,
        max_tokens: MAX_OUTPUT_TOKENS,
        stream: true,
        system: [
          { type: "text", text: system.stable, cache_control: { type: "ephemeral" } },
          { type: "text", text: system.dated }
        ],
        messages
      })
    });
  } catch (e) {
    console.error("earl: upstream unreachable");
    return send(res, 502, "upstream", "I can't reach my library right now. Try again in a minute.");
  }
  if (!upstream.ok || !upstream.body) {
    /* Log the status and error type only. Never the question. */
    let type = "";
    try { type = ((await upstream.json()).error || {}).type || ""; } catch (e) {}
    console.error("earl: upstream status " + upstream.status + " " + type);
    if (upstream.status === 429 || upstream.status === 529) return send(res, 503, "busy", "I've got a line of folks ahead of you. Try again in a minute.");
    return send(res, 502, "upstream", "I can't reach my library right now. Try again in a minute.");
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-transform");
  res.setHeader("X-Accel-Buffering", "no");

  /* Turn the API's event stream into plain text for the page. */
  const decoder = new TextDecoder();
  let buffer = "", wrote = false;
  try {
    for await (const chunk of upstream.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        let ev;
        try { ev = JSON.parse(line.slice(5)); } catch (e) { continue; }
        if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta" && ev.delta.text) {
          res.write(ev.delta.text); wrote = true;
        } else if (ev.type === "error") {
          console.error("earl: stream error " + ((ev.error || {}).type || ""));
          if (test) res.write("\n[test: stream error " + ((ev.error || {}).type || "") + "]");
        } else if (test && ev.type === "message_delta" && ev.delta && ev.delta.stop_reason && ev.delta.stop_reason !== "end_turn") {
          res.write("\n[test: stop " + ev.delta.stop_reason + "]");
        }
      }
    }
  } catch (e) {
    console.error("earl: stream interrupted");
    if (test) res.write("\n[test: stream interrupted " + (e && e.name) + "]");
  }
  if (!wrote) res.write("I lost my place there. Ask me again?");
  res.end();
}

module.exports = handler;
module.exports.config = { maxDuration: 30 };
module.exports._test = { rateLimit, cleanMessages, allowedOrigin, LIMITS, hits };
