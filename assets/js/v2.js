/* MALINYX V2 motion. Turntable / scrub / switch mechanics ported from the approved /objects page (3 Oct 2026),
   plus: the 3D collection ring, page-colour transitions, tilt, cursor, lightbox. Image-based, no WebGL. */
(() => {
window.__mx = 1;   /* tells the head script the reveals will run */
const M = JSON.parse((document.getElementById("manifest") || { textContent: '{"seq":{}}' }).textContent);
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const QA = document.documentElement.classList.contains("qa"); /* headless shots: final values, no count-up */
const FINE = matchMedia("(hover:hover) and (pointer:fine)").matches;
const DPR = Math.min(2, window.devicePixelRatio || 1);
const small = () => innerWidth < 700;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ---------- image sequences (progressive loading: frame 0, coarse ring, fill) ---------- */
class Seq {
  constructor(key, spec, sz) { this.key = key; this.spec = spec; this.sz = sz; this.n = spec.n; this.imgs = new Array(this.n); this.ok = new Array(this.n).fill(false); this.cb = []; this.started = false; this.done = 0; }
  url(i) { const s = this.spec, z = this.sz || (small() && s.small ? "s" : "l"); return `${s.dir}/${s.small ? z : "l"}/${String(i).padStart(3, "0")}.${s.ext || "jpg"}`; }
  order() { const o = [0], seen = new Set(o); for (const st of [9, 6, 3, 1]) for (let i = 0; i < this.n; i += st) if (!seen.has(i)) { seen.add(i); o.push(i); } return o; }
  start() {
    if (this.started) return; this.started = true; const q = this.order(); let inflight = 0;
    const next = () => { while (inflight < 4 && q.length) { const i = q.shift(); inflight++; const im = new Image(); im.decoding = "async";
      im.onload = () => { this.imgs[i] = im; this.ok[i] = true; this.done++; inflight--; this.cb.forEach(f => f(i)); next(); };
      im.onerror = () => { inflight--; this.done++; next(); }; im.src = this.url(i); } };
    next();
  }
  nearest(i) { i = ((Math.round(i) % this.n) + this.n) % this.n; if (this.ok[i]) return this.imgs[i];
    for (let d = 1; d < this.n; d++) { const a = (i + d) % this.n, b = (i - d + this.n) % this.n; if (this.ok[a]) return this.imgs[a]; if (this.ok[b]) return this.imgs[b]; } return null; }
  clampNearest(i) { i = clamp(Math.round(i), 0, this.n - 1); if (this.ok[i]) return this.imgs[i];
    for (let d = 1; d < this.n; d++) { if (i - d >= 0 && this.ok[i - d]) return this.imgs[i - d]; if (i + d < this.n && this.ok[i + d]) return this.imgs[i + d]; } return null; }
}
const SEQ = {}; const seq = (k, sz) => (SEQ[k + "|" + (sz || "")] ||= new Seq(k, M.seq[k], sz));
/* a stage gets the 1000 px frames only when it is drawn wider than ~800 device pixels */
const szFor = el => (el.clientWidth * DPR > 800 ? "l" : "s");
function fitCanvas(cv) { const r = cv.getBoundingClientRect(); const w = Math.round(r.width * DPR), h = Math.round(r.height * DPR); if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; } return cv.getContext("2d"); }
function draw(cv, img) { if (!img) return; const ctx = fitCanvas(cv); const s = Math.max(cv.width / img.width, cv.height / img.height);
  const w = img.width * s, h = img.height * s; ctx.imageSmoothingQuality = "high"; ctx.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h); }

