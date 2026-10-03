/* about.js — SHEET 11 · page-local behaviour. Everything else (plotting, figure toggle, copy-hex, motion switch) is sheet.js.
   1. Replay the mark's construction on request (motion-ok only).
   2. TWIN lens (spec §5.13): fill ↔ construction, pixel-registered (both SVGs share viewBox -330 60 2000 1120).
      Fine pointers only; the aperture moves by transform and the twin art by the inverse amount; lerp 0.18 per frame
      (direct with motion off). The readout is the SVG coordinate under the pointer — read, not invented.
   3. The method line plots in sequence once (motion-ok only); resting state = every word boxed. */
(() => {
  'use strict';
  const root = document.documentElement;
  const motionOK = () => root.classList.contains('motion-ok');
  const fig = document.querySelector('.ab-fig');

  /* 1 · replay */
  document.querySelectorAll('[data-replay]').forEach((b) => b.addEventListener('click', () => {
    const f = b.closest('figure');
    if (!f || !window.mx || !motionOK()) return;
    f.querySelectorAll('.stage[data-plot]').forEach((s) => { if (s.offsetParent !== null) window.mx.arm(s); });
    window.mx.announce('Construction replayed.');
  }));

  /* 2 · TWIN lens */
  const fine = window.matchMedia ? matchMedia('(hover: hover) and (pointer: fine)') : null;
  const VB = { x: -330, y: 60, w: 2000, h: 1120 };
  function cloneArt(svg) {
    const c = svg.cloneNode(true);
    c.removeAttribute('role'); c.removeAttribute('aria-labelledby');
    c.setAttribute('aria-hidden', 'true'); c.setAttribute('focusable', 'false');
    c.querySelectorAll('title').forEach((t) => t.remove());
    const map = {};
    c.querySelectorAll('[id]').forEach((el) => { map[el.id] = 'tw-' + el.id; el.id = 'tw-' + el.id; });
    c.querySelectorAll('*').forEach((el) => {
      ['fill', 'stroke'].forEach((a) => {
        const v = el.getAttribute(a);
        if (v && v.indexOf('url(#') === 0) { const id = v.slice(5, -1); if (map[id]) el.setAttribute(a, 'url(#' + map[id] + ')'); }
      });
      el.classList.remove('draw');
    });
    return c;
  }
  function lens(stage, otherSvg) {
    const tw = document.createElement('div');
    tw.className = 'ab-twin'; tw.setAttribute('aria-hidden', 'true');
    tw.innerHTML = '<div class="ab-twin-lens"><div class="ab-twin-art"></div></div><div class="ab-twin-ro"><b>SVG</b><span></span></div>';
    tw.querySelector('.ab-twin-art').appendChild(cloneArt(otherSvg));
    const spec = stage.querySelector(':scope > .spec');
    spec.after(tw);
    const lensEl = tw.querySelector('.ab-twin-lens'), artEl = tw.querySelector('.ab-twin-art'), ro = tw.querySelector('.ab-twin-ro'), roTxt = ro.querySelector('span');
    let W = 0, H = 0, L = 160, tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, on = false;
    const size = () => {
      const r = stage.getBoundingClientRect(); W = r.width; H = r.height;
      L = Math.round(Math.max(130, Math.min(200, W * 0.2)));
      tw.style.setProperty('--lens', L + 'px'); tw.style.setProperty('--sw', W + 'px'); tw.style.setProperty('--sh', H + 'px');
      return r;
    };
    const place = () => {
      const ox = cx - L / 2, oy = cy - L / 2;
      lensEl.style.transform = `translate(${ox}px, ${oy}px)`;
      artEl.style.transform = `translate(${-ox}px, ${-oy}px)`;
      roTxt.textContent = 'X ' + Math.round(VB.x + (cx / W) * VB.w) + ' · Y ' + Math.round(VB.y + (cy / H) * VB.h);
      const rw = ro.offsetWidth || 120, d = L * 0.36;
      const rx = cx + d + rw > W ? cx - d - rw : cx + d;
      const ry = cy + d + 22 > H ? cy - d - 22 : cy + d;
      ro.style.transform = `translate(${rx}px, ${ry}px)`;
    };
    const step = () => {
      cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
      if (Math.abs(tx - cx) + Math.abs(ty - cy) < 0.4) { cx = tx; cy = ty; raf = 0; place(); return; }
      place(); raf = requestAnimationFrame(step);
    };
    const usable = (e) => e.pointerType !== 'touch' && (!fine || fine.matches);
    stage.addEventListener('pointerenter', (e) => {
      if (!usable(e)) return;
      const r = size(); tx = cx = e.clientX - r.left; ty = cy = e.clientY - r.top;
      on = true; place(); stage.classList.add('twin-on');
    });
    stage.addEventListener('pointermove', (e) => {
      if (!on) return;
      const r = stage.getBoundingClientRect(); tx = e.clientX - r.left; ty = e.clientY - r.top;
      stage.classList.toggle('twin-on', !e.target.closest('.callout'));   // never cover a caption the reader is on
      if (!motionOK()) { cx = tx; cy = ty; place(); } else if (!raf) raf = requestAnimationFrame(step);
    });
    stage.addEventListener('pointerleave', () => { on = false; stage.classList.remove('twin-on'); if (raf) { cancelAnimationFrame(raf); raf = 0; } });
  }
  if (fig) {
    const lab = fig.querySelector('[data-view="lab"] .ab-stage'), inv = fig.querySelector('[data-view="investigation"] .ab-stage');
    const labArt = lab && lab.querySelector('.ab-art'), invArt = inv && inv.querySelector('.ab-art');
    if (lab && inv && labArt && invArt) {
      lens(lab, invArt);   // LAB: the lens shows the construction
      lens(inv, labArt);   // INVESTIGATION: the lens shows the fill
      const sync = () => fig.classList.toggle('twin-ready', !fine || fine.matches);
      sync(); if (fine && fine.addEventListener) fine.addEventListener('change', sync);
      // a view that was hidden under the pointer never gets pointerleave: close both lenses on any view switch
      const shut = () => fig.querySelectorAll('.ab-stage.twin-on').forEach((s) => s.classList.remove('twin-on'));
      document.addEventListener('reality:change', shut);
      fig.querySelectorAll('[data-figure-toggle]').forEach((b) => b.addEventListener('click', shut));
    }
  }

  /* 3 · method line plots in sequence: box → arrow → box → arrow → box */
  const m = document.querySelector('.ab-studio .method');
  if (m && motionOK() && 'IntersectionObserver' in window) {
    const boxes = [...m.querySelectorAll('.boxed')];
    boxes.forEach((w) => {
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('aria-hidden', 'true');
      s.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none';
      s.innerHTML = '<rect x="0" y="0" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" vector-effect="non-scaling-stroke"/>';
      w.appendChild(s);
    });
    m.classList.add('armed');
    new IntersectionObserver((es, o) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      m.classList.add('is-in');
      boxes.forEach((w, i) => {
        const r = w.querySelector('rect');
        r.style.transition = `stroke-dashoffset 420ms cubic-bezier(.65,0,.35,1) ${i * 500}ms`;
        r.setAttribute('stroke-dashoffset', '0');
      });
      o.disconnect();
    }), { threshold: 0.6 }).observe(m);
  }
})();
