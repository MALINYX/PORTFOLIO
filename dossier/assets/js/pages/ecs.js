/* MALINYX — ECS sheet · assets/js/pages/ecs.js · Rev A 2026-10-02
   §03 lean scrubber (reader-driven; no autoplay) · §04 assembly in the documented 9-step order
   (scroll-linked, reversible) + load-path tracer. Every resting state is complete without this file:
   the lean figure rests upright with the state-03 ghost, the assembly rests assembled with its
   load path drawn. Reduced motion / Motion OFF: instant states, no tweening, path drawn whole. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const motionOK = () => root.classList.contains('motion-ok');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const settle = (p) => 1 - Math.pow(1 - p, 3);
  const draft = (p) => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const tween = (from, to, dur, ease, fn, done) => {
    const t0 = performance.now(); let id = 0;
    const step = (now) => {
      const p = clamp((now - t0) / dur, 0, 1); fn(from + (to - from) * ease(p));
      if (p < 1) id = requestAnimationFrame(step); else if (done) done();
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  };

  /* ================= §03 · LEAN SCRUBBER ================= */
  const lean = document.getElementById('ecs-lean');
  if (lean) {
    const P = [318, 316], H = [300, 330], VB = [150, 70, 480, 360];
    const MAXA = -28, TRAVEL = [-8, 34], THIGH = 55; // drawn for illustration — never printed as values
    const torso = $('#lean-torso'), pack = $('#lean-pack'), thigh = $('#lean-thigh');
    const ys = [$('#lean-y'), $('#lean-y-o')], bs = [$('#lean-b'), $('#lean-b-o')];
    const arm = $('#lean-arm'), com = $('#lean-com'), needle = $('#lean-needle'), sector = $('#lean-sector');
    const armL = $('#lean-arm-l');
    const range = $('input[type=range]', lean), out = $('.inst-readout', lean);
    const steps = $$('[data-lean-step]', lean), play = $('[data-lean-play]', lean);
    const STATES = [
      { r: 'State 01 · upright / walking · COM 01 higher + out · moment arm 01 longer', v: 'State 01, upright', arm: 'Moment arm 01 · longer' },
      { r: 'State 02 · transition · the harness shortens · the load body travels down + in along the rail', v: 'State 02, transition', arm: 'Moment arm · shortening' },
      { r: 'State 03 · forward lean / riding · COM 02 lower + in · moment arm 02 shorter', v: 'State 03, forward lean', arm: 'Moment arm 02 · shorter' },
    ];
    const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
    const pct = (X, Y) => [(X - VB[0]) / VB[2] * 100, (Y - VB[1]) / VB[3] * 100];
    const f = (n) => n.toFixed(2);
    let t = 0, cancel = null, lastState = -1;

    const draw = (tt) => {
      t = clamp(tt, 0, 1);
      const deg = MAXA * t, a = deg * Math.PI / 180, ox = TRAVEL[0] * t, oy = TRAVEL[1] * t;
      torso.setAttribute('transform', `translate(${P[0]} ${P[1]}) rotate(${f(deg)})`);
      pack.setAttribute('transform', `translate(${f(ox)} ${f(oy)})`);
      if (thigh) thigh.setAttribute('transform', `rotate(${f(THIGH * t)} ${H[0]} ${H[1]})`);
      const yd = `M3 -172 C40 -196 ${f(72 + ox)} ${f(-184 + oy)} ${f(80 + ox)} ${f(-150 + oy)} L${f(84 + ox)} ${f(-40 + oy)} Q${f(80 + ox)} ${f(-4 + oy)} ${f(50 + ox)} ${f(-2 + oy)} L0 0`;
      const bd = `M${f(10 + ox)} ${f(-70 + oy)} Q-6 -30 0 0`;
      ys.forEach(e => e.setAttribute('d', yd));
      bs.forEach(e => e.setAttribute('d', bd));
      const c = rot(45 + ox, -92 + oy, a), C = [P[0] + c[0], P[1] + c[1]];
      arm.setAttribute('x2', f(C[0])); arm.setAttribute('y2', f(C[1]));
      com.setAttribute('cx', f(C[0])); com.setAttribute('cy', f(C[1]));
      needle.setAttribute('transform', `rotate(${f(deg)})`);
      const e = [44 * Math.sin(a), -44 * Math.cos(a)];
      sector.setAttribute('d', t < .002 ? 'M0 0' : `M0 0 L0 -44 A44 44 0 0 ${a < 0 ? 0 : 1} ${f(e[0])} ${f(e[1])} Z`);
      const m = pct((H[0] + C[0]) / 2 - 8, (H[1] + C[1]) / 2 + 2);
      armL.style.setProperty('--x', f(m[0]) + '%'); armL.style.setProperty('--y', f(m[1]) + '%');
      if (range && document.activeElement !== range) range.value = String(Math.round(t * 100));
      const si = t < 0.2 ? 0 : t > 0.8 ? 2 : 1;
      if (si !== lastState) {
        lastState = si;
        out.textContent = STATES[si].r; armL.textContent = STATES[si].arm;
        if (range) range.setAttribute('aria-valuetext', STATES[si].v);
        steps.forEach((b, j) => b.setAttribute('aria-pressed', String(j === si)));
        lean.dataset.state = String(si + 1);
      }
    };
    const goTo = (target, dur = 420, ease = settle) => {
      if (cancel) cancel(); cancel = null;
      if (!motionOK() || Math.abs(target - t) < .001) { draw(target); return; }
      cancel = tween(t, target, dur, ease, draw, () => { cancel = null; });
    };
    steps.forEach(b => b.addEventListener('click', () => goTo(Number(b.dataset.leanStep))));
    if (range) range.addEventListener('input', () => { if (cancel) cancel(); cancel = null; draw(Number(range.value) / 100); });
    if (play) play.addEventListener('click', () => {
      if (cancel) cancel(); cancel = null;
      if (!motionOK()) { draw(1); return; }
      draw(0); cancel = tween(0, 1, 1800, draft, draw, () => { cancel = null; });
    });
    draw(Number(lean.dataset.t || 0));

    /* strap routing draws on once, in the code order (orange, yellow, blue, green) */
    if (motionOK() && 'IntersectionObserver' in window) {
      lean.classList.add('straps-armed');
      new IntersectionObserver((es, o) => es.forEach(en => {
        if (!en.isIntersecting) return; o.disconnect();
        lean.classList.add('straps-in');
        setTimeout(() => lean.classList.remove('straps-armed', 'straps-in'), 2600);
      }), { threshold: .35 }).observe($('.lean-fig', lean));
    }
  }

  /* ================= §04 · ASSEMBLY + LOAD-PATH TRACER ================= */
  const asm = document.getElementById('asm');
  if (asm) {
    const plate = asm.closest('.asm-plate');
    const stepsLi = $$('#asm-steps li');
    const lpLi = $$('#asm-lp li');
    const route = $('#asm-route'), dot = $('#asm-dot');
    const nodes = $$('.asm-nodes circle', asm).map(n => ({
      el: n, k: Number(n.dataset.k), x: Number(n.dataset.x), y: Number(n.dataset.y), dy: Number(n.dataset.dy),
    }));
    const btnTrace = $('[data-trace]'), btnAsm = $('[data-assemble]');
    let explode = 1, traced = false, stopTrace = null, manual = false, nodeAt = [];

    /* same law as the CSS: part k seats while (1 − explode) × 9 runs from k − 1 to k */
    const seat = (k, e) => clamp((1 - e) * 9 - k + 1, 0, 1);
    const setExplode = (e) => {
      explode = clamp(e, 0, 1);
      asm.style.setProperty('--explode', explode.toFixed(4));
      const pts = nodes.map(n => { const y = n.y + (1 - seat(n.k, explode)) * n.dy; n.el.setAttribute('cy', y.toFixed(1)); return `${n.x} ${y.toFixed(1)}`; });
      route.setAttribute('d', 'M' + pts.join(' L'));
      const done = Math.floor((1 - explode) * 9 + 1e-4);
      stepsLi.forEach(li => {
        const k = Number(li.dataset.k);
        li.classList.toggle('is-done', k <= done);
        li.classList.toggle('is-now', k === done + 1 && explode > .002 && explode < .998);
      });
      asm.classList.toggle('is-assembled', explode < .002);
      if (btnAsm) btnAsm.textContent = explode < .002 ? 'Show exploded' : 'Show assembled'; // label names the action; no aria-pressed (it would contradict a swapped label)
    };
    const measure = () => { // node positions along the current route
      const L = route.getTotalLength();
      let from = 0;
      nodeAt = nodes.map(n => {
        const x = n.x, y = Number(n.el.getAttribute('cy')); let best = from, bd = 1e9;
        for (let s = 0; s <= 400; s++) { const l = from + (L - from) * s / 400, p = route.getPointAtLength(l); const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = l; } }
        from = best; return best;
      });
      return L;
    };
    const light = (len) => {
      nodes.forEach((n, i) => n.el.classList.toggle('is-lit', len >= nodeAt[i] - .5));
      lpLi.forEach((li, i) => li.classList.toggle('is-lit', len >= nodeAt[i] - .5));
    };
    const trace = () => {
      if (stopTrace) stopTrace();
      const L = measure();
      if (!motionOK()) { light(L); return; }
      asm.classList.add('is-tracing'); light(-1);
      stopTrace = tween(0, L, 1600, settle, (len) => {
        const p = route.getPointAtLength(len); dot.setAttribute('cx', p.x.toFixed(1)); dot.setAttribute('cy', p.y.toFixed(1)); light(len);
      }, () => { stopTrace = null; setTimeout(() => asm.classList.remove('is-tracing'), 400); });
    };

    /* narrow sheets: the 480 × 720 drawing renders below 1:1 (≈ 0.6 at 390 px), which would shrink the part
       tags and the SHOULDERS / HIPS labels to ≈ 7 px. Scale them back to ≥ 11 px about their own anchor. */
    const svg = asm.querySelector('.asm-svg');
    const tags = $$('.tag', svg).map(g => ({ g, base: g.getAttribute('transform') || '' }));
    const ends = $$('.asm-end', svg);
    const fitText = () => {
      const r = svg.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const k = clamp(1 / Math.min(r.width / 480, r.height / 720), 1, 2);
      const on = k > 1.02;
      tags.forEach(t => t.g.setAttribute('transform', on ? `${t.base} scale(${k.toFixed(3)})` : t.base));
      ends.forEach(e => { e.style.fontSize = on ? (11 * k).toFixed(1) + 'px' : ''; });
    };
    fitText();
    if ('ResizeObserver' in window) new ResizeObserver(fitText).observe(svg); else addEventListener('resize', fitText);

    setExplode(1);
    if (motionOK()) {
      /* scroll-linked: the parts seat in the documented order while the plate crosses the viewport
         (figure top from 92% to 30% of the viewport height). Reversible; no sticky. */
      plate.classList.add('is-armed');
      let raf = 0;
      const upd = () => {
        raf = 0;
        if (manual) return;
        const r = asm.getBoundingClientRect(), vh = innerHeight || 800;
        const p = clamp((vh * 0.92 - r.top) / (vh * 0.62), 0, 1);
        setExplode(1 - p);
        if (p >= 1 && !traced) { traced = true; trace(); }
      };
      addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
      addEventListener('resize', () => { if (!raf) raf = requestAnimationFrame(upd); });
      upd();
    } else {
      measure(); light(Infinity);
    }
    const to = (target, then) => {
      manual = true; // the reader took over: scrolling no longer drives the assembly
      if (stopTrace) { stopTrace(); stopTrace = null; asm.classList.remove('is-tracing'); }
      if (!motionOK()) { setExplode(target); measure(); light(Infinity); if (then) then(); return; }
      tween(explode, target, 300 + 900 * Math.abs(target - explode), settle, setExplode, then);
    };
    if (btnAsm) btnAsm.addEventListener('click', () => to(explode < .002 ? 1 : 0));
    if (btnTrace) btnTrace.addEventListener('click', () => { manual = true; trace(); });
  }
})();
