/* AHRK · sheet 05 · page script. Static-first: the HTML already rests in the open, loaded state
   (mode 02 Work, fold 90°, lock seated, load path drawn). This file only adds the reader-driven motion. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const motion = () => root.classList.contains('motion-ok');
  const settle = (t) => 1 - Math.pow(1 - t, 3);            // ≈ --ease-settle
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const pad = (n) => String(n).padStart(2, '0');

  // Mode data — names, family (two physical families) and lighting preset (STEP-01 matrix, specified intent).
  const MODES = {
    1: { n: 'Arrival', fam: 'closed', light: 'Low warm wayfinding / entry glow' },
    2: { n: 'Work', fam: 'open', light: '3500–4000 K task light over the surface' },
    3: { n: 'Rest', fam: 'closed', light: '2700 K low ambient + floor night path' },
    4: { n: 'Dining', fam: 'open', light: 'Mid-warm pooled light over the surface' },
    5: { n: 'Wellness', fam: 'closed', light: 'Even diffuse calm light, no glare from the floor' },
    6: { n: 'Reset', fam: 'closed', light: 'Bright neutral cleaning light, then default' }
  };

  /* ---------------- §03 · the fold-down instrument ---------------- */
  const inst = $('#fold-inst');
  let selectMode = null;
  if (inst) {
    const P = [56, -717], AL = [116, 18], R = 380;            // pivot, damper attachment (open coords), protractor radius
    const panel = $('#fold-panel', inst), damper = $('#fold-damper', inst), sector = $('#fold-sector', inst);
    const lock = $('#fold-lock', inst), route = $('#fold-route', inst), dot = $('#fold-dot', inst);
    const range = $('#fold-range', inst), degEl = $('[data-ai-deg]', inst), stateEl = $('[data-ai-state]', inst);
    const out = $('[data-ai-readout]', inst), lightEl = $('[data-ai-light]', inst), countEl = $('[data-ai-count]', inst);
    const chips = $$('.mode-chip', inst), trays = $('[data-trays]', inst);
    const regions = (k) => $$(`[data-region="${k}"]`, inst);
    const steps = (k) => $$(`.ai-route [data-step="${k}"]`, inst);
    // distances along "M330 -717 H-130": bracket (x≤62) 268, anchor node (x≤34) 296, ply (x≤24) 306, wall (x≤0) 330
    const STOPS = [['surface', 0], ['bracket', 268], ['anchor', 296], ['ply', 306], ['wall', 330]];
    let fold = 90, mode = 2, anim = 0, tracing = 0;
    inst.dataset.js = '1';

    const geom = (f) => {
      const a = (f - 90) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      panel.setAttribute('transform', `rotate(${(f - 90).toFixed(2)} ${P[0]} ${P[1]})`);
      damper.setAttribute('x2', (P[0] + AL[0] * c - AL[1] * s).toFixed(1));
      damper.setAttribute('y2', (P[1] + AL[0] * s + AL[1] * c).toFixed(1));
      const r = f * Math.PI / 180, sn = Math.sin(r), cs = Math.cos(r), R1 = R - 44;
      sector.setAttribute('d', f < .5 ? 'M0 0' : `M${P[0]} ${P[1] - R} A${R} ${R} 0 0 1 ${(P[0] + R * sn).toFixed(1)} ${(P[1] - R * cs).toFixed(1)} L${(P[0] + R1 * sn).toFixed(1)} ${(P[1] - R1 * cs).toFixed(1)} A${R1} ${R1} 0 0 0 ${P[0]} ${P[1] - R1} Z`);
      inst.style.setProperty('--wk', (f / 90).toFixed(3));
      degEl.textContent = Math.round(f) + '°';
    };
    const setLit = (on) => {
      STOPS.forEach(([k]) => { regions(k).forEach(r => r.classList.toggle('is-lit', on)); steps(k).forEach(li => li.classList.toggle('is-lit', on)); });
    };
    const unlock = () => {
      cancelAnimationFrame(tracing); tracing = 0; inst.classList.remove('is-tracing');
      inst.dataset.locked = 'false'; inst.dataset.traced = 'false'; lock.classList.remove('is-seated');
      route.style.strokeDashoffset = 1; setLit(false);
    };
    const readout = () => {
      const m = MODES[mode];
      let t, st, vt;
      if (fold >= 90) { t = `Mode ${pad(mode)} · ${m.n} → family 01 · surface open · lock seated at 720–750 mm AFFL · load to the anchor, spine bypassed`; st = 'Lock seated'; vt = 'Fold 90 degrees, open, lock seated'; }
      else if (fold <= 0) { t = `Mode ${pad(mode)} · ${m.n} → family 02 · surface closed · flush on the home line · no working load`; st = 'Flush · home line'; vt = 'Fold 0 degrees, closed, flush on the home line'; }
      else { t = `Fold ${Math.round(fold)}° · between the two families · damped descent (illustrative)`; st = 'Damped descent'; vt = `Fold ${Math.round(fold)} degrees, damped descent, illustrative`; }
      stateEl.textContent = st; range.setAttribute('aria-valuetext', vt);
      if (out.textContent !== t) out.textContent = t;
    };
    const setLight = () => {
      lightEl.firstChild.textContent = 'Light preset · ' + MODES[mode].light + ' ';
    };
    const press = (n) => {
      chips.forEach(c => c.setAttribute('aria-pressed', String(+c.dataset.mode === n)));
      inst.dataset.mode = n || '';
      inst.dataset.fam = n ? MODES[n].fam : '';
    };

    const trace = () => {
      if (fold < 90) return;
      cancelAnimationFrame(tracing);
      if (!motion()) { setLit(true); inst.dataset.traced = 'true'; route.style.strokeDashoffset = 0; return; }
      setLit(false); inst.dataset.traced = 'false';
      const L = route.getTotalLength(), dur = 1600, t0 = performance.now();
      inst.classList.add('is-tracing');
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur), e = settle(p), d = e * 460;
        const pt = route.getPointAtLength(e * L);
        dot.setAttribute('cx', pt.x.toFixed(1)); dot.setAttribute('cy', pt.y.toFixed(1));
        route.style.strokeDashoffset = (1 - e).toFixed(4);
        STOPS.forEach(([k, at]) => { if (d >= at) { regions(k).forEach(r => r.classList.add('is-lit')); steps(k).forEach(li => li.classList.add('is-lit')); } });
        if (p < 1) tracing = requestAnimationFrame(step);
        else { tracing = 0; inst.classList.remove('is-tracing'); inst.dataset.traced = 'true'; }
      };
      tracing = requestAnimationFrame(step);
    };
    const seat = () => {
      inst.dataset.locked = 'true'; lock.classList.add('is-seated');
      if (motion()) { lock.classList.remove('click'); void lock.getBBox(); lock.classList.add('click'); }
    };

    const animateTo = (target) => new Promise((done) => {
      cancelAnimationFrame(anim);
      if (fold < 90 || target < 90) unlock();
      const from = fold;
      const finish = () => {
        fold = target; geom(fold); range.value = fold; readout();
        if (fold >= 90) { seat(); motion() ? setTimeout(trace, 180) : trace(); }
        done();
      };
      if (!motion() || from === target) { finish(); return; }
      const dur = Math.max(320, 900 * Math.abs(target - from) / 90), t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        fold = from + (target - from) * settle(p); geom(fold);
        if (p < 1) anim = requestAnimationFrame(step); else { anim = 0; finish(); }
      };
      anim = requestAnimationFrame(step);
    });

    selectMode = (n, opts = {}) => {
      mode = n; press(n); setLight();
      if (!opts.silent) document.dispatchEvent(new CustomEvent('ahrk:mode', { detail: { mode: n, from: 'inst' } }));
      return animateTo(MODES[n].fam === 'open' ? 90 : 0);
    };
    chips.forEach(c => c.addEventListener('click', () => selectMode(+c.dataset.mode)));

    range.addEventListener('input', () => {
      cancelAnimationFrame(anim); anim = 0;
      const f = Number(range.value);
      if (f < 90) unlock();
      fold = f; geom(fold);
      if (f >= 90) { if (MODES[mode].fam !== 'open') mode = 2; press(mode); setLight(); seat(); trace(); }
      else if (f <= 0) { if (MODES[mode].fam !== 'closed') mode = 6; press(mode); setLight(); }
      else press(0);
      readout();
    });

    $('[data-ai-play]', inst).addEventListener('click', async () => {
      await selectMode(6); await sleep(motion() ? 700 : 0); await selectMode(2);
    });
    $('[data-ai-trace]', inst).addEventListener('click', () => { if (fold >= 90) trace(); else selectMode(2); });

    /* six chips snap into the two families (FLIP), counter 6 → 2 */
    const order = [1, 2, 3, 4, 5, 6].map(n => chips.find(c => +c.dataset.mode === n));
    const pool = () => {
      order.forEach(c => { c.style.transition = 'none'; c.style.transform = ''; });
      const box = trays.getBoundingClientRect(), gap = 6;
      const finals = order.map(c => c.getBoundingClientRect());
      const cw = (box.width - gap * 2) / 3;
      order.forEach((c, i) => {
        const f = finals[i];
        const px = box.left + (i % 3) * (cw + gap), py = box.top + 34 + Math.floor(i / 3) * (f.height + 10);
        c.style.transform = `translate(${(px - f.left).toFixed(1)}px, ${(py - f.top).toFixed(1)}px)`;
      });
      trays.classList.add('is-pool'); countEl.textContent = '6';
    };
    const snap = () => {
      if (!motion()) { countEl.textContent = '2'; return; }
      pool(); void trays.offsetWidth;
      requestAnimationFrame(() => {
        order.forEach((c, i) => { c.style.transition = `transform 560ms cubic-bezier(.2,.7,.2,1) ${i * 60}ms`; c.style.transform = ''; });
        trays.classList.remove('is-pool');
        const t0 = performance.now();
        const tick = (now) => { const p = Math.min(1, (now - t0) / 700); countEl.textContent = String(Math.round(6 - 4 * settle(p))); if (p < 1) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
        setTimeout(() => order.forEach(c => { c.style.transition = ''; }), 1000);
      });
    };
    $('[data-ai-snap]', inst).addEventListener('click', snap);

    // resting state (matches the static HTML)
    geom(fold); inst.dataset.locked = 'true'; lock.classList.add('is-seated'); press(2); setLight(); readout();
    if (!motion()) { setLit(true); inst.dataset.traced = 'true'; route.style.strokeDashoffset = 0; }
    else inst.dataset.traced = 'false';

    if ('IntersectionObserver' in window && motion()) {
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!trays.dataset.snapped) pool(); });
      else pool();
      new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { trays.dataset.snapped = '1'; o.disconnect(); setTimeout(snap, 120); } }), { threshold: .6 }).observe(trays);
      new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { o.disconnect(); setTimeout(trace, 300); } }), { threshold: .45 }).observe($('.ahrk-fold', inst));
    } else if (motion()) { setLit(true); inst.dataset.traced = 'true'; }

    document.addEventListener('reality:change', () => geom(fold));
  }

  /* ---------------- §04 · matrix stepper (synced with §03) ---------------- */
  const mx = $('[data-mx]');
  if (mx) {
    const table = $('.matrix', mx), rows = $$('tbody tr', mx), btns = $$('[data-mx-step]', mx);
    const setMx = (n) => {
      table.dataset.active = n;
      rows.forEach(r => r.classList.toggle('is-active', +r.dataset.mode === n));
      btns.forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.mxStep === n)));
    };
    btns.forEach(b => b.addEventListener('click', () => {
      const n = +b.dataset.mxStep; setMx(n);
      if (selectMode) selectMode(n, { silent: true });
    }));
    document.addEventListener('ahrk:mode', (e) => { if (e.detail.from !== 'mx') setMx(e.detail.mode); });
  }

  /* ---------------- §04 · plate viewer (falls back to the original PNG link) ---------------- */
  const dlg = $('#plate-viewer');
  if (dlg && typeof dlg.showModal === 'function') {
    const img = $('[data-pv-img]', dlg), title = $('[data-pv-title]', dlg), cap = $('[data-pv-cap]', dlg), png = $('[data-pv-png]', dlg);
    let opener = null;
    $$('[data-viewer]').forEach(a => a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault(); opener = a;
      const fig = a.closest('figure');
      img.src = a.dataset.full; img.alt = $('img', a).alt;
      title.textContent = ($('.t', fig) || {}).textContent || 'Plate';
      cap.textContent = 'Shown whole · locked portfolio frame, 9 Jul 2026.';
      png.href = a.getAttribute('href');
      dlg.showModal();
    }));
    $('[data-pv-close]', dlg).addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => { img.removeAttribute('src'); if (opener) opener.focus(); });
  }
})();
