/* Straight Talk and County Kit pages.
   1. Kit checklists: count the terms a draft already covers. Nothing is saved or sent.
   2. Links to a Field Guide module and its kit switch on when the module opens
      (same rule as /field-guide: its date has passed and it is in PUBLISHED). */

document.querySelectorAll("[data-checklist]").forEach(list => {
  const boxes = [...list.querySelectorAll('input[type="checkbox"]')];
  const done = document.querySelector("[data-tally-done]");
  const gap = document.querySelector("[data-tally-gap]");
  const update = () => {
    const n = boxes.filter(b => b.checked).length;
    const left = boxes.length - n;
    if (done) done.textContent = `Covers ${n} of ${boxes.length}`;
    if (gap) gap.textContent = left === 0
      ? "Every term is covered. Ask for it in writing anyway."
      : `${left} still to ask for in writing.`;
  };
  boxes.forEach(b => b.addEventListener("change", update));
  list.closest("form")?.addEventListener("reset", () => setTimeout(update));
  update();
});
document.querySelectorAll("[data-print]").forEach(btn => btn.addEventListener("click", () => window.print()));

/* Kits that have their own page under /kits; every other kit lives with its module. */
const OWN_PAGE = { 2: "/kits/large-load-tariff" };

try {
  const { MODULES, PUBLISHED } = await import("/assets/js/config.js");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const isOpen = m => today >= m.opens && PUBLISHED.includes(m.n);
  const byN = new Map(MODULES.map(m => [String(m.n), m]));
  const note = (a, text) => { const s = a.querySelector("small"); if (s) s.textContent = text; };

  document.querySelectorAll("[data-module-link]").forEach(a => {
    const m = byN.get(a.dataset.moduleLink);
    if (m && isOpen(m)) { a.href = `/field-guide/${m.slug}`; note(a, "Open now"); }
  });
  document.querySelectorAll("[data-kit-link]").forEach(a => {
    const m = byN.get(a.dataset.kitLink);
    if (m && isOpen(m)) { a.href = OWN_PAGE[m.n] || `/field-guide/${m.slug}/kit`; note(a, "Open now"); }
  });

  /* /kits index: turn a kit's title into a link once its module is open. */
  document.querySelectorAll("[data-kit]").forEach(row => {
    const m = byN.get(row.dataset.kit);
    const title = row.querySelector("span.kitlist__t");
    const status = row.querySelector(".kitlist__s");
    if (!m || !title || !isOpen(m)) return;
    const a = document.createElement("a");
    a.className = "kitlist__t";
    a.href = OWN_PAGE[m.n] || `/field-guide/${m.slug}/kit`;
    a.textContent = title.textContent;
    title.replaceWith(a);
    if (status) { status.textContent = "Open now"; status.classList.add("kitlist__s--open"); }
  });
} catch (e) { /* Without the calendar, the page keeps its plain links. */ }

try {
  const { markNav } = await import("/assets/js/members.js");
  await markNav();
} catch (e) { /* Accounts are optional; the nav keeps "Sign in". */ }
