/* MALINYX V2 motion. Turntable / scrub / switch mechanics ported from the approved /objects page (3 Oct 2026),
   plus: the 3D collection ring, drag rails, page-colour transitions, tilt, cursor, lightbox. Image-based, no WebGL. */
(() => {
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
  constructor(key, spec) { this.key = key; this.spec = spec; this.n = spec.n; this.imgs = new Array(this.n); this.ok = new Array(this.n).fill(false); this.cb = []; this.started = false; this.done = 0; }
  url(i) { const s = this.spec; return `${s.dir}/${small() && s.small ? "s" : "l"}/${String(i).padStart(3, "0")}.${s.ext || "jpg"}`; }
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
const SEQ = {}; const seq = k => (SEQ[k] ||= new Seq(k, M.seq[k]));
function fitCanvas(cv) { const r = cv.getBoundingClientRect(); const w = Math.round(r.width * DPR), h = Math.round(r.height * DPR); if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; } return cv.getContext("2d"); }
function draw(cv, img) { if (!img) return; const ctx = fitCanvas(cv); const s = Math.max(cv.width / img.width, cv.height / img.height);
  const w = img.width * s, h = img.height * s; ctx.imageSmoothingQuality = "high"; ctx.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h); }

/* ---------- turntable: drag with inertia, slow idle turn ---------- */
class Turntable {
  constructor(stage, key) {
    this.stage = stage; this.cv = stage.querySelector("canvas"); this.ring = stage.querySelector(".load .fg"); this.f = 0; this.v = RM ? 0 : 0.9;
    this.drag = null; this.idle = true; this.vis = false; this.dirty = true; this.set(key);
    stage.addEventListener("pointerdown", e => { if (stage.classList.contains("still")) return; this.drag = { x: e.clientX, f: this.f, t: performance.now(), lx: e.clientX }; this.v = 0; this.idle = false; stage.setPointerCapture(e.pointerId); stage.classList.add("touched"); });
    stage.addEventListener("pointermove", e => { if (!this.drag) return; const dx = e.clientX - this.drag.x; const per = stage.clientWidth / (this.s.n * 0.55);
      const now = performance.now(), dt = Math.max(1, now - this.drag.t); this.v = clamp(-(e.clientX - this.drag.lx) / per / dt * 16.7 * 60, -60, 60);
      this.drag.t = now; this.drag.lx = e.clientX; this.f = this.drag.f - dx / per; this.dirty = true; });
    const up = () => { if (!this.drag) return; this.drag = null; clearTimeout(this.it); this.it = setTimeout(() => { this.idle = !RM; }, 4000); };
    stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
    stage.tabIndex = 0; stage.addEventListener("keydown", e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { this.f += e.key === "ArrowLeft" ? -1 : 1; this.idle = false; this.dirty = true; e.preventDefault(); } });
    new IntersectionObserver(es => es.forEach(en => { this.vis = en.isIntersecting; if (this.vis) { this.s.start(); this.loop(); } }), { rootMargin: "60% 0px" }).observe(stage);
    addEventListener("resize", () => { this.dirty = true; });
  }
  set(key) { this.key = key; this.s = seq(key); this.s.cb.push(() => { this.dirty = true; this.progress(); }); if (this.vis) this.s.start(); this.dirty = true; this.progress(); }
  progress() { const p = this.s.done / this.s.n; if (this.ring) this.ring.style.strokeDashoffset = 75.4 * (1 - p); this.stage.classList.toggle("ready", this.s.ok[0] && p > 0.25); }
  loop() { if (this.raf) return; let last = performance.now();
    const tick = now => { const dt = Math.min(64, now - last) / 1000; last = now;
      if (!this.drag) { if (Math.abs(this.v) > 0.05) { this.f += this.v * dt; this.v *= Math.pow(0.04, dt); this.dirty = true; }
        else if (this.idle && !RM) { this.f += 1.6 * dt; this.dirty = true; } }
      if (this.dirty) { draw(this.cv, this.s.nearest(this.f)); this.dirty = false; }
      this.raf = this.vis ? requestAnimationFrame(tick) : 0; };
    this.raf = requestAnimationFrame(tick); }
}
const TT = {}; $$(".stage[data-seq]").forEach(st => { if (M.seq[st.dataset.seq]) TT[st.id] = new Turntable(st, st.dataset.seq); });

