/* eclos.js — SHEET 09 · ÉCLOS. Finish-hierarchy control inside the §03 instrument (the twist-up states use the
   generic [data-instrument] in sheet.js). Static-first: without this file the satin-shell state is shown. */
(() => {
  'use strict';
  const g = document.querySelector('[data-gloss-inst]');
  if (!g) return;
  let states;
  try { states = JSON.parse(g.querySelector('script[type="application/json"]').textContent); } catch (e) { return; }
  const range = g.querySelector('[data-gloss-range]');
  const out = g.querySelector('.gloss-readout');
  const btns = [...g.querySelectorAll('[data-gloss]')];
  const set = (i) => {
    i = Math.max(0, Math.min(states.length - 1, i));
    const s = states[i];
    g.dataset.gloss = s.id;
    Object.entries(s.vars || {}).forEach(([k, v]) => g.style.setProperty(k, v));
    if (range) { range.value = i; range.setAttribute('aria-valuetext', s.valuetext || s.readout); }
    if (out) out.textContent = s.readout;
    btns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
  };
  if (range) range.addEventListener('input', () => set(Number(range.value)));
  btns.forEach((b, j) => b.addEventListener('click', () => set(j)));
  set(Number(g.dataset.start || 1));
})();
