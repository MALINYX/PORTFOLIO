/* CLX-CT-01 · sheet 08 — page enhancements (static-first: every resting state is complete without this file).
   1. Build-the-blockout instrument: current step highlight, step list, live taper morph 180 → 150 mm
      (axonometric re-projected from the same mm geometry the drawings were generated from), step tag.
   2. Evidence meters: cells stamp in once (a live count of what is being drawn, D14).
   3. Traceability connectors draw once on entry. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const motionOK = () => root.classList.contains('motion-ok');
  const easeDraft = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const io = (els, cb, opt) => {
    if (!('IntersectionObserver' in window)) { els.forEach(cb); return; }
    const o = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { cb(e.target); o.unobserve(e.target); } }), opt);
    els.forEach(el => o.observe(el));
  };

  /* ---------- 1. instrument ---------- */
  const inst = $('.clx-inst');
  if (inst) {
    const H = 480, D0 = 180, D1 = 150;
    const T = 57 * Math.PI / 180, F = 24 * Math.PI / 180;
    const ct = Math.cos(T), st = Math.sin(T), cp = Math.cos(F), sp = Math.sin(F);
    const P = (x, y, z) => [x * ct + y * st, x * st * sp - y * ct * sp - z * cp];
    const n1 = (v) => (Math.round(v * 10) / 10).toString();
    const v3 = $$('[data-v3]', inst).map(el => ({
      el, open: el.classList.contains('ax-hid') || el.classList.contains('ax-edge'),
      loops: el.dataset.v3.split('|').map(l => l.split(';').map(v => v.split(',')))
    }));
    const env = $('[data-side="env"]', inst), dtopLine = $('[data-side="dtop"]', inst), dLab = $('[data-live="dtop"]', inst);
    const setDepth = (dt, final) => {
      const dep = (z) => D0 - (D0 - dt) * z / H;
      v3.forEach(({ el, open, loops }) => {
        el.setAttribute('d', loops.map(lp => 'M' + lp.map(([x, y, z]) => {
          const zz = +z, p = P(+x, y === 'F' ? dep(zz) : +y, zz); return n1(p[0]) + ' ' + n1(p[1]);
        }).join(' L') + (open ? '' : ' Z')).join(' '));
      });
      if (env) env.setAttribute('d', `M0 0 L${D0} 0 L${n1(dt)} -${H} L0 -${H} Z`);
      if (dtopLine) dtopLine.setAttribute('d', `M0 -502 H${n1(dt)} M0 -508 V-496 M${n1(dt)} -508 V-496`);
      if (dLab) dLab.textContent = final ? String(Math.round(dt)) : dt.toFixed(1);
    };
    let raf = 0;
    const morph = () => {
      cancelAnimationFrame(raf);
      if (!motionOK()) { setDepth(D1, true); return; }
      const t0 = performance.now(), dur = 900;
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        setDepth(D0 + (D1 - D0) * easeDraft(p), p >= 1);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      setDepth(D0, false);
      raf = requestAnimationFrame(tick);
    };

    const groups = $$('.st[data-a]', inst);
    const lis = $$('.steps li', inst);
    const btns = $$('[data-step]', inst);
    const sid = $('[data-live="sid"]', inst), sname = $('[data-live="sname"]', inst);
    let states = [];
    try { states = JSON.parse($('script[type="application/json"]', inst).textContent); } catch (e) {}
    let prev = null;
    const apply = (i, user) => {
      lis.forEach((li, j) => { if (j === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
      if (user && prev !== null && i > prev) groups.forEach(g => { g.classList.toggle('cur', +g.dataset.a === i); });
      else groups.forEach(g => g.classList.remove('cur'));
      const s = states[i];
      if (s && sid) sid.textContent = s.id;
      if (s && sname) sname.textContent = s.name || '';
      if (i === 1 && user) morph(); else if (prev === null || i !== 1) { cancelAnimationFrame(raf); setDepth(D1, true); }
      prev = i;
    };
    inst.addEventListener('instrument:change', (e) => apply(e.detail.index, e.detail.user));
    lis.forEach((li, j) => li.addEventListener('click', () => btns[j] && btns[j].click()));
    const start = states.findIndex(s => s.id === inst.dataset.state);
    apply(start >= 0 ? start : 9, false);
  }

  /* ---------- 2. evidence meters ---------- */
  if (motionOK()) {
    const meters = $$('.ev-meter');
    meters.forEach(m => m.classList.add('armed'));
    io(meters, (m) => requestAnimationFrame(() => m.classList.add('is-in')), { threshold: .6 });
    document.addEventListener('reality:change', () => meters.forEach(m => { if (m.offsetParent !== null) { m.classList.remove('is-in'); void m.offsetWidth; m.classList.add('is-in'); } }));
  }

  /* ---------- 3. traceability connectors ---------- */
  const trace = $('.trace');
  if (trace && motionOK()) {
    trace.classList.add('armed');
    io([trace], (t) => t.classList.add('is-in'), { threshold: .3 });
  }
})();
