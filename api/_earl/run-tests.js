#!/usr/bin/env node
/* Runs Earl's test set and prints every answer with its automatic checks.

   Against a Vercel preview that has ANTHROPIC_API_KEY and EARL_TEST_TOKEN set:
       node api/_earl/run-tests.js https://<preview-host> <token>
   On a machine that has the key in its environment (nothing is deployed or stored):
       ANTHROPIC_API_KEY=... node api/_earl/run-tests.js
   Options: --only=U01,V03   --json=results.json

   The checks are coarse on purpose. A PASS still needs a person to read the answer against
   the "expect" line; a FAIL is always worth reading. */
const fs = require("fs");
const path = require("path");
const set = require("./tests.json");
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
const [base, token] = args.filter((a) => !a.startsWith("--"));
const only = flags.only ? flags.only.split(",") : null;

async function askRemote(t) {
  const u = new URL("/api/earl", base);
  u.searchParams.set("t", token); u.searchParams.set("q", t.q); u.searchParams.set("now", t.now || set.defaultNow);
  if (t.history) u.searchParams.set("h", JSON.stringify(t.history));
  const r = await fetch(u);
  return { status: r.status, text: await r.text() };
}
async function askLocal(t) {
  process.env.EARL_TEST_TOKEN = "local-test-token-0123456789abcdef";
  const handler = require("../earl.js");
  const q = new URLSearchParams({ t: process.env.EARL_TEST_TOKEN, q: t.q, now: t.now || set.defaultNow });
  if (t.history) q.set("h", JSON.stringify(t.history));
  let text = "", status = 200;
  const res = { setHeader() {}, write(s) { text += s; }, end(s) { if (s) text += s; },
    set statusCode(v) { status = v; }, get statusCode() { return status; } };
  await handler({ method: "GET", url: "/api/earl?" + q, headers: {} }, res);
  return { status, text };
}

(async () => {
  if (!base && !process.env.ANTHROPIC_API_KEY) { console.error("Give a preview URL and token, or set ANTHROPIC_API_KEY. See the top of this file."); process.exit(2); }
  const results = [];
  for (const t of set.tests) {
    if (only && !only.includes(t.id)) continue;
    const { status, text } = await (base ? askRemote(t) : askLocal(t));
    const fails = [];
    if (status !== 200) fails.push("HTTP " + status);
    for (const p of t.must || []) if (!new RegExp(p, "i").test(text)) fails.push("missing /" + p + "/");
    for (const p of t.mustNot || []) if (new RegExp(p, "i").test(text)) fails.push("contains /" + p + "/");
    if (/[*#`]|^\s*[-•] /m.test(text)) fails.push("markdown in answer");
    const words = text.trim().split(/\s+/).length;
    if (words > 270) fails.push("too long (" + words + " words)");
    results.push({ id: t.id, cat: t.cat, q: t.q, now: t.now || set.defaultNow, expect: t.expect, answer: text.trim(), words, auto: fails.length ? "FAIL" : "PASS", fails });
    console.log("\n[" + t.id + " " + t.cat + "] " + (fails.length ? "FAIL: " + fails.join("; ") : "PASS") + "\nQ: " + t.q + "\nA: " + text.trim() + "\nExpect: " + t.expect);
  }
  const failed = results.filter((r) => r.auto === "FAIL");
  console.log("\n" + results.length + " questions, " + (results.length - failed.length) + " passed the automatic checks, " + failed.length + " failed" + (failed.length ? ": " + failed.map((r) => r.id).join(", ") : "") + ".");
  if (flags.json) fs.writeFileSync(path.resolve(flags.json), JSON.stringify(results, null, 1));
  process.exit(failed.length ? 1 : 0);
})();