/* ---------- turntable: drag with inertia, slow idle turn ---------- */
class Turntable {
  constructor(stage, key) {
    this.stage = stage; this.cv = stage.querySelector("canvas"); this.ring = stage.querySelector(".load .fg"); this.f = 0; this.v = RM ? 0 : 0.9;
    this.drag = null; this.idle = true; this.vis = false; this.dirty = true; this.sz = szFor(stage); this.last = -1; this.set(key);
    stage.setAttribute("role", "slider"); stage.setAttribute("aria-valuemin", "0"); stage.setAttribute("aria-valuemax", "359"); this.aria();
    stage.addEventListener("pointerdown", e => { if (stage.classList.contains("still")) return; this.drag = { x: e.clientX, f: this.f, t: performance.now(), lx: e.clientX }; this.v = 0; this.idle = false; stage.setPointerCapture(e.pointerId); stage.classList.add("touched"); });
    stage.addEventListener("pointermove", e => { if (!this.drag) return; const dx = e.clientX - this.drag.x; const per = stage.clientWidth / (this.s.n * 0.55);
      const now = performance.now(), dt = Math.max(1, now - this.drag.t); this.v = clamp(-(e.clientX - this.drag.lx) / per / dt * 16.7 * 60, -60, 60);
      this.drag.t = now; this.drag.lx = e.clientX; this.f = this.drag.f - dx / per; this.dirty = true; });
    const up = () => { if (!this.drag) return; this.drag = null; clearTimeout(this.it); this.it = setTimeout(() => { this.idle = !RM; }, 4000); };
    stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
    stage.tabIndex = 0; stage.addEventListener("keydown", e => { if (stage.classList.contains("still")) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { this.f += e.key === "ArrowLeft" ? -1 : 1; this.idle = false; this.dirty = true; this.aria(); e.preventDefault(); } });
    new IntersectionObserver(es => es.forEach(en => { this.vis = en.isIntersecting; if (this.vis) { this.s.start(); this.loop(); } }), { rootMargin: "60% 0px" }).observe(stage);
    addEventListener("resize", () => { this.dirty = true; this.last = -1; });
  }
  set(key) { this.key = key; this.s = seq(key, this.sz); this.s.cb.push(() => { this.dirty = true; this.last = -1; this.progress(); }); if (this.vis) this.s.start(); this.dirty = true; this.last = -1; this.progress(); }
  aria() { const n = this.s ? this.s.n : 36, d = Math.round((((Math.round(this.f) % n) + n) % n) * 360 / n); this.stage.setAttribute("aria-valuenow", d); this.stage.setAttribute("aria-valuetext", `Rotated ${d}°`); }
  progress() { const p = this.s.done / this.s.n; if (this.ring) this.ring.style.strokeDashoffset = 75.4 * (1 - p); this.stage.classList.toggle("ready", this.s.ok[0] && p > 0.25); }
  loop() { if (this.raf) return; let last = performance.now();
    const tick = now => { const dt = Math.min(64, now - last) / 1000; last = now;
      if (!this.drag) { if (Math.abs(this.v) > 0.05) { this.f += this.v * dt; this.v *= Math.pow(0.04, dt); this.dirty = true; }
        else if (this.idle && !RM) { this.f += 1.6 * dt; this.dirty = true; } }
      /* idle turning advances f every tick, but a new picture is needed only when the frame index changes */
      if (this.dirty) { const k = ((Math.round(this.f) % this.s.n) + this.s.n) % this.s.n; if (k !== this.last) { const im = this.s.nearest(this.f); if (im) { draw(this.cv, im); this.last = this.s.ok[k] ? k : -1; } } this.dirty = false; }
      this.raf = this.vis ? requestAnimationFrame(tick) : 0; };
    this.raf = requestAnimationFrame(tick); }
}
const TT = {}; $$(".stage[data-seq]").forEach(st => { if (M.seq[st.dataset.seq]) TT[st.id] = new Turntable(st, st.dataset.seq); });

/* switches between sequences / stills inside a stage, with a glass wipe */
$$("[data-switch]").forEach(group => {
  const stage = document.getElementById(group.dataset.switch); if (!stage) return; const tt = TT[stage.id]; const wipe = stage.querySelector(".wipe");
  const load = l => { if (l && l.dataset.src && !l.getAttribute("src")) { if (l.dataset.srcset) l.srcset = l.dataset.srcset; l.src = l.dataset.src; } };
  const warm = () => $$(".layer[data-src]", stage).forEach(load);
  group.addEventListener("pointerenter", warm, { once: true }); group.addEventListener("focusin", warm, { once: true }); if (QA) warm();
  $$(".chip", group).forEach(b => b.addEventListener("click", () => {
    $$(".chip", group).forEach(x => x.setAttribute("aria-pressed", x === b));
    if (wipe && !RM) { wipe.classList.remove("go"); void wipe.offsetWidth; wipe.classList.add("go"); }
    $$(".layer", stage).forEach(l => { if (l.dataset.k === b.dataset.still) load(l); l.classList.toggle("on", l.dataset.k === b.dataset.still); }); stage.classList.toggle("still", !!b.dataset.still);
    if (tt) { stage.tabIndex = b.dataset.still ? -1 : 0; stage.setAttribute("role", b.dataset.still ? "img" : "slider"); }
    if (b.dataset.seq && tt && M.seq[b.dataset.seq]) setTimeout(() => tt.set(b.dataset.seq), RM ? 0 : 260);
    if (b.dataset.room) stage.style.setProperty("--room", b.dataset.room);
    if (b.dataset.caption) { const c = document.getElementById(group.dataset.caption); if (c) c.textContent = b.dataset.caption; }
  }));
});

