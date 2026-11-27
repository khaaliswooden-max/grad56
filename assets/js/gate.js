/* Holds a Field Guide module closed until its opening day (first Tuesday of its month, Central time).
   Shared by every module page, self-check, and kit from Module 2 on; reads the module number from <main data-module>.
   The date comes from the calendar in /assets/js/config.js, the same one /field-guide uses.
   Reviewers: add ?preview=1 to any page of the module to read it before it opens. */
import { MODULES } from "/assets/js/config.js";

const root = document.documentElement;
const main = document.querySelector("main[data-module]");
const m = main && MODULES.find(x => x.n === Number(main.dataset.module));
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const preview = new URLSearchParams(location.search).has("preview");

if (m && today < m.opens && !preview) {
  const when = new Date(m.opens + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  main.innerHTML = `
  <section class="guide-hero" style="padding-bottom:clamp(64px,9vw,120px)">
    <div class="wrap">
      <span class="eyebrow"><a href="/field-guide">Field Guide</a> &middot; Module ${m.n} of 12</span>
      <h1 class="headline">${esc(m.title)}</h1>
      <p class="lede">This module opens ${when}.</p>
      <p class="body"><b>The decision it serves:</b> ${esc(m.decision)}.</p>
      <p class="body" style="margin-top:16px">Create a free account and we&rsquo;ll send one short note when it opens. Every module stays free to read without one.</p>
      <div class="btns" style="margin-top:24px;display:flex;flex-wrap:wrap;gap:12px">
        <a class="btn btn--solid btn--lg" href="/sign-in"><span>Get a note when it opens</span><span>Get a note when it opens</span></a>
        <a class="btn btn--ghost btn--lg" href="/field-guide"><span>See the open modules</span><span>See the open modules</span></a>
      </div>
    </div>
  </section>`;
  document.title = `Module ${m.n}: ${m.title} (opens ${when}) | Grid & Grain Field Guide`;
  document.querySelectorAll(".nav__cta .btn").forEach(b => b.remove());
} else if (m && preview) {
  /* Keep reviewers inside the preview as they move between the module, its self-check, and its kit. */
  const base = `/field-guide/${m.slug}`;
  document.querySelectorAll(`a[href^="${base}"]`).forEach(a => {
    const [path, hash] = a.getAttribute("href").split("#");
    if (!path.includes("?")) a.setAttribute("href", path + "?preview=1" + (hash ? "#" + hash : ""));
  });
}
root.classList.remove("gate-pending");
