/* MONOLITH RF03-U1 · sheet 04 · page script
   1. Docking instrument renderer (states from sheet.js; S4 reverse: valve closes before the seal releases)
   2. U50 <-> U100 format morph
   3. Set-aside strikes draw in; U-DOCK finds its keyway
   Every resting state is complete without this file. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const motionOK = () => root.classList.contains('motion-ok');
  const easeSettle = (t) => 1 - Math.pow(1 - t, 3);

  /* ledger move and figure-toggle labels are handled by sheet.js (first paint and toggle) */

  /* ---------- 1. docking instrument ---------- */
  const inst = $('#dock');
  if (inst) {
    // geometry mirrors src/tools/monolith/mx_figs.py (dock_elev / dock_dial / dock_cam)
    const Z1 = 2.0, Z2 = 3.25, Z3 = 4.0, EX = 8, TOP0 = 92;
    const DPX = 48, DPY = 52, DPR = 32;
    const CX0 = 24, CX1 = 124, CY0 = 18, CY1 = 66;
    const TARGET = { S0: 0, S1: Z1, S2: Z2, S3: Z3, S4: (Z1 + Z2) / 2 };
    const el = {
      move: $('#dk-move', inst), marker: $('#dk-marker', inst), rot: $('#dk-rot', inst), sector: $('#dk-sector', inst),
      ang: $('#dk-angle', inst), camline: $('#dk-camline', inst), camdot: $('#dk-camdot', inst),
      out: $('.inst-readout', inst), range: $('input[type=range]', inst), rows: $$('tr[data-row]', inst)
    };
    let z = 0, dir = 'in', raf = 0, valveWasOpen = false;
    const pt = (a, r) => [DPX + r * Math.sin(a * Math.PI / 180), DPY - r * Math.cos(a * Math.PI / 180)];

    function draw(zz) {
      const ang = zz / Z3 * 60, p = zz / Z3;
      el.move.setAttribute('transform', `translate(0 ${(-zz * EX).toFixed(2)})`);
      el.marker.setAttribute('cy', (TOP0 - zz * EX).toFixed(2));
      el.rot.setAttribute('transform', `rotate(${ang.toFixed(2)} ${DPX} ${DPY})`);
      if (ang < 0.05) el.sector.setAttribute('d', `M${DPX} ${DPY}Z`);
      else {
        const [x0, y0] = pt(0, DPR), [x1, y1] = pt(ang, DPR);
        el.sector.setAttribute('d', `M${DPX} ${DPY}L${x0.toFixed(2)} ${y0.toFixed(2)}A${DPR} ${DPR} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z`);
      }
      // real stops are 0 and 60; anything in between is derived from an illustrative linear cam
      el.ang.textContent = ang < 0.05 ? '0°' : ang > 59.95 ? '60°' : '≈' + Math.round(ang) + '°';
      el.camline.setAttribute('stroke-dashoffset', (1 - p).toFixed(4));
      el.camdot.setAttribute('cx', (CX0 + p * (CX1 - CX0)).toFixed(2));
      el.camdot.setAttribute('cy', (CY1 - p * (CY1 - CY0)).toFixed(2));
      inst.dataset.seal = zz >= Z1 - 1e-3 ? 'on' : 'off';
      inst.dataset.valve = zz >= Z3 - 1e-3 ? 'open'
        : dir === 'out' ? (zz <= Z2 + 1e-3 ? 'closed' : 'closing')
        : (zz < Z2 - 1e-3 ? 'closed' : 'opening');
      if (zz >= Z2 - 1e-3) valveWasOpen = true;
    }

    function animateTo(target, done) {
      cancelAnimationFrame(raf);
      const from = z, dz = target - from;
      if (!motionOK() || document.hidden || Math.abs(dz) < 1e-4) { z = target; draw(z); if (done) done(); return; }
      const dur = Math.min(760, 220 + Math.abs(dz) * 130), t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        z = from + dz * easeSettle(t); draw(z);
        if (t < 1) raf = requestAnimationFrame(step); else if (done) done();
      };
      raf = requestAnimationFrame(step);
    }

    function reverseText(id) {
      if (id === 'S2') return ['S4 · WITHDRAWAL · BACK AT z2 (TBC) · VALVE CLOSED · SEAL STILL ENGAGED',
        'Withdrawal, back at z2: the valve has closed while the outer seal is still engaged. Illustrative.'];
      if (id === 'S1') return ['S4 · WITHDRAWAL · BACK AT z1 2.0 MM · VALVE CLOSED · SEAL RELEASING',
        'Withdrawal, back at z1: valve already closed, outer seal now releasing. Illustrative.'];
      if (id === 'S0') return valveWasOpen
        ? ['S4 · WITHDRAWN · 0.0 MM · VALVE CLOSED FIRST, THEN SEAL RELEASED', 'Withdrawn to 0 millimetres: the valve closed before the outer seal released. Illustrative.']
        : ['S0 · BACK TO 0.0 MM · SEAL RELEASED · VALVE NEVER OPENED', 'Back to 0 millimetres: seal released; the valve never opened. Illustrative.'];
      return null;
    }

    function mark(id, out) {
      el.rows.forEach(r => { const on = r.dataset.row === (out ? 'S4' : id); r.classList.toggle('is-on', on); r.classList.toggle('out', on && out); });
    }

    inst.addEventListener('instrument:change', (e) => {
      const { state, user } = e.detail;
      const id = state.id;
      // direction comes from where the cartridge IS, not from the button order:
      // from S4 (between z1 and z2) choosing S2 or S3 re-inserts; choosing S1 or S0 keeps withdrawing
      const backwards = user && id !== 'S4' && TARGET[id] < z - 1e-3;
      if (id === 'S4') {
        mark(id, true);
        const withdraw = () => { dir = 'out'; inst.dataset.dir = 'out'; animateTo(TARGET.S4); };
        // nothing to withdraw from below z2: insert to S3 first, then play the withdrawal
        if (z < Z2 - 1e-3) { dir = 'in'; inst.dataset.dir = 'in'; animateTo(Z3, withdraw); } else withdraw();
        return;
      }
      if (backwards) {
        dir = 'out'; inst.dataset.dir = 'out';
        const rt = reverseText(id);
        if (rt) { el.out.textContent = rt[0]; if (el.range) el.range.setAttribute('aria-valuetext', rt[1]); }
        mark(id, true);
        animateTo(TARGET[id], () => { if (id === 'S0') { valveWasOpen = false; } });
        return;
      }
      dir = 'in'; inst.dataset.dir = 'in';
      if (id === 'S0') valveWasOpen = false;
      mark(id, false);
      animateTo(TARGET[id]);
    });
    // first paint (sheet.js has already fired its initial state before this deferred script ran)
    draw(0); mark('S0', false);
    // QA only (headless screenshots): ?dock=3,2 presses those step buttons in order
    try { const qd = new URLSearchParams(location.search).get('dock'); if (qd && /^[0-4](,[0-4])*$/.test(qd)) qd.split(',').forEach(i => { const bt = $$('[data-step]', inst)[Number(i)]; if (bt) bt.click(); }); } catch (e) {}
  }

  /* ---------- 2. U50 <-> U100 format morph ---------- */
  const mf = $('#mf-svg');
  const fmtBtns = $$('[data-fmt]');
  if (mf && fmtBtns.length) {
    const MB = 196, MCX = 66, MC = 126;
    const F = { U50: { bd: 45, cd: 29, ml: '50 mL NOMINAL' }, U100: { bd: 55, cd: 39, ml: '100 mL NOMINAL' } };
    const q = (id) => mf.querySelector('#' + id);
    const f2 = (n) => n.toFixed(2);
    const geom = (bd, cd) => {
      const x0 = MCX - bd / 2, x1 = MCX + bd / 2, c0 = MCX - cd / 2, c1 = MCX + cd / 2, gy = MB - MC + 40;
      const dimh = (a, b, y, e0) => `M${f2(a)} ${f2(e0)} V${f2(y + 1.6)} M${f2(b)} ${f2(e0)} V${f2(y + 1.6)} M${f2(a)} ${f2(y)} H${f2(b)} ` +
        `M${f2(a - 1.5)} ${f2(y + 1.5)} L${f2(a + 1.5)} ${f2(y - 1.5)} M${f2(b - 1.5)} ${f2(y + 1.5)} L${f2(b + 1.5)} ${f2(y - 1.5)}`;
      const gap = (a, b) => `M${f2(a)} ${f2(gy)} H${f2(b)} M${f2(a - 1.2)} ${f2(gy + 1.2)} L${f2(a + 1.2)} ${f2(gy - 1.2)} M${f2(b - 1.2)} ${f2(gy + 1.2)} L${f2(b + 1.2)} ${f2(gy - 1.2)}`;
      return { x0, x1, c0, c1, gy, dbody: dimh(x0, x1, MB + 8, MB + 1), dcart: dimh(c0, c1, MB + 19, MB + 1), gapl: gap(x0, c0), gapr: gap(c1, x1) };
    };
    const apply = (bd, cd) => {
      const g = geom(bd, cd);
      q('mf-body').setAttribute('x', f2(g.x0)); q('mf-body').setAttribute('width', f2(bd));
      q('mf-cart').setAttribute('x', f2(g.c0)); q('mf-cart').setAttribute('width', f2(cd));
      q('mf-dbody').setAttribute('d', g.dbody); q('mf-dcart').setAttribute('d', g.dcart);
      q('mf-gapl').setAttribute('d', g.gapl); q('mf-gapr').setAttribute('d', g.gapr);
      q('mf-glt').setAttribute('x', f2((g.x0 + g.c0) / 2)); q('mf-grt').setAttribute('x', f2((g.c1 + g.x1) / 2));
      // the 154 extension line follows the body edge
    };
    const labels = (k) => {
      const s = F[k];
      q('mf-tag').textContent = k; q('mf-ml').textContent = s.ml;
      q('mf-bdt').textContent = 'Ø' + s.bd; q('mf-cdt').textContent = 'Ø' + s.cd;
    };
    let cur = { bd: 45, cd: 29 }, raf = 0;
    fmtBtns.forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.fmt, s = F[k];
      fmtBtns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      cancelAnimationFrame(raf);
      const from = { ...cur };
      ['mf-bdt', 'mf-cdt', 'mf-tag', 'mf-ml'].forEach(id => q(id).style.opacity = '.3');
      const end = () => { cur = { bd: s.bd, cd: s.cd }; apply(s.bd, s.cd); labels(k); ['mf-bdt', 'mf-cdt', 'mf-tag', 'mf-ml'].forEach(id => q(id).style.opacity = ''); };
      if (!motionOK() || document.hidden) { end(); return; }
      const t0 = performance.now(), dur = 680;
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur), e = easeSettle(t);
        cur = { bd: from.bd + (s.bd - from.bd) * e, cd: from.cd + (s.cd - from.cd) * e };
        apply(cur.bd, cur.cd);
        if (t < 1) raf = requestAnimationFrame(step); else end();
      };
      raf = requestAnimationFrame(step);
    }));
  }

  /* ---------- 3. strikes draw in · U-DOCK finds its keyway ---------- */
  if (motionOK() && 'IntersectionObserver' in window) {
    const opts = $('.mx-options');
    if (opts) {
      opts.classList.add('armed');
      new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { opts.classList.add('is-in'); o.disconnect(); } }), { threshold: .35 }).observe(opts);
    }
    const ud = $('.ud-fig');
    if (ud) new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { ud.classList.add('in-view'); o.disconnect(); } }), { threshold: .5 }).observe(ud);
  }
})();