/* ---------- scroll-scrubbed sequences ---------- */
const SCRUBS = $$(".scrub").filter(sec => M.seq[sec.dataset.seq]).map(sec => ({ sec, cv: sec.querySelector("canvas"), s: seq(sec.dataset.seq), caps: $$(".cap p", sec), last: -1 }));
SCRUBS.forEach(o => { o.s.cb.push(() => { o.last = -1; }); new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) o.s.start(); }), { rootMargin: "120% 0px" }).observe(o.sec); });

/* ---------- the collection ring ---------- */
const RINGS = $$(".ring-sec").map(sec => {
  const ring = sec.querySelector(".ring"), items = $$(".item", ring), n = items.length, stage = sec.querySelector(".ring-stage");
  const nowB = sec.querySelector(".now b"), nowS = sec.querySelector(".now span"), go = sec.querySelector(".go"), dots = $$(".dots i", sec);
  const o = { sec, ring, items, n, stage, step: 360 / n, drag: 0, dv: 0, active: -1, spin: null, to: null, ang: 0, say: false };
  const live = sec.querySelector("[data-ring-live]"), hint = sec.querySelector("[data-rm]"); if (RM && hint) hint.textContent = hint.dataset.rm;
  const layout = () => { const cw = clamp(innerWidth * (innerWidth < 760 ? 0.56 : 0.2), 200, 340); const R = cw / (2 * Math.tan(Math.PI / n)) * 1.12;
    ring.style.setProperty("--cw", cw + "px"); ring.style.setProperty("--R", R + "px"); ring.style.setProperty("--step", o.step + "deg"); };
  layout(); addEventListener("resize", layout);
  /* drag turns the ring; capture only once it is a real drag, so a plain click still opens a card */
  let px = null, moved = 0;
  stage.addEventListener("pointerdown", e => { px = e.clientX; moved = 0; o.dv = 0; o.to = null; });
  stage.addEventListener("pointermove", e => { if (px == null) return; const dx = e.clientX - px; moved += Math.abs(dx);
    if (moved > 6 && !stage.hasPointerCapture(e.pointerId)) stage.setPointerCapture(e.pointerId);
    const d = dx * 0.11; o.drag += d; o.dv = d; px = e.clientX; });
  const up = () => { if (px != null && moved > 6) o.say = true; px = null; }; stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
  stage.addEventListener("dragstart", e => e.preventDefault());
  /* a click on a side card turns it to the front instead of opening it */
  stage.addEventListener("click", e => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); moved = 0; return; }
    const it = e.target.closest(".item"); if (!it) return; const i = items.indexOf(it);
    if (i !== o.active) { e.preventDefault(); const a = ((i * o.step + o.ang) % 360 + 540) % 360 - 180; o.to = o.drag - a; o.say = true; } }, true);
  o.setActive = i => { if (i === o.active) return; o.active = i; const it = items[i];
    if (nowB) nowB.textContent = it.dataset.name; if (nowS) nowS.textContent = it.dataset.line; if (go) go.href = it.getAttribute("href");
    dots.forEach((d, j) => d.classList.toggle("on", j === i));
    if (o.say && live && o.to == null) { live.textContent = `${it.dataset.name}: ${it.dataset.line}`; o.say = false; }
    clearInterval(o.spin); o.spin = null; const key = it.dataset.seq; const img = it.querySelector("img");
    if (key && M.seq[key] && img && !RM) { const s = seq(key, "s"); s.start(); let f = 0; o.spin = setInterval(() => { f = (f + 1) % s.n; const im = s.nearest(f); if (im) img.src = im.src; }, 90); } };
  return o;
});

/* ---------- reveals, counters, page colour ---------- */
const io = new IntersectionObserver(es => es.forEach(en => { if (!en.isIntersecting) return; en.target.classList.add("in"); io.unobserve(en.target);
  const w = en.target.querySelector(".wipe"); if (w && !RM) setTimeout(() => { w.classList.remove("go"); void w.offsetWidth; w.classList.add("go"); }, 500);
  $$("[data-count]", en.target).forEach(countUp); if (en.target.matches("[data-count]")) countUp(en.target); }), { threshold: 0.18 });
