/* zewm-excmon.js — SHEET 07 page layer (runs after sheet.js).
   Every resting state is complete without this file: full chain lit, all meanings shown, wall rows in place. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const motionOK = () => root.classList.contains('motion-ok');
  const hasIO = 'IntersectionObserver' in window;

  /* ---------- hero: per-figure toggle labels (this page: LAB = schematic, INVESTIGATION = render) ---------- */
  const fig = $('.ch-fig');
  const tgl = fig && $('[data-figure-toggle]', fig);
  const labelToggle = () => {
    if (!tgl) return;
    const showing = fig.dataset.viewOverride || root.dataset.reality;
    tgl.textContent = showing === 'lab' ? 'Show render' : 'Show schematic';
  };
  if (tgl) tgl.addEventListener('click', () => requestAnimationFrame(labelToggle));
  document.addEventListener('reality:change', () => requestAnimationFrame(labelToggle));
  labelToggle();

  /* ---------- hero: rebuild the chamber in generator order ---------- */
  const iso = $('#iso-stage');
  const rebuild = $('[data-rebuild]');
  if (iso && rebuild && motionOK()) {
    rebuild.hidden = false;
    rebuild.addEventListener('click', () => {
      if (fig && fig.dataset.viewOverride !== 'lab' && root.dataset.reality !== 'lab') { fig.dataset.viewOverride = 'lab'; labelToggle(); }
      iso.classList.remove('is-plotted'); iso.classList.add('plot-armed');
      void iso.offsetWidth;
      requestAnimationFrame(() => requestAnimationFrame(() => iso.classList.add('is-plotted')));
    });
  }

  /* ---------- 03 · failure-chain instrument ---------- */
  const inst = $('.zw-chain-inst');
  const chain = inst && $('[data-chain]', inst);
  if (inst && chain) {
    const nodes = $$('.node', chain);
    const ids = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8'];
    const show = (i, user) => {
      nodes.forEach((n, j) => { n.classList.toggle('is-off', j > i); n.classList.toggle('is-cur', !!user && j === i); });
      chain.classList.toggle('is-loop', i === nodes.length - 1);
    };
    inst.addEventListener('instrument:change', (e) => show(e.detail.index, e.detail.user));
    show(Math.max(0, ids.indexOf(inst.dataset.state || 'n8')), false);

    // first view: the hairline draws and the eight nodes land in order (plotting; ends at the complete chain)
    if (motionOK() && hasIO) {
      chain.classList.add('trace-armed');
      new IntersectionObserver((es, o) => es.forEach(e => {
        if (!e.isIntersecting) return; o.disconnect();
        chain.classList.add('is-traced');
        setTimeout(() => chain.classList.remove('trace-armed', 'is-traced'), 2800);
      }), { threshold: .45 }).observe(chain);
    }
  }

  /* ---------- 03 · semantic isolation key ---------- */
  const isoBox = $('#zw-iso');
  if (isoBox) {
    const out = $('.zw-iso-out');
    const names = { blue: ['Systems', '#3E78B8'], red: ['Failure', '#C0413F'], amber: ['Warning', '#C98A28'], violet: ['Governance', '#6E54C8'], cyan: ['Human adaptation', '#1E9C9C'], gray: ['Archive', '#8A8F94'] };
    const n = (k, one, many) => k + ' ' + (k === 1 ? one : many);
    const count = (sel, key) => $$(sel, isoBox).filter(el => (el.dataset.sem || '').split(' ').includes(key)).length;
    $$('[data-iso-set]').forEach(b => b.addEventListener('click', () => {
      const key = b.dataset.isoSet;
      isoBox.dataset.iso = key;
      $$('[data-iso-set]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      if (!out) return;
      if (key === 'all') { out.textContent = 'All six meanings shown · 8 chain nodes · 7 wall rows · 6 artifacts'; return; }
      const [nm, hex] = names[key];
      out.textContent = `${nm} · ${hex} — ${n(count('.node', key), 'chain node', 'chain nodes')} · ${n(count('.row', key), 'wall row', 'wall rows')} · ${n(count('.art', key), 'artifact', 'artifacts')}`;
    }));
  }

  /* ---------- 03 · recurrence wall drops in; RPN span draws 312 → 334 ---------- */
  const wallFig = $('.zw-wall-fig');
  if (wallFig && motionOK() && hasIO) {
    wallFig.classList.add('wall-armed');
    new IntersectionObserver((es, o) => es.forEach(e => {
      if (!e.isIntersecting) return; o.disconnect();
      wallFig.classList.add('is-in');
      // hand the rows back to their resting state so the isolation key can dim them again
      setTimeout(() => wallFig.classList.remove('wall-armed', 'is-in'), 2200);
    }), { threshold: .3 }).observe(wallFig);
  }

  /* ---------- 06 · v01 / v02 wipe ---------- */
  const wipe = $('[data-wipe]');
  const wr = $('#wipe-r');
  if (wipe && wr) {
    const set = () => {
      const v = Number(wr.value);
      wipe.style.setProperty('--wipe', v + '%');
      wr.setAttribute('aria-valuetext', v <= 2 ? 'All v02' : v >= 98 ? 'All v01' : `${v}% v01 on the left, v02 on the right`);
    };
    wr.addEventListener('input', set); set();
  }
})();
