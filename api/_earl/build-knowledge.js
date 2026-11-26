#!/usr/bin/env node
/* Rebuilds api/_earl/knowledge.json from the public pages, so Earl answers only from
   what the site itself publishes: the Straight Talk library and the Field Guide modules.

   Run from the repository root after any Straight Talk entry or module page changes:
       node api/_earl/build-knowledge.js

   Every module page is read, including ones that have not opened. Each carries its
   opening date from assets/js/config.js, and api/earl.js leaves a module out of Earl's
   knowledge until that date has passed (Central time). Nothing here needs editing by hand. */
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..", "..");
const SITE = "https://getruralamericadone.com";

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", times: "×", rarr: "→", larr: "←", hellip: "…", deg: "°",
  sup2: "²", frac12: "½", minus: "−", approx: "≈", le: "≤", ge: "≥", copy: "©", plusmn: "±", micro: "µ" };
function decode(s) {
  return s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z0-9]+);/gi, (m, n) => (n in NAMED ? NAMED[n] : m));
}
function toText(html) {
  let s = html;
  const m = s.match(/<main[^>]*>([\s\S]*)<\/main>/i);
  if (m) s = m[1];
  s = s.replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|svg|form|audio|video|nav)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<span class="tag[^"]*">\s*([A-Z]+)\s*<\/span>/g, " [$1] ")
    .replace(/<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 <$1>")
    .replace(/<h([1-4])[^>]*>/gi, (_, n) => "\n\n" + "#".repeat(Number(n)) + " ")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<(td|th)[^>]*>/gi, " | ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|section|article|ul|ol|tr|table|blockquote|details|summary|figure|figcaption|aside|header|footer)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  s = decode(s).replace(/[ \t\r\f\v]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n")
    .replace(/\n- \n+/g, "\n- ").replace(/ +([.,;:])/g, "$1");
  return s.trim();
}
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }

/* The module calendar, read as text because config.js is an ES module for the browser. */
const cfg = read("assets/js/config.js");
const modules = [...cfg.matchAll(/\{\s*n:\s*(\d+),\s*slug:\s*"([^"]+)",\s*title:\s*"([^"]+)",\s*opens:\s*"(\d{4}-\d{2}-\d{2})"/g)]
  .map((m) => ({ n: Number(m[1]), slug: m[2], title: m[3], opens: m[4] }));
if (modules.length !== 12) throw new Error("Expected 12 modules in assets/js/config.js, found " + modules.length);

const docs = [];

/* Straight Talk: always open. Everything after the "related" links is navigation. */
const stDir = path.join(root, "straight-talk");
if (fs.existsSync(stDir)) {
  for (const f of fs.readdirSync(stDir).filter((x) => x.endsWith(".html")).sort()) {
    const html = read("straight-talk/" + f).split('<div class="related">')[0] + "</main>";
    const text = toText(html);
    const num = (text.match(/#(\d+)/) || [])[1];
    const claim = (text.match(/^# (.+)$/m) || [])[1] || f;
    docs.push({ id: "straight-talk-" + f.replace(".html", ""), kind: "Straight Talk", n: num ? Number(num) : null,
      title: "Straight Talk #" + num + ": " + claim, url: SITE + "/straight-talk/" + f.replace(".html", ""), opens: null, text });
  }
}
docs.sort((a, b) => (a.n || 0) - (b.n || 0));

/* Field Guide modules: each gated by its opening date. */
for (const mod of modules) {
  const rel = "field-guide/" + mod.slug + ".html";
  if (!fs.existsSync(path.join(root, rel))) continue;
  docs.push({ id: "module-" + String(mod.n).padStart(2, "0"), kind: "Field Guide", n: mod.n,
    title: "Field Guide Module " + mod.n + ": " + mod.title, url: SITE + "/field-guide/" + mod.slug,
    opens: mod.opens, text: toText(read(rel)) });
  const kit = "field-guide/" + mod.slug + "/kit.html";
  if (fs.existsSync(path.join(root, kit))) {
    docs.push({ id: "kit-" + String(mod.n).padStart(2, "0"), kind: "County Kit", n: mod.n,
      title: "County Kit for Module " + mod.n, url: SITE + "/field-guide/" + mod.slug + "/kit",
      opens: mod.opens, text: toText(read(kit)) });
  }
}
/* County Kits published under /kits. Listed here by slug and module number; they are open as soon as their page is public. */
const KITS = { "large-load-tariff": 2 };
for (const [slug, n] of Object.entries(KITS)) {
  const rel = "kits/" + slug + ".html";
  if (!fs.existsSync(path.join(root, rel))) continue;
  docs.push({ id: "kit-" + slug, kind: "County Kit", n, title: "County Kit: " + slug.replace(/-/g, " "),
    url: SITE + "/kits/" + slug, opens: null, text: toText(read(rel)) });
}

const out = { built: new Date().toISOString().slice(0, 10), calendar: modules, docs };
fs.writeFileSync(path.join(__dirname, "knowledge.json"), JSON.stringify(out, null, 1) + "\n");
const words = (t) => t.split(/\s+/).length;
console.log("Wrote api/_earl/knowledge.json");
for (const d of docs) console.log("  " + (d.opens || "always    ") + "  " + String(words(d.text)).padStart(5) + " words  " + d.id);
console.log("  total " + docs.reduce((a, d) => a + words(d.text), 0) + " words");