$$("[data-reveal]").forEach(el => io.observe(el));
function countUp(el) { if (el._done) return; el._done = true; const to = parseFloat(el.dataset.count), dec = +el.dataset.dec || 0, pre = el.dataset.pre || "", suf = el.dataset.suf || "";
  if (RM || QA) { el.textContent = pre + to.toFixed(dec) + suf; return; } const t0 = performance.now(), D = 1600;
  const f = now => { const p = clamp((now - t0) / D, 0, 1), e = 1 - Math.pow(1 - p, 4); el.textContent = pre + (to * e).toFixed(dec) + suf; if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }
const bgio = new IntersectionObserver(es => es.forEach(en => { if (!en.isIntersecting) return; const b = en.target.dataset.bg;
  document.body.classList.toggle("paper", b === "paper"); document.body.style.backgroundColor = b === "paper" ? "var(--paper)" : (b === "ink" ? "var(--ink)" : b); }), { rootMargin: "-45% 0px -45% 0px" });
$$("[data-bg]").forEach(el => bgio.observe(el));

/* original / re-engineered toggles */
$$(".then").forEach(fig => $$(".tog button", fig).forEach(b => b.addEventListener("click", () => {
  $$(".tog button", fig).forEach(x => x.setAttribute("aria-pressed", x === b)); fig.classList.toggle("now", b.dataset.v === "now");
  const cap = fig.querySelector("figcaption"); if (cap) cap.textContent = b.dataset.v === "now" ? fig.dataset.now : fig.dataset.then; })));

/* cards: hover turns the object through its frames */
$$(".wcard[data-seq],.fcard[data-seq]").forEach(card => { const img = card.querySelector(".pic img"); const key = card.dataset.seq; if (!M.seq[key] || !img) return; let t = null, i = 0;
  card.addEventListener("pointerenter", () => { if (RM) return; if (img.srcset) img.removeAttribute("srcset"); const s = seq(key, "s"); s.start(); t = setInterval(() => { i = (i + 1) % s.n; const im = s.nearest(i); if (im) img.src = im.src; }, s.n <= 12 ? 650 : 70); });
  card.addEventListener("pointerleave", () => clearInterval(t)); });
if (FINE) $$(".wcard img.alt[data-src]").forEach(a => a.closest(".wcard").addEventListener("pointerenter", () => { if (!a.getAttribute("src")) a.src = a.dataset.src; }, { once: true }));

/* filters (work index, field notes): hide non-matching cards, hide groups left empty, announce the count */
$$("[data-filter-for]").forEach(group => { const target = document.getElementById(group.dataset.filterFor); const out = document.querySelector(`[data-count-for="${group.dataset.filterFor}"]`);
  const label = f => f === "all" ? "" : ` · ${(group.querySelector(`button[data-filter="${CSS.escape(f)}"]`)?.firstChild?.textContent || f).trim()}`;
  $$("button[data-filter]", group).forEach(b => b.addEventListener("click", () => {
    $$("button[data-filter]", group).forEach(x => x.setAttribute("aria-pressed", x === b)); const f = b.dataset.filter;
    const run = () => { let n = 0; $$("[data-tags]", target).forEach(c => { const on = f === "all" || c.dataset.tags.split(" ").includes(f); c.hidden = !on; if (on) n++; });
      $$("[data-group]", target).forEach(g => { const k = $$("[data-tags]:not([hidden])", g).length; g.hidden = !k; const gc = g.querySelector("[data-gcount]"); if (gc) gc.textContent = k; });
      const noun = (out && out.dataset.noun) || "project"; if (out) out.textContent = `${n} ${noun}${n === 1 ? "" : "s"}${label(f)}`; };
    if (document.startViewTransition && !RM) document.startViewTransition(run); else run(); }));
  const h = location.hash.slice(1); const hb = h && group.querySelector(`button[data-filter="${CSS.escape(h)}"]`);
  if (hb) { hb.click(); group.scrollIntoView({ block: "start" }); }
  else if (h && document.getElementById(h) && target && target.contains(document.getElementById(h))) document.getElementById(h).scrollIntoView({ block: "start" }); });

/* tilt toward the pointer */
if (!RM && FINE) $$(".stage,.wcard,.fcard").forEach(st => {
  st.addEventListener("pointermove", e => { if (e.buttons) { st.style.setProperty("--tx", 0); st.style.setProperty("--ty", 0); return; }
    const r = st.getBoundingClientRect(); st.style.setProperty("--tx", ((e.clientX - r.left) / r.width - .5).toFixed(3)); st.style.setProperty("--ty", ((e.clientY - r.top) / r.height - .5).toFixed(3)); });
  st.addEventListener("pointerleave", () => { st.style.setProperty("--tx", 0); st.style.setProperty("--ty", 0); });
});

/* cursor: a small dot that becomes "Drag" / "Open" */
const cur = document.querySelector(".cursor");
if (cur && FINE && !RM) { let cx = 0, cy = 0, x = 0, y = 0;
  addEventListener("pointermove", e => { x = e.clientX; y = e.clientY; cur.classList.add("on"); const t = e.target.closest && e.target.closest("[data-cursor]");
    cur.classList.toggle("big", !!t); cur.textContent = t ? t.dataset.cursor : ""; }, { passive: true });
  document.addEventListener("pointerleave", () => cur.classList.remove("on"));
  let raf = 0; const loop = () => { cx += (x - cx) * 0.22; cy += (y - cy) * 0.22; cur.style.transform = `translate3d(${cx}px,${cy}px,0)`;
    raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.2 ? requestAnimationFrame(loop) : 0; };
  addEventListener("pointermove", () => { if (!raf) raf = requestAnimationFrame(loop); }, { passive: true }); }

/* lightbox: every a[data-lb] on the page, in reading order. Keyboard (← → Esc Tab-trapped), swipe, zoom for drawings and boards,
   "Open original" for the full file, focus returned to the image you came from. Without JS the links simply open the image. */
const lb = document.querySelector(".lb");
if (lb) {
  /* one entry per picture: a figure shown twice on a page opens at its first place in the sequence */
  const links = $$("a[data-lb]"), items = [], at = new Map();
  links.forEach(a => { if (!at.has(a.href)) { at.set(a.href, items.length); items.push(a); } });
  const stageEl = lb.querySelector(".lb-stage"), im = stageEl.querySelector("img"), txt = lb.querySelector(".lb-text"), typ = lb.querySelector(".lb-type"),
    cnt = lb.querySelector(".lb-count"), zoomB = lb.querySelector(".lb-zoom"), openA = lb.querySelector(".lb-open"), prevB = lb.querySelector(".lb-prev"), nextB = lb.querySelector(".lb-next"),
    closeB = lb.querySelector(".lb-close"), say = lb.querySelector(".lb-live");
  let cur = -1, opener = null, hideT = 0, opened = false;   /* the state is set at once; the "on" class only drives the fade */
  const isOn = () => opened, zoomed = () => lb.classList.contains("zoom");
  lb.tabIndex = -1; lb.classList.toggle("single", items.length < 2);
  /* zoom: drawings (SVG) to a reading size, photographs to their own pixels — never upscaled */
  const zoomW = () => { const svg = im.classList.contains("svg"), nat = im.naturalWidth || 0;
    return svg ? Math.min(3600, Math.max(stageEl.clientWidth * 1.9, 2400)) : nat; };
  const canZoom = () => im.classList.contains("svg") || (im.naturalWidth || 0) > im.clientWidth * 1.15;
  const setZoom = on => { on = on && canZoom(); lb.classList.toggle("zoom", on); zoomB.setAttribute("aria-pressed", on);
    if (on) { im.style.setProperty("--zw", zoomW() + "px"); stageEl.tabIndex = 0; stageEl.setAttribute("aria-label", "Zoomed image — use the arrow keys to pan");
      requestAnimationFrame(() => { stageEl.scrollLeft = (stageEl.scrollWidth - stageEl.clientWidth) / 2; stageEl.scrollTop = 0; }); }
    else { im.style.removeProperty("--zw"); stageEl.removeAttribute("tabindex"); stageEl.removeAttribute("aria-label"); } };
  const sync = () => { zoomB.hidden = !canZoom(); };
  im.addEventListener("load", sync);
  const show = i => { cur = (i + items.length) % items.length; const a = items[cur];
    setZoom(false); im.classList.toggle("svg", /\.svg($|\?)/.test(a.href)); zoomB.hidden = false; im.src = a.href; im.alt = a.querySelector("img")?.alt || a.dataset.cap || "";
    txt.textContent = a.dataset.cap || ""; typ.textContent = a.dataset.type || ""; cnt.textContent = items.length > 1 ? `${cur + 1} / ${items.length}` : ""; openA.href = a.href;
    if (im.complete) sync();
    if (say) say.textContent = `${items.length > 1 ? `Image ${cur + 1} of ${items.length}. ` : ""}${a.dataset.cap || ""}`;
    if (isOn() && !lb.contains(document.activeElement)) closeB.focus(); };
  const open = (i, from) => { clearTimeout(hideT); opener = from || document.activeElement; opened = true; show(i); lb.hidden = false; document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(() => { if (opened) lb.classList.add("on"); }); closeB.focus(); };
  const close = () => { opened = false; lb.classList.remove("on"); setZoom(false); document.documentElement.style.overflow = ""; clearTimeout(hideT);
    hideT = setTimeout(() => { lb.hidden = true; im.removeAttribute("src"); }, RM ? 0 : 320);
    if (opener && opener.focus) opener.focus({ preventScroll: true }); };
  links.forEach(a => a.addEventListener("click", e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); open(at.get(a.href), a); }));
  prevB.addEventListener("click", () => show(cur - 1)); nextB.addEventListener("click", () => show(cur + 1)); closeB.addEventListener("click", close);
  zoomB.addEventListener("click", () => setZoom(!zoomed()));
  im.addEventListener("dblclick", () => setZoom(!zoomed()));
  lb.addEventListener("click", e => { if (e.target === stageEl && !zoomed()) close(); });
  /* keys work wherever focus is while the viewer is open (a click on the picture used to drop them) */
  document.addEventListener("keydown", e => { if (!isOn()) return;
    if (e.key === "Escape") { e.preventDefault(); if (zoomed()) { setZoom(false); zoomB.focus(); } else close(); }
    else if (zoomed() && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) { e.preventDefault();
      stageEl.scrollBy({ left: { ArrowLeft: -160, ArrowRight: 160 }[e.key] || 0, top: { ArrowUp: -160, ArrowDown: 160 }[e.key] || 0 }); }
    else if (e.key === "ArrowRight" && items.length > 1) { e.preventDefault(); show(cur + 1); }
    else if (e.key === "ArrowLeft" && items.length > 1) { e.preventDefault(); show(cur - 1); }
    else if (e.key === "Tab") { const f = $$("button:not([hidden]),a[href],[tabindex='0']", lb).filter(x => x.offsetParent !== null); if (!f.length) return;
      const first = f[0], last = f[f.length - 1], ae = document.activeElement;
      if (!lb.contains(ae) || ae === lb) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && ae === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && ae === last) { e.preventDefault(); first.focus(); } } });
  /* focus never leaves the open dialog (guarded on .on, which close() clears before it hands focus back) */
  document.addEventListener("focusin", e => { if (isOn() && !lb.contains(e.target)) closeB.focus(); });
  /* swipe (touch) when not zoomed */
  let sx = null, sy = 0; stageEl.addEventListener("touchstart", e => { if (zoomed() || e.touches.length > 1) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  stageEl.addEventListener("touchend", e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4 && items.length > 1) show(cur + (dx < 0 ? 1 : -1)); }, { passive: true });
  /* drag to pan when zoomed (mouse) */
  let pan = null; stageEl.addEventListener("pointerdown", e => { if (!zoomed() || e.pointerType !== "mouse") return; pan = { x: e.clientX, y: e.clientY, l: stageEl.scrollLeft, t: stageEl.scrollTop }; e.preventDefault(); });
  addEventListener("pointermove", e => { if (!pan) return; stageEl.scrollLeft = pan.l - (e.clientX - pan.x); stageEl.scrollTop = pan.t - (e.clientY - pan.y); });
  addEventListener("pointerup", () => { pan = null; });
}

