/* MALINYX — SPECIMEN LAB · sheet.js · Rev A 2026-10-02
   Static-first enhancements. Every resting state is complete without this file. */
(() => {
  'use strict';
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const read = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const sread = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const swrite = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const motionOK = () => root.classList.contains('motion-ok');
  const canVT = () => !!document.startViewTransition && motionOK() && !document.hidden;
  const easeDraft = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // approx .65,0,.35,1

  /* ---------- live region ---------- */
  const live = document.createElement('div');
  live.className = 'sr-only'; live.setAttribute('aria-live', 'polite'); document.body.appendChild(live);
  const announce = (t) => { live.textContent = ''; setTimeout(() => live.textContent = t, 30); };

  /* ---------- motion switch ---------- */
  function applyMotion() {
    const m = root.dataset.motion || 'auto';
    const ok = m === 'on' || (m === 'auto' && !mq.matches);
    root.classList.toggle('motion-ok', ok);
    $$('[data-motion-set]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.motionSet === m)));
    if (!ok && document.getAnimations) document.getAnimations().forEach(a => { try { a.finish(); } catch (e) { a.cancel(); } });
  }
  $$('[data-motion-set]').forEach(b => b.addEventListener('click', () => {
    root.dataset.motion = b.dataset.motionSet; store('mx-motion', b.dataset.motionSet); applyMotion();
    announce('Motion ' + b.dataset.motionSet + '.');
  }));
  if (mq.addEventListener) mq.addEventListener('change', applyMotion);
  applyMotion();

  /* ---------- reality toggle (signature 1: the section cut) ---------- */
  const plane = document.createElement('div');
  plane.className = 'cut-plane'; plane.setAttribute('aria-hidden', 'true');
  plane.innerHTML = '<span class="ztag">CUT</span>';
  document.body.appendChild(plane);
  const ztag = plane.firstChild;
  let busy = false;

  function updateToggles(r) {
    $$('.reality-btn').forEach(b => {
      b.setAttribute('aria-pressed', String(r === 'investigation'));
    });
    $$('.reality-btn').forEach(b => b.setAttribute('aria-label', 'Change reality — now ' + (r === 'investigation' ? 'investigation: evidence views' : 'lab: design views')));
  }
  function moveLedger(r) {
    const ledger = $('#s07'), anchor = $('#ledger-inv-slot');
    if (!ledger || !anchor) return;
    if (r === 'investigation') anchor.after(ledger);
    else { const home = $('#ledger-home-slot'); if (home) home.after(ledger); }
  }
  function zReadout() {
    // Only while the plane crosses an orthographic elevation in mm units (home + /therma).
    const el = $$('[data-zmap]').find(e => e.offsetParent !== null);
    if (!el) return () => 'CUT';
    const r = el.getBoundingClientRect();
    const [zTop, zBottom] = el.dataset.zmap.split(',').map(Number); // Z at top edge, Z at bottom edge of the element box
    const tail = Number(el.dataset.ztail ?? -1e9);
    return (y) => {
      if (y < r.top || y > r.bottom) return 'CUT';
      const z = zTop + (zBottom - zTop) * ((y - r.top) / r.height);
      if (z < tail) return 'BOOT · BELOW DATUM';
      return 'Z ' + (z >= 0 ? '+' : '−') + Math.abs(z).toFixed(1);
    };
  }
  async function changeReality() {
    if (busy) return; busy = true;
    $$('.reality-btn').forEach(b => b.setAttribute('aria-disabled', 'true'));
    setTimeout(() => { busy = false; $$('.reality-btn').forEach(b => b.removeAttribute('aria-disabled')); }, 700);
    const next = root.dataset.reality === 'lab' ? 'investigation' : 'lab';
    const incoming = $$(`[data-view="${next}"] img`);
    await Promise.race([Promise.all(incoming.map(i => i.decode ? i.decode().catch(() => {}) : 0)), sleep(300)]);
    const apply = () => {
      root.dataset.reality = next;
      moveLedger(next);
      document.dispatchEvent(new CustomEvent('reality:change', { detail: { reality: next } }));
      updateToggles(next); store('mx-reality', next);
    };
    if (!canVT()) {
      apply();
      const sh = $('.sheet');
      if (sh) { sh.style.setProperty('--fd', motionOK() ? '200ms' : '150ms'); sh.classList.remove('fade-in'); void sh.offsetWidth; sh.classList.add('fade-in'); }
    } else {
      root.classList.add('vt-reality');
      const t = document.startViewTransition(apply);
      t.updateCallbackDone.catch(() => {});
      t.ready.then(() => {
        const map = zReadout(); const t0 = performance.now(); const dur = 680;
        const tick = (now) => {
          const p = Math.min(1, (now - t0) / dur);
          ztag.textContent = map(easeDraft(p) * innerHeight);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }).catch(() => {});
      await t.finished.catch(() => {});
      root.classList.remove('vt-reality');
      ztag.textContent = 'CUT';
      $$('.h1-swap').forEach(h => { h.classList.remove('h1-settle'); void h.offsetWidth; h.classList.add('h1-settle'); });
    }
    replot();
    announce(next === 'investigation' ? 'Investigation reality: evidence views shown.' : 'Lab reality: design views shown.');
  }
  $$('.reality-btn').forEach(b => b.addEventListener('click', changeReality));
  updateToggles(root.dataset.reality);

  /* per-figure override */
  $$('[data-figure-toggle]').forEach(btn => btn.addEventListener('click', () => {
    const fig = btn.closest('figure');
    const cur = fig.dataset.viewOverride || root.dataset.reality;
    const nx = cur === 'lab' ? 'investigation' : 'lab';
    fig.dataset.viewOverride = nx;
    btn.textContent = figLabel(btn, nx);
    replot(fig);
  }));
  // label = what the OTHER view is; pages can override with data-label-lab / data-label-inv
  function figLabel(btn, showing) { return showing === 'lab' ? (btn.dataset.labelLab || 'Show drawing') : (btn.dataset.labelInv || 'Show render'); }
  const syncFigLabels = () => $$('[data-figure-toggle]').forEach(b => { b.textContent = figLabel(b, root.dataset.reality); });
  document.addEventListener('reality:change', () => { $$('figure[data-view-override]').forEach(f => delete f.dataset.viewOverride); syncFigLabels(); });
  syncFigLabels();
  if (root.dataset.reality === 'investigation') moveLedger('investigation');

  /* ---------- plotting (signature 2) ---------- */
  const plotIO = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach(e => {
    if (e.isIntersecting) {
      const st = e.target; st.classList.add('is-plotted'); plotIO.unobserve(st);
      clearTimeout(st._mxDone); st._mxDone = setTimeout(() => st.classList.remove('plot-armed'), 2200); // restores dashed hidden/chain lines
    }
  }), { threshold: .2 }) : null;
  function arm(stage) {
    if (!motionOK() || !plotIO) { stage.classList.add('is-plotted'); return; }
    stage.classList.remove('is-plotted'); stage.classList.add('plot-armed');
    void stage.offsetWidth; plotIO.observe(stage);
  }
  function replot(scope = document) {
    $$('.stage[data-plot]', scope).forEach(s => { if (s.offsetParent !== null) arm(s); });
  }
  $$('.stage[data-plot]').forEach(arm);

  /* number leaders (pathLength=1 for dash animation) */
  $$('.overlay .leader, .overlay .draw, .spec .draw').forEach(p => p.setAttribute('pathLength', '1'));

  /* ---------- hover/focus a callout lights its anchor ---------- */
  $$('.callout[data-a]').forEach(c => {
    const stage = c.closest('.stage');
    const on = (v) => $$(`[data-anchor="${c.dataset.a}"]`, stage).forEach(a => a.classList.toggle('is-hot', v));
    c.addEventListener('mouseenter', () => on(true)); c.addEventListener('mouseleave', () => on(false));
    c.addEventListener('focusin', () => on(true)); c.addEventListener('focusout', () => on(false));
  });

  /* ---------- pause loops off-screen / hidden tab ---------- */
  if ('IntersectionObserver' in window) {
    const loopIO = new IntersectionObserver((es) => es.forEach(e => e.target.classList.toggle('is-paused', !e.isIntersecting)), { rootMargin: '80px' });
    $$('[data-loop]').forEach(el => loopIO.observe(el));
  }
  document.addEventListener('visibilitychange', () => root.classList.toggle('tab-hidden', document.hidden));

  /* ---------- window cards ---------- */
  $$('.win[data-collapsible]').forEach(w => {
    const key = 'mx-win-' + (w.id || '');
    const x = $('.win-x', w);
    const set = (c) => { w.classList.toggle('is-collapsed', c); if (x) { x.setAttribute('aria-expanded', String(!c)); x.textContent = c ? '+' : '×'; } };
    if (w.id && sread(key) === '1') set(true);
    if (x) x.addEventListener('click', () => { const c = !w.classList.contains('is-collapsed'); set(c); if (w.id) swrite(key, c ? '1' : '0'); });
  });

  /* ---------- mobile menu ---------- */
  const menu = $('#menu');
  $$('[data-open-menu]').forEach(b => b.addEventListener('click', () => menu && menu.showModal && menu.showModal()));
  $$('[data-close-menu]').forEach(b => b.addEventListener('click', () => menu && menu.close()));
  if (menu) menu.addEventListener('click', (e) => { if (e.target === menu) menu.close(); });

  /* ---------- fan deck ---------- */
  const fan = $('.fan');
  if (fan) {
    const slot = $('.fan-slot');
    const fill = (a) => {
      if (!slot || !a) return;
      const d = a.dataset;
      $('[data-slot="code"]', slot).textContent = d.code;
      $('[data-slot="title"]', slot).textContent = d.title;
      $('[data-slot="line"]', slot).textContent = d.line;
      const chip = $('[data-slot="chip"]', slot); chip.innerHTML = $('template', a.parentElement)?.innerHTML || '';
      const link = $('[data-slot="link"]', slot); link.href = a.getAttribute('href');
      const st = $('[data-slot="status"]', slot); if (st) st.textContent = d.status || '';
      const tags = $('[data-slot="tags"]', slot); const tt = $('template.tags', a.parentElement);
      if (tags && tt) tags.innerHTML = tt.innerHTML;
      $$('.blade > a', fan).forEach(x => x.removeAttribute('aria-current'));
      a.setAttribute('aria-current', 'true');
    };
    $$('.blade > a', fan).forEach(a => {
      a.addEventListener('mouseenter', () => fill(a));
      a.addEventListener('focus', () => fill(a));
    });
    const supportsSDA = CSS.supports && CSS.supports('animation-timeline: view()');
    const wide = matchMedia('(min-width:1024px)');
    if (motionOK() && 'IntersectionObserver' in window) {
      if (!wide.matches) {
        fan.classList.add('strip-armed');
        new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { fan.classList.add('is-open'); o.disconnect(); } }), { threshold: .2 }).observe(fan);
      } else if (!supportsSDA) {
        fan.classList.add('is-armed');
        new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { fan.classList.add('is-open'); o.disconnect(); } }), { threshold: .3 }).observe(fan.closest('section'));
      }
    }
  }

  /* ---------- sort / filter collections ---------- */
  function reorder(container, order) {
    const items = $$('[data-id]', container);
    const byId = Object.fromEntries(items.map(i => [i.dataset.id, i]));
    const doIt = () => {
      $$('.tier-h, .tier-empty', container).forEach(t => t.remove());
      if (order === 'evidence') {
        const tiers = JSON.parse(container.dataset.tiers || '[]');
        tiers.forEach(t => {
          const h = document.createElement('div'); h.className = 'tier-h'; h.textContent = t.label; container.appendChild(h);
          if (!t.ids.length) { const e = document.createElement('div'); e.className = 'tier-empty'; e.textContent = t.empty || 'NONE ON THIS SITE'; container.appendChild(e); }
          t.ids.forEach(id => byId[id] && container.appendChild(byId[id]));
        });
      } else {
        (container.dataset.sheetOrder || '').split(',').forEach(id => byId[id] && container.appendChild(byId[id]));
      }
    };
    if (canVT()) {
      items.forEach(i => { if (i.offsetParent !== null) i.style.viewTransitionName = 'spec-' + i.dataset.id; });
      const t = document.startViewTransition(doIt);
      t.finished.catch(() => {}).finally(() => items.forEach(i => i.style.viewTransitionName = ''));
    } else doIt();
  }
  $$('[data-sort-for]').forEach(group => {
    const target = document.getElementById(group.dataset.sortFor);
    $$('button[data-sort]', group).forEach(b => b.addEventListener('click', () => {
      $$('button[data-sort]', group).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      reorder(target, b.dataset.sort); target.dataset.sorted = b.dataset.sort;
      announce('Sorted by ' + b.dataset.sort + '.');
    }));
  });
  $$('[data-filter-for]').forEach(group => {
    const target = document.getElementById(group.dataset.filterFor);
    $$('button[data-filter]', group).forEach(b => b.addEventListener('click', () => {
      $$('button[data-filter]', group).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      const f = b.dataset.filter;
      const run = () => $$('[data-id]', target).forEach(i => { i.hidden = !(f === 'all' || (i.dataset.tags || '').split(' ').includes(f)); });
      if (canVT()) {
        const items = $$('[data-id]', target); items.forEach(i => { if (i.offsetParent !== null) i.style.viewTransitionName = 'spec-' + i.dataset.id; });
        const t = document.startViewTransition(run);
        t.finished.catch(() => {}).finally(() => items.forEach(i => i.style.viewTransitionName = ''));
      } else run();
      announce('Filter: ' + b.textContent.trim() + '.');
      target.dispatchEvent(new CustomEvent('filter:change', { bubbles: true, detail: { filter: f } }));
    }));
  });

  /* ---------- copy hex ---------- */
  $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); } catch (e) { return; }
    const h = $('.hex', b); if (!h) return; const old = h.textContent; h.textContent = 'COPIED'; announce(b.dataset.copy + ' copied.');
    setTimeout(() => h.textContent = old, 900);
  }));

  /* ---------- boxed words in the big sentence ---------- */
  const rules = $('.rules');
  if (rules && motionOK() && 'IntersectionObserver' in window) {
    $$('.boxed', rules).forEach((w) => {
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('aria-hidden', 'true'); s.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none';
      s.innerHTML = '<rect x="0" y="0" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" vector-effect="non-scaling-stroke"/>';
      w.appendChild(s);
    });
    rules.classList.add('armed');
    new IntersectionObserver((es) => es.forEach(e => {
      if (!e.isIntersecting) return;
      $$('rect', e.target).forEach(r => { r.style.transition = 'stroke-dashoffset 420ms cubic-bezier(.65,0,.35,1)'; r.setAttribute('stroke-dashoffset', '0'); });
    }), { threshold: .5 }).observe(rules);
    $$('.rule', rules).forEach(r => new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { $$('rect', r).forEach(x => { x.style.transition = 'stroke-dashoffset 420ms cubic-bezier(.65,0,.35,1)'; x.setAttribute('stroke-dashoffset', '0'); }); o.disconnect(); } }), { threshold: .6 }).observe(r));
  }

  /* ---------- explode fallback (no SDA) ---------- */
  if (!(CSS.supports && CSS.supports('animation-timeline: view()')) && motionOK() && 'IntersectionObserver' in window) {
    $$('.explode').forEach(x => {
      x.classList.add('io-armed');
      new IntersectionObserver((es) => es.forEach(e => x.classList.toggle('is-in', e.isIntersecting)), { threshold: .35 }).observe(x);
    });
  }

  /* ---------- tracer ---------- */
  $$('.tracer').forEach(t => {
    const run = () => { t.classList.remove('is-running'); void t.offsetWidth; t.classList.add('is-running'); };
    const b = $('[data-trace]', t.closest('figure') || t.parentElement); if (b) b.addEventListener('click', run);
    if ('IntersectionObserver' in window) new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { run(); o.disconnect(); } }), { threshold: .5 }).observe(t);
  });

  /* ---------- counters between documented endpoints ---------- */
  $$('[data-count-to]').forEach(el => {
    const to = Number(el.dataset.countTo), from = Number(el.dataset.countFrom || 0), dec = Number(el.dataset.dec || 0);
    if (!motionOK() || !('IntersectionObserver' in window)) return;
    new IntersectionObserver((es, o) => es.forEach(e => {
      if (!e.isIntersecting) return; o.disconnect();
      const t0 = performance.now(), dur = 800;
      const step = (now) => { const p = Math.min(1, (now - t0) / dur); el.textContent = (from + (to - from) * easeDraft(p)).toFixed(dec); if (p < 1) requestAnimationFrame(step); else el.textContent = to.toFixed(dec); };
      requestAnimationFrame(step);
    }), { threshold: .6 }).observe(el);
  });

  /* ---------- generic instrument: [data-instrument] with JSON states ---------- */
  $$('[data-instrument]').forEach(inst => {
    let states; try { states = JSON.parse($('script[type="application/json"]', inst).textContent); } catch (e) { return; }
    const range = $('input[type=range]', inst), out = $('.inst-readout', inst), steps = $$('[data-step]', inst);
    const set = (i, user) => {
      i = Math.max(0, Math.min(states.length - 1, i)); const s = states[i];
      inst.dataset.state = s.id; inst.style.setProperty('--state', i); inst.style.setProperty('--sn', i / Math.max(1, states.length - 1));
      Object.entries(s.vars || {}).forEach(([k, v]) => inst.style.setProperty(k, v));
      if (range) { range.value = i; range.setAttribute('aria-valuetext', s.valuetext || s.readout); }
      if (out) out.textContent = s.readout;
      steps.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
      inst.dispatchEvent(new CustomEvent('instrument:change', { detail: { index: i, state: s, user } }));
    };
    if (range) { range.min = 0; range.max = states.length - 1; range.step = 1; range.addEventListener('input', () => set(Number(range.value), true)); }
    steps.forEach((b, j) => b.addEventListener('click', () => set(j, true)));
    const play = $('[data-play]', inst);
    if (play) play.addEventListener('click', async () => { for (let i = 0; i < states.length; i++) { set(i, true); await sleep(motionOK() ? 900 : 0); } });
    set(Number(inst.dataset.start || 0), false);
  });

  /* ---------- scroll axis fallback ---------- */
  const axis = $('.axis-toc');
  if (axis && !(CSS.supports && CSS.supports('animation-timeline: scroll()'))) {
    let raf = 0;
    const upd = () => { raf = 0; const h = document.documentElement.scrollHeight - innerHeight; axis.style.setProperty('--p', h > 0 ? (scrollY / h).toFixed(4) : 0); };
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true }); upd();
  }

  /* ---------- loupe (MAG ×2) ---------- */
  $$('[data-loupe]').forEach(stage => {
    const src = stage.dataset.loupe; const img = $('.spec img', stage); if (!img) return;
    const lp = document.createElement('div'); lp.className = 'loupe'; lp.setAttribute('aria-hidden', 'true');
    lp.innerHTML = '<span></span><em>×2 · SOURCE 1960 PX</em>'; stage.appendChild(lp);
    const show = (ax, ay) => {
      const r = img.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      const fx = (ax - r.left) / r.width, fy = (ay - r.top) / r.height;
      const box = lp.firstChild; box.style.backgroundImage = `url(${src})`;
      box.style.backgroundSize = `${r.width * 2}px ${r.height * 2}px`;
      box.style.backgroundPosition = `${-(fx * r.width * 2 - 36)}px ${-(fy * r.height * 2 - 36)}px`;
      lp.style.left = (ax - sr.left) + 'px'; lp.style.top = (ay - sr.top) + 'px'; lp.classList.add('on');
    };
    $$('.callout[data-loupe-at]', stage).forEach(c => {
      const go = () => { const a = $(`.anc[data-anchor="${c.dataset.a}"], .overlay [data-anchor="${c.dataset.a}"]`, stage); if (!a) return; const b = a.getBoundingClientRect(); show(b.left + b.width / 2, b.top + b.height / 2); };
      c.addEventListener('mouseenter', go); c.addEventListener('focusin', go);
      c.addEventListener('mouseleave', () => lp.classList.remove('on')); c.addEventListener('focusout', () => lp.classList.remove('on'));
    });
  });

  /* ---------- logo construction once per session ---------- */
  const mark = $('.brand .mark');
  if (mark && motionOK() && !sread('mx-plotted')) { mark.classList.add('construct'); swrite('mx-plotted', '1'); }

  /* ---------- stamp: plotting state until hero decoded ---------- */
  const stamp = $('.stamp[data-plotting]');
  if (stamp) {
    const fin = stamp.innerHTML; stamp.textContent = stamp.dataset.plotting;
    const hero = $('[fetchpriority="high"]');
    Promise.race([hero && hero.decode ? hero.decode().catch(() => {}) : Promise.resolve(), sleep(1800)]).then(() => stamp.innerHTML = fin);
  }

  /* ---------- local time (ships off) ---------- */
  if (root.dataset.localTime === 'on') {
    const el = $('.localtime'); const tz = root.dataset.tz || 'Europe/Paris';
    const f = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz });
    const tick = () => { if (!document.hidden && el) el.textContent = 'LOCAL TIME · ' + (root.dataset.city || '') + ' ' + f.format(new Date()); setTimeout(tick, 60000 - Date.now() % 60000); };
    tick();
  }

  /* ---------- cross-document morph: name only the clicked thumbnail ---------- */
  window.addEventListener('pageswap', (e) => {
    if (!e.viewTransition) return;
    $$('[style*="view-transition-name: specimen"]').forEach(x => x.style.viewTransitionName = '');
    const a = document.activeElement && document.activeElement.closest && document.activeElement.closest('a[data-morph]');
    const last = window.__mxLastClick;
    const src = (last && last.closest('a[data-morph]')) || a;
    const img = src && $('img', src);
    if (img) img.style.viewTransitionName = 'specimen';
  });
  document.addEventListener('click', (e) => { window.__mxLastClick = e.target; }, true);

  /* public hooks for page scripts */
  window.mx = Object.assign(window.mx || {}, { replot, arm, reorder, announce });

  /* QA: ?solo=<id> is handled by the inline head script (CSS only). */
})();
