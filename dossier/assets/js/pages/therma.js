/* therma.js — SHEET 03 · page-local enhancement: TWIN loupe on the pixel-registered CMF stack (DESIGN-SPEC §5.13).
   Fine pointers only; the aperture shows the other registered render under the pointer. Static page is complete without it. */
(() => {
  'use strict';
  const root = document.documentElement;
  const fine = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)');
  if (!fine || !fine.matches) return;
  document.querySelectorAll('[data-twin]').forEach((stack) => {
    const inst = stack.closest('[data-instrument]');
    const S = 132;
    const ap = document.createElement('div'); ap.className = 'twin'; ap.setAttribute('aria-hidden', 'true');
    const im = new Image(); im.alt = ''; im.decoding = 'async'; ap.appendChild(im);
    const lbl = document.createElement('div'); lbl.className = 'twin-lbl'; lbl.setAttribute('aria-hidden', 'true');
    stack.append(ap, lbl);
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, on = false;
    const pick = () => {
      const alt = inst && inst.dataset.state === 'F';
      const src = alt ? stack.dataset.twinAlt : stack.dataset.twin;
      if (im.getAttribute('src') !== src) im.src = src;
      lbl.textContent = alt ? 'TWIN · A SIGNAL, BROAD STUDY' : 'TWIN · LOCKED A2_REFINED';
    };
    const size = () => { const r = stack.getBoundingClientRect(); im.style.width = r.width + 'px'; im.style.height = r.height + 'px'; };
    const draw = () => {
      const k = root.classList.contains('motion-ok') ? 0.18 : 1;
      cx += (tx - cx) * k; cy += (ty - cy) * k;
      const x = Math.round(cx - S / 2), y = Math.round(cy - S / 2);
      ap.style.transform = `translate3d(${x}px,${y}px,0)`;
      im.style.transform = `translate3d(${-x}px,${-y}px,0)`;
      lbl.style.transform = `translate3d(${x}px,${y + S + 4}px,0)`;
      raf = (on && (Math.abs(tx - cx) > 0.3 || Math.abs(ty - cy) > 0.3)) ? requestAnimationFrame(draw) : 0;
    };
    const at = (e) => { const r = stack.getBoundingClientRect(); tx = e.clientX - r.left; ty = e.clientY - r.top; };
    stack.addEventListener('pointerenter', (e) => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      pick(); size(); at(e); cx = tx; cy = ty; on = true;
      ap.classList.add('on'); lbl.classList.add('on'); draw();
    });
    stack.addEventListener('pointermove', (e) => { if (!on) return; at(e); if (!raf) raf = requestAnimationFrame(draw); });
    stack.addEventListener('pointerleave', () => { on = false; ap.classList.remove('on'); lbl.classList.remove('on'); });
    if (inst) inst.addEventListener('instrument:change', pick);
    addEventListener('resize', size, { passive: true });
  });
})();