/* switches between sequences / stills inside a stage, with a glass wipe */
$$("[data-switch]").forEach(group => {
  const stage = document.getElementById(group.dataset.switch); if (!stage) return; const tt = TT[stage.id]; const wipe = stage.querySelector(".wipe");
  $$(".chip", group).forEach(b => b.addEventListener("click", () => {
    $$(".chip", group).forEach(x => x.setAttribute("aria-pressed", x === b));
    if (wipe && !RM) { wipe.classList.remove("go"); void wipe.offsetWidth; wipe.classList.add("go"); }
    $$(".layer", stage).forEach(l => l.classList.toggle("on", l.dataset.k === b.dataset.still)); stage.classList.toggle("still", !!b.dataset.still);
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
  const o = { sec, ring, items, n, stage, step: 360 / n, drag: 0, dv: 0, active: -1, spin: null, to: null, ang: 0 };
  const layout = () => { const cw = clamp(innerWidth * (innerWidth < 760 ? 0.56 : 0.2), 200, 340); const R = cw / (2 * Math.tan(Math.PI / n)) * 1.12;
    ring.style.setProperty("--cw", cw + "px"); ring.style.setProperty("--R", R + "px"); ring.style.setProperty("--step", o.step + "deg"); };
  layout(); addEventListener("resize", layout);
  /* drag turns the ring; capture only once it is a real drag, so a plain click still opens a card */
  let px = null, moved = 0;
  stage.addEventListener("pointerdown", e => { px = e.clientX; moved = 0; o.dv = 0; o.to = null; });
  stage.addEventListener("pointermove", e => { if (px == null) return; const dx = e.clientX - px; moved += Math.abs(dx);
    if (moved > 6 && !stage.hasPointerCapture(e.pointerId)) stage.setPointerCapture(e.pointerId);
    const d = dx * 0.11; o.drag += d; o.dv = d; px = e.clientX; });
  const up = () => { px = null; }; stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
  stage.addEventListener("dragstart", e => e.preventDefault());
  /* a click on a side card turns it to the front instead of opening it */
  stage.addEventListener("click", e => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); moved = 0; return; }
    const it = e.target.closest(".item"); if (!it) return; const i = items.indexOf(it);
    if (i !== o.active) { e.preventDefault(); const a = ((i * o.step + o.ang) % 360 + 540) % 360 - 180; o.to = o.drag - a; } }, true);
  o.setActive = i => { if (i === o.active) return; o.active = i; const it = items[i];
    if (nowB) nowB.textContent = it.dataset.name; if (nowS) nowS.textContent = it.dataset.line; if (go) go.href = it.getAttribute("href");
    dots.forEach((d, j) => d.classList.toggle("on", j === i));
    clearInterval(o.spin); const key = it.dataset.seq; const img = it.querySelector("img");
    if (key && M.seq[key] && img && !RM) { const s = seq(key); s.start(); let f = 0; o.spin = setInterval(() => { f = (f + 1) % s.n; const im = s.nearest(f); if (im) img.src = im.src; }, 90); } };
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
$$(".wcard[data-seq]").forEach(card => { const img = card.querySelector(".pic img"); const key = card.dataset.seq; if (!M.seq[key] || !img) return; let t = null, i = 0;
  card.addEventListener("pointerenter", () => { if (RM) return; const s = seq(key); s.start(); t = setInterval(() => { i = (i + 1) % s.n; const im = s.nearest(i); if (im) img.src = im.src; }, s.n <= 12 ? 650 : 70); });
  card.addEventListener("pointerleave", () => clearInterval(t)); });

/* filters (work index) */
$$("[data-filter-for]").forEach(group => { const target = document.getElementById(group.dataset.filterFor);
  $$("button[data-filter]", group).forEach(b => b.addEventListener("click", () => {
    $$("button[data-filter]", group).forEach(x => x.setAttribute("aria-pressed", x === b)); const f = b.dataset.filter;
    const run = () => $$("[data-tags]", target).forEach(c => { c.hidden = !(f === "all" || c.dataset.tags.split(" ").includes(f)); });
    if (document.startViewTransition && !RM) document.startViewTransition(run); else run(); }));
  const h = location.hash.slice(1); const hb = h && group.querySelector(`button[data-filter="${CSS.escape(h)}"]`); if (hb) { hb.click(); group.scrollIntoView({ block: "start" }); } });

/* drag rails */
$$(".rail").forEach(r => { let x0 = null, s0 = 0, moved = false;
  /* the cards are links: without this the browser starts a native link drag, fires pointercancel and the rail stops after ~20px */
  r.addEventListener("dragstart", e => e.preventDefault());
  r.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse" || e.button !== 0) return; x0 = e.clientX; s0 = r.scrollLeft; moved = false; });
  addEventListener("pointermove", e => { if (x0 == null) return; const d = e.clientX - x0; if (Math.abs(d) > 4) { moved = true; r.classList.add("dragging"); } r.scrollLeft = s0 - d; });
  const end = () => { x0 = null; r.classList.remove("dragging"); }; addEventListener("pointerup", end); addEventListener("pointercancel", end);
  r.addEventListener("click", e => { if (moved) { e.preventDefault(); moved = false; } }, true); });

/* tilt toward the pointer */
if (!RM && FINE) $$(".stage,.wcard").forEach(st => {
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
  (function loop() { cx += (x - cx) * 0.22; cy += (y - cy) * 0.22; cur.style.transform = `translate3d(${cx}px,${cy}px,0)`; requestAnimationFrame(loop); })(); }

/* lightbox */
const lb = document.querySelector(".lb");
if (lb) { const im = lb.querySelector("img"), cap = lb.querySelector("p");
  $$(".gal .ph img, .plate img").forEach(i => i.addEventListener("click", () => { im.src = i.dataset.full || i.currentSrc || i.src; im.alt = i.alt; cap.textContent = i.closest("figure")?.querySelector("figcaption")?.textContent || ""; lb.classList.add("on"); lb.querySelector("button").focus(); }));
  const close = () => lb.classList.remove("on"); lb.addEventListener("click", e => { if (e.target === lb || e.target.closest("button")) close(); }); addEventListener("keydown", e => { if (e.key === "Escape") close(); }); }

/* ---------- one rAF: hero parallax, scrubs, ring ---------- */
const root = document.documentElement; let mx = 0, my = 0, tx = 0, ty = 0;
addEventListener("pointermove", e => { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; }, { passive: true });
function frame() {
  mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
  const hp = clamp(scrollY / innerHeight, 0, 1.2); root.style.setProperty("--hp", hp.toFixed(4));
  if (!RM) { root.style.setProperty("--mx", mx.toFixed(4)); root.style.setProperty("--my", my.toFixed(4)); }
  for (const o of SCRUBS) { const r = o.sec.getBoundingClientRect(); const p = clamp(-r.top / (r.height - innerHeight), 0, 1); o.sec.style.setProperty("--p", p.toFixed(4));
    const idx = Math.round(p * (o.s.n - 1)); if (r.bottom > 0 && r.top < innerHeight && idx !== o.last) { const im = o.s.clampNearest(idx); if (im) { draw(o.cv, im); o.last = idx; } }
    o.caps.forEach(c => c.classList.toggle("on", p >= +c.dataset.from && p < +c.dataset.to)); }
  for (const o of RINGS) { const r = o.sec.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) continue;
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
    list.innerHTML = r.ranked.map((x, i) => `<li${i === 0 && (r.kind === "run" || r.kind === "decline") ? ' class="win"' : ""}><span class="lab">${esc(x.c.label)}</span><span class="bar"><i style="width:${Math.max(0, Math.min(100, x.s * 100)).toFixed(1)}%"></i></span><span class="mono sc">${x.s.toFixed(2)}</span></li>`).join("");
    verdict.innerHTML = r.kind === "empty" ? esc(r.text) : `<b>${head[r.kind]}</b> ${esc(r.text)}`; };
  inp.addEventListener("input", render);
  $$(".pal-tries .chip", palEl).forEach(b => b.addEventListener("click", () => { inp.value = b.textContent; render(); inp.focus(); }));
  render(); }

/* Field Notes: the hero cycles through the twelve notes */
$$("[data-cycle]").forEach(box => { const items = $$(".nc", box); let i = 0, t = null;
  const show = k => { i = (k + items.length) % items.length; items.forEach((x, j) => x.classList.toggle("on", j === i)); };
  $$("[data-step]", box).forEach(b => b.addEventListener("click", () => { show(i + +b.dataset.step); clearInterval(t); }));
  if (!RM && !QA) t = setInterval(() => show(i + 1), 5200); });

/* Colourway index: a tile picks its pair on the stage above */
$$("[data-pick]").forEach(b => b.addEventListener("click", () => { const c = $$(`[data-switch="${b.dataset.pick}"] .chip`)[+b.dataset.k];
  if (c) { c.click(); document.getElementById(b.dataset.pick).scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "center" }); } }));
})();
