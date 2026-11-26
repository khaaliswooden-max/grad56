/* County Kit checklists: count the terms the draft already covers. Nothing is saved or sent. */
(() => {
  document.querySelectorAll("[data-checklist]").forEach(list => {
    const boxes = [...list.querySelectorAll('input[type="checkbox"]')];
    const done = document.querySelector("[data-tally-done]");
    const gap = document.querySelector("[data-tally-gap]");
    const update = () => {
      const n = boxes.filter(b => b.checked).length;
      const left = boxes.length - n;
      if (done) done.textContent = `${n} of ${boxes.length} terms`;
      if (gap) gap.textContent = left === 0 ? "Every term is covered. Ask for it in writing anyway." : `${left} still to ask for in writing.`;
    };
    boxes.forEach(b => b.addEventListener("change", update));
    update();
  });
  document.querySelectorAll("[data-print]").forEach(btn => btn.addEventListener("click", () => window.print()));
  document.querySelectorAll("[data-clear]").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll('[data-checklist] input[type="checkbox"]').forEach(b => { b.checked = false; b.dispatchEvent(new Event("change")); });
  }));
})();
