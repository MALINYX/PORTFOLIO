/* MALINYX — work.js · SHEET 02 · THE SPECIMEN TRAY · Rev A 2026-10-02
   Page-local behaviour on top of sheet.js (which owns SORT / FILTER clicks and their View Transitions):
   - VIEW · TRAY | REGISTER toggle (remembered per viewer, ?view= for QA)
   - INVESTIGATION defaults to EVIDENCE sort; the reorder runs inside the reality cut, no nested VT (D18)
   - the register mirrors the tray's order and evidence tiers; empty tiers hide under a filter
   - drawings in the wells draw on when they scroll into view (static when motion is off)
   - cross-document morph names only the clicked cell's visible specimen (P12)
   Every resting state is complete without this file: no-JS shows tray + register stacked. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const wrap = $('#specimens'), tray = $('#tray'), body = $('#reg-body');
  if (!wrap || !tray || !body) return;
  const motionOK = () => root.classList.contains('motion-ok');
  const read = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  const live = document.createElement('div');
  live.className = 'sr-only'; live.setAttribute('aria-live', 'polite'); document.body.appendChild(live);
  const announce = (t) => { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); };

  /* ---------- VIEW · TRAY | REGISTER ---------- */
  const modeBtns = $$('button[data-mode]');
  function setMode(m, user) {
    if (m !== 'tray' && m !== 'register') m = 'tray';
    const run = () => {
      wrap.dataset.mode = m;
      modeBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
      if (m === 'tray') { place(); armDrawings(); }
    };
    if (user && document.startViewTransition && motionOK()) document.startViewTransition(run); else run();
    if (user) { store('mx-work-view', m); announce(m === 'tray' ? 'Tray view.' : 'Register view: a table of the same specimens.'); }
  }
  modeBtns.forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode, true)));

  /* ---------- SORT: reality-driven default ---------- */
  const sortBtns = $$('[data-sort-for="tray"] button[data-sort]');
  let userSort = 'sheet';
  sortBtns.forEach(b => b.addEventListener('click', () => { userSort = b.dataset.sort; }));
  function reorderNow(order) { // same algorithm as sheet.js reorder(), without a View Transition
    const items = $$('[data-id]', tray);
    const byId = Object.fromEntries(items.map(i => [i.dataset.id, i]));
    $$('.tier-h, .tier-empty', tray).forEach(t => t.remove());
    if (order === 'evidence') {
      let tiers = []; try { tiers = JSON.parse(tray.dataset.tiers || '[]'); } catch (e) {}
      tiers.forEach(t => {
        const h = document.createElement('div'); h.className = 'tier-h'; h.textContent = t.label; tray.appendChild(h);
        if (!t.ids.length) { const e = document.createElement('div'); e.className = 'tier-empty'; e.textContent = t.empty || 'None on this site'; tray.appendChild(e); }
        t.ids.forEach(id => byId[id] && tray.appendChild(byId[id]));
      });
    } else {
      (tray.dataset.sheetOrder || '').split(',').forEach(id => byId[id] && tray.appendChild(byId[id]));
    }
    tray.dataset.sorted = order;
    sortBtns.forEach(x => x.setAttribute('aria-pressed', String(x.dataset.sort === order)));
  }

  /* ---------- register mirror + tier visibility + count ---------- */
  const showing = $('[data-showing]');
  let sig = '';
  function tierRow(label, hidden, empty) {
    const tr = document.createElement('tr'); tr.className = 'tier-row' + (empty ? ' empty' : ''); tr.setAttribute('role', 'row');
    const td = document.createElement('td'); td.colSpan = 6; td.setAttribute('role', 'cell');
    if (empty) { const s = document.createElement('span'); s.textContent = 'None on this site'; td.appendChild(s); } else td.textContent = label;
    tr.appendChild(td); if (hidden) tr.hidden = true; return tr;
  }
  function sync() {
    const kids = [...tray.children];
    // 1 · a tier header hides when none of its members is visible (the "validated — none" slot always shows)
    const groups = [];
    kids.forEach(k => {
      if (k.classList.contains('tier-h')) groups.push({ h: k, items: [] });
      else if (groups.length) groups[groups.length - 1].items.push(k);
    });
    groups.forEach(g => {
      const has = g.items.some(i => i.classList.contains('tier-empty') || (i.dataset.id && !i.hidden));
      if (g.h.hidden === has) g.h.hidden = !has;
    });
    // 2 · the register follows the tray (order + tiers)
    const next = kids.map(k => k.dataset.id ? k.dataset.id : (k.classList.contains('tier-empty') ? 'E' : 'H:' + k.textContent + (k.hidden ? ':x' : ''))).join('|');
    if (next !== sig) {
      sig = next;
      const rows = Object.fromEntries($$('tr[data-id]', body).map(r => [r.dataset.id, r]));
      $$('tr.tier-row', body).forEach(r => r.remove());
      kids.forEach(k => {
        if (k.dataset.id) { if (rows[k.dataset.id]) body.appendChild(rows[k.dataset.id]); }
        else if (k.classList.contains('tier-empty')) body.appendChild(tierRow('', false, true));
        else if (k.classList.contains('tier-h')) body.appendChild(tierRow(k.textContent, k.hidden, false));
      });
    }
    // 3 · count
    if (showing) showing.textContent = String($$('[data-id]', tray).filter(i => !i.hidden).length);
    place();
  }

  /* ---------- evidence tiers pack side by side: each header spans only its own cells ---------- */
  function cols() {
    const t = getComputedStyle(tray).gridTemplateColumns;
    return t && t !== 'none' ? t.trim().split(/\s+/).length : 1;
  }
  function place() {
    const kids = [...tray.children];
    const clear = (k) => { k.style.gridRow = ''; k.style.gridColumn = ''; };
    if (!tray.getClientRects().length) return; // hidden (register view): placed when the tray is shown again
    const C = cols();
    if (!$('.tier-h', tray) || C < 2) { kids.forEach(clear); return; }
    const groups = [];
    kids.forEach(k => {
      if (k.classList.contains('tier-h')) groups.push({ h: k, m: [] });
      else if (groups.length) groups[groups.length - 1].m.push(k);
    });
    let row = 1, col = 1;
    groups.forEach(g => {
      const vis = g.m.filter(i => !i.hidden);
      g.m.filter(i => i.hidden).forEach(clear);
      if (!vis.length) { clear(g.h); return; }
      const n = vis.length, span = Math.min(n, C);
      if (col > 1 && n > C - col + 1) { row += 2; col = 1; }
      g.h.style.gridRow = String(row); g.h.style.gridColumn = col + ' / span ' + span;
      let r = row + 1, c = col;
      vis.forEach(i => { if (c > col + span - 1) { r += 1; c = col; } i.style.gridRow = String(r); i.style.gridColumn = String(c); c += 1; });
      if (r > row + 1) { row = r + 1; col = 1; }
      else { col += span; if (col > C) { row += 2; col = 1; } }
    });
  }
  ['(max-width:1279px)', '(max-width:767px)'].forEach(q => { const m = matchMedia(q); (m.addEventListener ? m.addEventListener('change', place) : m.addListener(place)); });
  if ('MutationObserver' in window) {
    new MutationObserver(sync).observe(wrap, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
  }

  /* ---------- drawings draw on when they enter view ---------- */
  $$('.dwg .draw', tray).forEach(p => p.setAttribute('pathLength', '1'));
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); }
  }), { threshold: .3 }) : null;
  function armDrawings() {
    $$('.well', tray).forEach(w => {
      if (!$('[data-view="' + root.dataset.reality + '"] .dwg', w)) { w.classList.remove('armed', 'in-view'); return; }
      if (!io || !motionOK()) { w.classList.remove('armed'); return; }
      w.classList.remove('in-view'); w.classList.add('armed'); void w.offsetWidth; io.observe(w);
    });
  }

  /* ---------- reality ---------- */
  document.addEventListener('reality:change', (e) => {
    const r = (e.detail && e.detail.reality) || root.dataset.reality;
    reorderNow(r === 'investigation' ? 'evidence' : userSort); // inside the cut's DOM update
    sync();
    if (wrap.dataset.mode === 'tray') armDrawings();
  });

  /* ---------- cross-document morph: the clicked cell's visible specimen only ---------- */
  let lastCell = null;
  tray.addEventListener('click', (e) => { lastCell = e.target.closest('.cell'); }, true);
  window.addEventListener('pageswap', (e) => {
    if (!e.viewTransition || !lastCell) return;
    const img = $$('.v img', lastCell).find(i => i.offsetParent !== null);
    if (img) img.style.viewTransitionName = 'specimen';
  });

  /* ---------- init ---------- */
  let m = read('mx-work-view') || 'tray';
  try { const q = new URLSearchParams(location.search).get('view'); if (q) m = q; } catch (e) {}
  if (root.dataset.reality === 'investigation') reorderNow('evidence');
  setMode(m, false);
  sync();
})();