/* copy email: clipboard API, a fallback, and a spoken + visible confirmation */
const copyStatus = document.getElementById("copy-status");
$$("[data-copy]").forEach(b => { const label = b.querySelector(".cl") || b; const orig = label.textContent; let t = null;
  const pick = () => { const big = document.querySelector(`a.contact-big[href="mailto:${b.dataset.copy}"]`); if (!big) return false;
    try { const sel = getSelection(); sel.removeAllRanges(); sel.selectAllChildren(big); return true; } catch (e) { return false; } };
  const done = (ok) => { b.classList.toggle("done", ok); const sel = !ok && pick();
    label.textContent = ok ? "Copied ✓" : (sel ? "Selected — copy it" : b.dataset.copy);
    if (copyStatus) copyStatus.textContent = ok ? `Email address copied: ${b.dataset.copy}` : (sel ? `Copy failed. The address ${b.dataset.copy} is selected on the page.` : `Copy failed. The address is ${b.dataset.copy}.`);
    clearTimeout(t); t = setTimeout(() => { b.classList.remove("done"); label.textContent = orig; if (copyStatus) copyStatus.textContent = ""; }, 2600); };
  const fallback = () => { const ta = document.createElement("textarea"); ta.value = b.dataset.copy; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;left:-9999px;top:0";
    document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (e) {} ta.remove(); return ok; };
  b.addEventListener("click", () => { const v = b.dataset.copy;
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(v).then(() => done(true), () => done(fallback()));
    else done(fallback()); }); });

