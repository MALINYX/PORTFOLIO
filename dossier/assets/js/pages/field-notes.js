/* field-notes.js — SHEET 10 · FIELD NOTES
   1. drawer readout + filter coupling (hero threads recede when the label filter excludes them)
   2. note 07: lean control swings the load vector; the horizontal hip-to-load-line moment arm shortens (no numbers)
   3. note 11: the neutral chain takes the ZEWM key on hover / focus / button
   Reduced motion: both diagrams show their end state statically; controls still work, without animation. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const motionOK = () => root.classList.contains('motion-ok');

  /* ---------- 1. drawer readout ---------- */
  const read = $('#drawer-read');
  const threads = $$('.thr');
  const deflt = () => root.dataset.reality === 'investigation' ? read.dataset.defaultInv : read.dataset.defaultLab;
  let filterText = '';
  const rest = () => { if (!read) return; read.textContent = filterText || deflt(); read.classList.toggle('on', !!filterText); };
  threads.forEach(t => {
    const show = () => {
      if (!read) return;
      const inv = root.dataset.reality === 'investigation';
      read.textContent = inv ? `No. ${t.dataset.no} · source ${t.dataset.src} · principle, no test data`
                             : `No. ${t.dataset.no} · ${t.dataset.type} · ${t.dataset.title}`;
      read.classList.add('on');
    };
    t.addEventListener('mouseenter', show); t.addEventListener('focus', show);
    t.addEventListener('mouseleave', rest); t.addEventListener('blur', rest);
  });
  document.addEventListener('reality:change', rest);

  /* a link to a label the type filter has hidden (drawer thread, register number) resets the filter first, then goes there */
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#n"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1), tgt = document.getElementById(id);
    if (!tgt || !tgt.hidden) return;
    e.preventDefault();
    const all = $('[data-filter-for="fn-labels"] button[data-filter="all"]');
    if (all) all.click();
    setTimeout(() => { tgt.scrollIntoView({ block: 'start', behavior: motionOK() ? 'smooth' : 'auto' }); history.replaceState(null, '', '#' + id); }, motionOK() ? 360 : 0);
  });
  rest();

  /* filter coupling: sheet.js filters the labels; mirror it on the threads */
  $$('[data-filter-for="fn-labels"] button[data-filter]').forEach(b => b.addEventListener('click', () => {
    const f = b.dataset.filter;
    let n = 0;
    threads.forEach(t => { const on = f === 'all' || t.dataset.tags === f; t.classList.toggle('is-out', !on); if (on) n++; });
    filterText = f === 'all' ? '' : `Filter · ${b.firstChild.textContent.trim()} · ${n} of 12`;
    rest();
  }));

  /* ---------- 2. note 07 ---------- */
  const d07 = $('#d07');
  if (d07) {
    const torso = $('.d07-torso', d07), pack = $('.d07-pack', d07), dimG = $('.d07-dim', d07),
          load = $('.d07-load', d07), com = $('.d07-com', d07), arc = $('.d07-arc', d07), lt = $('.d07-lt', d07),
          range = $('input[type=range]', d07), label = d07.closest('.hlabel');
    // hip joint H sits in front of the spine; the torso pivots about it. Moment arm = horizontal distance hip -> load line (no value printed)
    const H = [132, 150], C0 = [-45, -69], MOVE = [9, 20], LEAN = 20, R = 30, DY = 160, GAP = 40;
    const f = (v) => (Math.round(v * 10) / 10).toString();
    const ln = (el, x1, y1, x2, y2) => { el.setAttribute('x1', f(x1)); el.setAttribute('y1', f(y1)); el.setAttribute('x2', f(x2)); el.setAttribute('y2', f(y2)); };
    const [ext, dl, t1, t2] = $$('line', dimG);
    let t = 1, raf = 0, manual = false;
    function draw(v) {
      t = Math.max(0, Math.min(1, v));
      const th = LEAN * t, r = th * Math.PI / 180;
      const lx = C0[0] + MOVE[0] * t, ly = C0[1] + MOVE[1] * t;
      const cx = H[0] + lx * Math.cos(r) - ly * Math.sin(r), cy = H[1] + lx * Math.sin(r) + ly * Math.cos(r);
      torso.setAttribute('transform', `rotate(${f(th)} ${H[0]} ${H[1]})`);
      pack.setAttribute('transform', `translate(${f(MOVE[0] * t)} ${f(MOVE[1] * t)})`);
      ln(ext, cx, cy + GAP, cx, DY + 4);
      ln(dl, cx, DY, H[0], DY);
      ln(t1, cx - 3, DY + 3, cx + 3, DY - 3);
      ln(t2, H[0] - 3, DY + 3, H[0] + 3, DY - 3);
      ln(load, cx, cy, cx, cy + 28);
      com.setAttribute('cx', f(cx)); com.setAttribute('cy', f(cy));
      const ex = H[0] + R * Math.sin(r), ey = H[1] - R * Math.cos(r);
      arc.setAttribute('d', `M${H[0]} ${H[1] - R} A${R} ${R} 0 0 1 ${f(ex)} ${f(ey)}`);
      lt.setAttribute('x', f(ex + 4)); lt.setAttribute('y', f(ey - 2));
      d07.dataset.t = t < .02 ? '0' : '1';
      range.value = String(Math.round(t * 100));
      range.setAttribute('aria-valuetext', t < .02 ? 'Upright' : t > .98 ? 'Forward lean' : 'Partial lean');
    }
    const ease = (x) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    function tween(to, ms) {
      cancelAnimationFrame(raf);
      if (!motionOK()) { draw(to); return; }
      const from = t, t0 = performance.now();
      const step = (now) => { const k = Math.min(1, (now - t0) / ms); draw(from + (to - from) * ease(k)); if (k < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }
    range.addEventListener('input', () => { manual = true; cancelAnimationFrame(raf); draw(range.value / 100); });
    // plays on hover or focus (never autoplays); the reader's own setting wins once they touch the control
    const play = () => { if (!manual && motionOK()) tween(1, 1300); };
    const back = () => { if (!manual && motionOK() && !label.contains(document.activeElement) && !label.matches(':hover')) tween(0, 900); };
    label.addEventListener('mouseenter', play); label.addEventListener('focusin', play);
    label.addEventListener('mouseleave', back); label.addEventListener('focusout', () => setTimeout(back, 0));
    draw(motionOK() ? 0 : 1);   // static end state (with the upright ghost) under reduced motion / no JS
  }

  /* ---------- 3. note 11 ---------- */
  const d11 = $('#d11');
  if (d11) {
    const btn = $('.d11-btn', d11), label = d11.closest('.hlabel');
    let pinned = !motionOK();          // reduced motion: keyed, static
    const set = (on) => d11.classList.toggle('is-keyed', on);
    const sync = () => { btn.textContent = pinned ? 'Hide the key' : 'Show the key'; set(pinned); };
    btn.addEventListener('click', () => { pinned = !pinned; sync(); });
    label.addEventListener('mouseenter', () => set(true));
    label.addEventListener('focusin', () => set(true));
    label.addEventListener('mouseleave', () => { if (!label.contains(document.activeElement)) set(pinned); });
    label.addEventListener('focusout', () => setTimeout(() => { if (!label.contains(document.activeElement) && !label.matches(':hover')) set(pinned); }, 0));
    sync();
  }
})();
