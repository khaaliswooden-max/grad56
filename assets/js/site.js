(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Nav: border on scroll, mobile toggle */
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  const toggle = document.querySelector(".nav__toggle");
  toggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  document.querySelectorAll(".nav__links a").forEach(a =>
    a.addEventListener("click", () => { nav.classList.remove("is-open"); toggle?.setAttribute("aria-expanded", "false"); })
  );

  /* Marquee: duplicate track for a seamless loop */
  document.querySelectorAll("[data-marquee]").forEach(track => {
    track.innerHTML += track.innerHTML;
    track.querySelectorAll(".marquee__item").forEach((el, i, all) => { if (i >= all.length / 2) el.setAttribute("aria-hidden", "true"); });
  });

  /* Seeded RNG so the 56 stars land in the same place every visit */
  const rng = seed => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  /* Starfield: exactly 56 stars */
  document.querySelectorAll("canvas[data-stars]").forEach((cv, ci) => {
    const n = +cv.dataset.stars || 56;
    const ctx = cv.getContext("2d");
    const r = rng(5600 + ci * 97);
    const stars = Array.from({ length: n }, () => ({ x: r(), y: Math.pow(r(), 1.3), s: 0.5 + r() * 1.1, p: r() * Math.PI * 2, k: 0.4 + r() * 0.8 }));
    let w, h, dpr;
    const size = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = t => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const a = reduce ? 0.55 : 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t / 1000 * s.k + s.p));
        ctx.fillStyle = `rgba(246,244,239,${a * (1 - s.y * 0.6)})`;
        ctx.beginPath(); ctx.arc(s.x * w, s.y * h * 0.95 + 6, s.s, 0, Math.PI * 2); ctx.fill();
      }
    };
    size(); draw(0);
    window.addEventListener("resize", () => { size(); draw(performance.now()); });
    if (!reduce) {
      let visible = true;
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(cv);
      const loop = t => { if (visible) draw(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  });

  /* Field: furrows converging on a vanishing point (crop rows / stripes) */
  const NS = "http://www.w3.org/2000/svg";
  document.querySelectorAll("svg[data-field]").forEach(svg => {
    const W = 1600, H = 500, vx = W * 0.5, vy = -40;
    const g = document.createElementNS(NS, "g");
    // horizon band
    const hz = document.createElementNS(NS, "rect");
    hz.setAttribute("x", 0); hz.setAttribute("y", 0); hz.setAttribute("width", W); hz.setAttribute("height", 2);
    hz.setAttribute("fill", "rgba(210,82,79,.35)");
    g.appendChild(hz);
    const rows = 44;
    for (let i = 0; i <= rows; i++) {
      const bx = -W * 0.9 + (W * 2.8) * (i / rows);
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", vx); line.setAttribute("y1", vy);
      line.setAttribute("x2", bx); line.setAttribute("y2", H);
      const center = 1 - Math.abs(i / rows - 0.5) * 2;
      line.setAttribute("stroke", `rgba(246,244,239,${0.05 + center * 0.14})`);
      line.setAttribute("stroke-width", 1.2);
      line.setAttribute("vector-effect", "non-scaling-stroke");
      g.appendChild(line);
    }
    // cross furrows, spaced in perspective
    for (let j = 1; j < 14; j++) {
      const y = H * Math.pow(j / 14, 2.2);
      const l = document.createElementNS(NS, "line");
      l.setAttribute("x1", 0); l.setAttribute("x2", W); l.setAttribute("y1", y); l.setAttribute("y2", y);
      l.setAttribute("stroke", `rgba(246,244,239,${0.03 + (j / 14) * 0.07})`);
      l.setAttribute("vector-effect", "non-scaling-stroke");
      g.appendChild(l);
    }
    svg.appendChild(g);
  });

  /* Accordion synced to the stage panel */
  document.querySelectorAll("[data-acc]").forEach(acc => {
    const items = [...acc.querySelectorAll(".acc__item")];
    const views = [...document.querySelectorAll(".stage__view")];
    let current = 0, timer;
    const open = i => {
      current = i;
      items.forEach((it, j) => {
        it.classList.toggle("is-open", j === i);
        it.querySelector(".acc__btn").setAttribute("aria-expanded", String(j === i));
      });
      views.forEach((v, j) => v.classList.toggle("is-active", j === i));
    };
    const cycle = () => { clearInterval(timer); if (!reduce) timer = setInterval(() => open((current + 1) % items.length), 7000); };
    items.forEach((it, i) => it.querySelector(".acc__btn").addEventListener("click", () => { open(i); cycle(); }));
    cycle();
  });

  /* Grid & Grain newsletter signup.
     Set SUBSTACK to the publication's address once it exists, e.g. "https://gridandgrain.substack.com".
     Until then the form opens an email to ruralamerica56@gmail.com with the subscriber's address. */
  const SUBSTACK = "";
  document.querySelectorAll("form[data-subscribe]").forEach(form => {
    form.addEventListener("submit", e => {
      e.preventDefault();
      const email = form.querySelector('input[type="email"]').value.trim();
      if (!email) return;
      if (SUBSTACK) {
        window.location.href = `${SUBSTACK.replace(/\/$/, "")}/subscribe?email=${encodeURIComponent(email)}`;
      } else {
        const body = `Please add ${email} to Grid & Grain.`;
        window.location.href = `mailto:ruralamerica56@gmail.com?subject=${encodeURIComponent("Add me to Grid & Grain")}&body=${encodeURIComponent(body)}`;
      }
    });
  });

  /* Reveal on scroll */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  document.querySelectorAll(".reveal").forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
    io.observe(el);
  });
})();