/* archive index: a small preview follows the pointer (fine pointers only, never under reduced motion) */
const ip = document.querySelector(".idx-prev");
if (ip && FINE && !RM) { const pim = ip.querySelector("img"); let px = 0, py = 0, on = false;
  $$(".index a[data-prev]").forEach(a => { a.addEventListener("pointerenter", () => { pim.src = a.dataset.prev; on = true; ip.classList.add("on"); });
    a.addEventListener("pointerleave", () => { on = false; ip.classList.remove("on"); }); });
  addEventListener("pointermove", e => { px = e.clientX; py = e.clientY; if (on) ip.style.transform = `translate3d(${Math.min(px + 28, innerWidth - 240)}px,${Math.max(16, py - 140)}px,0)`; }, { passive: true }); }

/* ---------- one rAF: hero parallax, scrubs, ring ---------- */
const root = document.documentElement; let mx = 0, my = 0, tx = 0, ty = 0;
addEventListener("pointermove", e => { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; }, { passive: true });
function frame() {
  mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
  const hp = RM ? 0 : clamp(scrollY / innerHeight, 0, 1.2); root.style.setProperty("--hp", hp.toFixed(4));
  if (!RM) { root.style.setProperty("--mx", mx.toFixed(4)); root.style.setProperty("--my", my.toFixed(4)); }
  for (const o of SCRUBS) { const r = o.sec.getBoundingClientRect(); const p = clamp(-r.top / (r.height - innerHeight), 0, 1); o.sec.style.setProperty("--p", p.toFixed(4));
    const idx = Math.round(p * (o.s.n - 1)); if (r.bottom > 0 && r.top < innerHeight && idx !== o.last) { const im = o.s.clampNearest(idx); if (im) { draw(o.cv, im); o.last = idx; } }
    o.caps.forEach(c => c.classList.toggle("on", p >= +c.dataset.from && p < +c.dataset.to)); }
  for (const o of RINGS) { const r = o.sec.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) { if (o.spin) { clearInterval(o.spin); o.spin = null; o.active = -1; } continue; }
    const p = clamp(-r.top / Math.max(1, r.height - innerHeight), 0, 1);
    if (o.to != null) { o.drag += (o.to - o.drag) * (RM ? 1 : 0.12); if (Math.abs(o.to - o.drag) < 0.05) { o.drag = o.to; o.to = null; } }
    else if (Math.abs(o.dv) > 0.01) { o.drag += o.dv; o.dv *= 0.86; }
    const ang = RM ? o.drag : -(p * (o.n - 1)) * o.step + o.drag; o.ang = ang;
    o.ring.style.setProperty("--ang", ang.toFixed(2) + "deg");
    let best = 0, bi = 0;
    o.items.forEach((it, i) => { const a = ((i * o.step + ang) % 360 + 540) % 360 - 180; const front = Math.max(0, Math.cos(a * Math.PI / 180)); it.style.setProperty("--front", front.toFixed(3)); it.style.zIndex = Math.round(front * 100); it.tabIndex = front > .9 ? 0 : -1; if (front > best) { best = front; bi = i; } });
    o.setActive(bi); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener("resize", () => SCRUBS.forEach(o => o.last = -1));
/* Cross-Tool Command Palette matcher — a port of cross_tool_command_palette.py v0.3.0 (find_best_matches + execute's decision rules) */
const PAL = (() => {
  function longest(a, b, alo, ahi, blo, bhi) {   // difflib.SequenceMatcher.find_longest_match, no junk
    let bi = alo, bj = blo, bs = 0, prev = new Map();
    for (let i = alo; i < ahi; i++) { const cur = new Map();
      for (let j = blo; j < bhi; j++) if (a[i] === b[j]) { const k = (prev.get(j - 1) || 0) + 1; cur.set(j, k); if (k > bs) { bi = i - k + 1; bj = j - k + 1; bs = k; } }
      prev = cur; }
    return [bi, bj, bs];
  }
  function ratio(a, b) {   // difflib.SequenceMatcher(None, a, b).ratio()
    let m = 0; const q = [[0, a.length, 0, b.length]];
    while (q.length) { const [alo, ahi, blo, bhi] = q.pop(); const [i, j, k] = longest(a, b, alo, ahi, blo, bhi);
      if (k) { m += k; if (alo < i && blo < j) q.push([alo, i, blo, j]); if (i + k < ahi && j + k < bhi) q.push([i + k, ahi, j + k, bhi]); } }
    const t = a.length + b.length; return t ? 2 * m / t : 1;
  }
  function tokens(text, stop) {
    const words = Array.from(text.toLowerCase()).map(c => /[\p{L}\p{N}]/u.test(c) ? c : " ").join("").split(/\s+/).filter(Boolean);
    const meaningful = words.filter(w => !stop.has(w)); return meaningful.length ? meaningful : words;
  }
  function synScore(qt, syn, stop, tok) {
    const st = tokens(syn, stop); if (!qt.length || !st.length) return 0;
    let strength = 0; const hit = new Set();
    for (const s of st) { let best = 0, bq = null; for (const w of qt) { const r = ratio(w, s); if (r > best) { best = r; bq = w; } }
      if (best >= tok) { strength += best; hit.add(bq); } }
    return 0.7 * (strength / st.length) + 0.3 * (hit.size / qt.length);
  }
  function decide(query, D) {
    const stop = new Set(D.stop);
    if (!query.trim()) return { kind: "empty", text: "Type a command first.", ranked: [] };
    const qt = tokens(query, stop);
    const ranked = D.commands.map(c => ({ c, s: Math.max(...c.synonyms.map(x => synScore(qt, x, stop, D.token))) }))
      .sort((x, y) => y.s - x.s).slice(0, 3);   // stable sort, like Python's
    const top = ranked[0];
    if (top.s < D.accept) {
      if (top.s <= 0) return { kind: "refuse", ranked, text: `No confident match for “${query}”. Known terms: ${D.commands.map(c => c.label).join(", ")}.` };
      return { kind: "refuse", ranked, text: `No confident match for “${query}”. Closest: ${ranked.filter(r => r.s > 0).map(r => r.c.label).join(", ")}.` };
    }
    if (ranked.length > 1 && (top.s - ranked[1].s) < D.ambiguity)
      return { kind: "ambiguous", ranked, text: `“${query}” is ambiguous between: ${ranked.filter(r => (top.s - r.s) < D.ambiguity).map(r => r.c.label).join(", ")}. Be more specific.` };
    if (top.c.label === "Extrude") return { kind: "decline", ranked, text: `[Extrude] ${top.c.action} ${top.c.note}` };
    return { kind: "run", ranked, text: `[${top.c.label}] ${top.c.action} ${top.c.note}` };
  }
  return { ratio, tokens, decide };
})();

/* Cross-Tool palette demo: what the add-on would do with what you type */
const palEl = document.querySelector("[data-palette]"), palData = document.getElementById("palette-data");
if (palEl && palData) { const D = JSON.parse(palData.textContent); const inp = palEl.querySelector("input"), list = palEl.querySelector(".pal-results"), verdict = palEl.querySelector(".pal-verdict");
  const esc = t => t.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const head = { run: "Runs", decline: "Declines", ambiguous: "Asks", refuse: "Refuses", empty: "" };
  const render = () => { const r = PAL.decide(inp.value, D); palEl.dataset.kind = r.kind;
    list.innerHTML = r.ranked.map((x, i) => `<li${i === 0 && (r.kind === "run" || r.kind === "decline") ? ' class="win"' : ""}><span class="lab">${esc(x.c.label)}</span><span class="pal-meter"><i style="width:${Math.max(0, Math.min(100, x.s * 100)).toFixed(1)}%"></i></span><span class="mono sc">${x.s.toFixed(2)}</span></li>`).join("");
    verdict.innerHTML = r.kind === "empty" ? esc(r.text) : `<b>${head[r.kind]}</b> ${esc(r.text)}`; };
  inp.addEventListener("input", render);
  $$(".pal-tries .chip", palEl).forEach(b => b.addEventListener("click", () => { inp.value = b.textContent; render(); inp.focus(); }));
  render(); }

/* Field Notes: the hero cycles through the twelve notes */
$$("[data-cycle]").forEach(box => { const items = $$(".nc", box); let i = 0, t = null, paused = RM || QA, hold = false; const pb = box.querySelector("[data-pause]");
  const show = k => { i = (k + items.length) % items.length; items.forEach((x, j) => { x.classList.toggle("on", j === i); x.setAttribute("aria-hidden", j !== i); }); };
  const run = () => { clearInterval(t); t = null; if (!paused && !hold) t = setInterval(() => show(i + 1), 5200); };
  const setP = p => { paused = p; if (pb) { pb.setAttribute("aria-pressed", p); pb.textContent = p ? "Play" : "Pause"; } run(); };
  $$("[data-step]", box).forEach(b => b.addEventListener("click", () => { show(i + +b.dataset.step); setP(true); }));
  if (pb) pb.addEventListener("click", () => setP(!paused));
  box.addEventListener("pointerenter", () => { hold = true; run(); }); box.addEventListener("pointerleave", () => { hold = false; run(); });
  box.addEventListener("focusin", () => { hold = true; run(); }); box.addEventListener("focusout", e => { if (!box.contains(e.relatedTarget)) { hold = false; run(); } });
  show(0); setP(paused); });

/* Colourway index: a tile picks its pair on the stage above */
$$("[data-pick]").forEach(b => b.addEventListener("click", () => { const c = $$(`[data-switch="${b.dataset.pick}"] .chip`)[+b.dataset.k];
  if (c) { c.click(); document.getElementById(b.dataset.pick).scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "center" }); } }));
})();
