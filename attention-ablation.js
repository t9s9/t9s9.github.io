/* ===========================================================================
   Attention-head ablation figure.

   Usage — drop a mount point anywhere and import this module once:

       <div data-attention-ablation data-config="ablation.json"></div>
       <script type="module" src="attention-ablation.js"></script>

   Every element with [data-attention-ablation] is mounted automatically.
   data-config is optional; without it the built-in DEFAULT_CONFIG is used.

   Colours are read from the host page's tokens (--ink, --accent, --paper …)
   with fallbacks, so this inherits the site theme — including the light/dark
   toggle — and still looks right on a bare page.
   =========================================================================== */

const NS = "http://www.w3.org/2000/svg";
let uid = 0;

/* ---------------------------------------------------------------------------
   Default configuration. Anything here can be overridden by the JSON named in
   data-config. See ablation.json for the annotated copy.
   --------------------------------------------------------------------------- */
export const DEFAULT_CONFIG = {
  classes: ["dog", "cat", "car", "airplane"],
  truth: "cat",
  prompt: ["What object is", "in the image?"],
  image: { src: null, alt: "a cat" },
  layerLabels: ["LAYER 1", "LAYER L"],
  headsPerLayer: 4,
  totalHeads: 12,
  timing: {
    intro: 1100, step: 2200, hold: 2600, reset: 800,
    ablateIn: 320, pulseAt: 280, pulseDur: 820, barAt: 1080, barDur: 560
  },
  steps: [
    { ablate: null, p: [0.14, 0.78, 0.05, 0.03], note: "intact model — every head active" },
    { ablate: { layer: 0, head: 2 }, p: [0.17, 0.74, 0.06, 0.03], note: "a redundant head goes — the prediction barely moves" },
    { ablate: { layer: 1, head: 0 }, p: [0.21, 0.69, 0.07, 0.03], note: "still redundant — “cat” stays on top" },
    { ablate: { layer: 0, head: 0 }, p: [0.27, 0.61, 0.08, 0.04], note: "confidence erodes, but the answer survives" },
    { ablate: { layer: 1, head: 2 }, p: [0.48, 0.29, 0.15, 0.08], note: "a head the prediction depended on — the answer collapses" },
    { ablate: { layer: 0, head: 3 }, p: [0.51, 0.22, 0.18, 0.09], note: "“dog” now dominates" },
    { ablate: { layer: 1, head: 3 }, p: [0.44, 0.17, 0.26, 0.13], note: "the object representation is falling apart" },
    { ablate: { layer: 0, head: 1 }, p: [0.33, 0.14, 0.31, 0.22], note: "distribution flattening toward chance" }
  ]
};

const DEFAULT_TIMING = DEFAULT_CONFIG.timing;

/* ---------------------------------------------------------------------------
   Drawing metrics. Positions derive from these plus the head count, so editing
   headsPerLayer re-flows the figure — including the viewBox — rather than
   overlapping things. Heads and the MLP share one row above the stream, and
   the stream runs dead straight: no corners.
   --------------------------------------------------------------------------- */
const M = {
  spineY: 104,
  input:  { x: 16, y: 30, size: 60 },
  prompt: { w: 80, gap: 6, padX: 5, padY: 5, maxSize: 7.5, minSize: 5.5, lineRatio: 1.42 },
  headW: 22, headH: 30, headGap: 5, headY: 44,
  mlpW: 38, mlpGap: 12, mlpInset: 8,
  busY: 88,
  frameY: 30, frameH: 86,
  dotsGap: 34,
  tailRun: 18,
  chartTop: 138,
  chart: { labelRight: 118, trackX: 126, trackMax: 250, rowPitch: 19, barH: 10, firstRow: 164 },
  verdict: { cx: 438, cy: 193, r: 12 },
  catBox: { x: 30, y: 62, size: 90 },
  height: 240,
  monoAdvance: 0.62
};

/* The built-in cat, drawn for a 90x90 box at (30,62) and scaled into the frame. */
const CAT = [
  { t: "path",    c: "c-fill",   a: { d: "M58 87 L64 66 L80 78 Z" } },
  { t: "path",    c: "c-fill",   a: { d: "M92 87 L86 66 L70 78 Z" } },
  { t: "path",    c: "c-accent", a: { d: "M64 83 L67 73 L75 80 Z" } },
  { t: "path",    c: "c-accent", a: { d: "M86 83 L83 73 L75 80 Z" } },
  { t: "path",    c: "c-fill",   a: { d: "M61 119 C57 134 59 146 63 146 L87 146 C91 146 93 134 89 119 Z" } },
  { t: "circle",  c: "c-fill",   a: { cx: 75, cy: 100, r: 20 } },
  { t: "path",    c: "c-stroke", a: { d: "M89 141 C102 144 104 130 96 126" } },
  { t: "ellipse", c: "c-eye",    a: { cx: 67, cy: 98, rx: 2.5, ry: 3.4 } },
  { t: "ellipse", c: "c-eye",    a: { cx: 83, cy: 98, rx: 2.5, ry: 3.4 } },
  { t: "path",    c: "c-accent", a: { d: "M71.5 107 L78.5 107 L75 111 Z" } },
  { t: "path",    c: "c-stroke", a: { d: "M75 111 q-4 4 -7.5 1.5" } },
  { t: "path",    c: "c-stroke", a: { d: "M75 111 q4 4 7.5 1.5" } },
  { t: "path",    c: "c-whisk",  a: { d: "M59 106 L44 103 M59 110 L45 113 M91 106 L106 103 M91 110 L105 113" } }
];

const ICONS = {
  pause: [{ t: "rect", a: { x: 4.4, y: 3.4, width: 2.7, height: 9.2, rx: 1 } },
          { t: "rect", a: { x: 8.9, y: 3.4, width: 2.7, height: 9.2, rx: 1 } }],
  play:  [{ t: "path", a: { d: "M5.4 3.2 L12.6 8 L5.4 12.8 Z" } }],
  step:  [{ t: "path", a: { d: "M4.0 3.2 L10.2 8 L4.0 12.8 Z" } },
          { t: "rect", a: { x: 10.9, y: 3.2, width: 2.3, height: 9.6, rx: 1 } }]
};

/* --------------------------------------------------------------------------- */

const CSS = `
.tfx {
  --tfx-ink:    var(--ink, #1a1a1a);
  --tfx-soft:   var(--ink-soft, #4a4744);
  --tfx-mute:   var(--ink-mute, #6f6a60);
  --tfx-rule:   var(--rule, #d8cfb9);
  --tfx-paper:  var(--paper, #fbf8f1);
  --tfx-accent: var(--accent, #b54a25);
  --tfx-mono:   var(--mono, "JetBrains Mono", ui-monospace, Menlo, monospace);
  --tfx-bar:     #7d8288;
  --tfx-bar-max: var(--accent, #b54a25);
  --tfx-ok:      #12805e;
  --tfx-bad:     #c0442f;
  margin: 0;
}
/* Every token is restated for dark, not just the chart colours: on a bare page
   there is no host --paper / --rule to inherit, so a partial override would
   leave the figure drawing light shapes on a dark ground. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .tfx {
    --tfx-ink: var(--ink, #ece7dc); --tfx-soft: var(--ink-soft, #b8b3a8);
    --tfx-mute: var(--ink-mute, #9a958a); --tfx-rule: var(--rule, #2c2f33);
    --tfx-paper: var(--paper, #1a1c1f); --tfx-accent: var(--accent, #e0926a);
    --tfx-bar: #6a7078; --tfx-bar-max: var(--accent, #c97a52);
    --tfx-ok: #3da87b; --tfx-bad: #d9553c;
  }
}
[data-theme="dark"] .tfx {
  --tfx-ink: var(--ink, #ece7dc); --tfx-soft: var(--ink-soft, #b8b3a8);
  --tfx-mute: var(--ink-mute, #9a958a); --tfx-rule: var(--rule, #2c2f33);
  --tfx-paper: var(--paper, #1a1c1f); --tfx-accent: var(--accent, #e0926a);
  --tfx-bar: #6a7078; --tfx-bar-max: var(--accent, #c97a52);
  --tfx-ok: #3da87b; --tfx-bad: #d9553c;
}

.tfx-stage { overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; }
.tfx-svg   { display: block; width: 100%; max-width: 620px; min-width: 460px; height: auto; }

.tfx .t-cap   { font-family: var(--tfx-mono); font-size: 8px; font-weight: 500; letter-spacing: .16em; fill: var(--tfx-mute); }
.tfx .t-promptxt { font-family: var(--tfx-mono); fill: var(--tfx-mute); }
.tfx .t-sub   { font-family: var(--tfx-mono); font-size: 6.5px; letter-spacing: .1em; fill: var(--tfx-mute); text-anchor: middle; }

.tfx .t-frame  { fill: var(--tfx-paper); stroke: var(--tfx-rule); stroke-width: 1; }
.tfx .t-prompt { fill: none; stroke: var(--tfx-mute); stroke-width: 1; stroke-dasharray: 3 3; opacity: .55; }
.tfx .c-fill   { fill: var(--tfx-soft); }
.tfx .c-accent { fill: var(--tfx-accent); }
.tfx .c-eye    { fill: var(--tfx-paper); }
.tfx .c-stroke { fill: none; stroke: var(--tfx-paper); stroke-width: 1.4; stroke-linecap: round; }
.tfx .c-whisk  { fill: none; stroke: var(--tfx-soft); stroke-width: 1; stroke-linecap: round; }

.tfx .t-spine { fill: none; stroke: var(--tfx-soft); stroke-width: 2.2; stroke-linecap: round; }
.tfx .t-arrow { fill: var(--tfx-soft); }
.tfx .t-dots  { fill: var(--tfx-mute); }
.tfx .t-wire  { fill: none; stroke: var(--tfx-mute); stroke-width: 1.1; opacity: .55; }
.tfx .t-merge { fill: var(--tfx-paper); stroke: var(--tfx-soft); stroke-width: 1.1; }
.tfx .t-mergemark { stroke: var(--tfx-soft); stroke-width: 1; }
.tfx .t-layer { fill: none; stroke: var(--tfx-mute); stroke-width: 1; stroke-dasharray: 2 4; opacity: .38; }

.tfx .t-head     { fill: var(--tfx-paper); stroke: var(--tfx-soft); stroke-width: 1.1; }
.tfx .t-cell     { fill: var(--tfx-accent); }
.tfx .t-headstub { stroke: var(--tfx-mute); stroke-width: 1.1; opacity: .55; }
/* No opacity here on purpose — a CSS rule would outrank the presentation
   attribute the script animates, and the cross would never show. */
.tfx .t-headx    { fill: none; stroke: var(--tfx-bad); stroke-width: 1.6; stroke-linecap: round; }
.tfx .t-mlp      { fill: var(--tfx-paper); stroke: var(--tfx-soft); stroke-width: 1.1; }
.tfx .t-mlptxt   { font-family: var(--tfx-mono); font-size: 7px; font-weight: 500; letter-spacing: .08em; fill: var(--tfx-soft); text-anchor: middle; }

.tfx .t-track  { fill: var(--tfx-rule); opacity: .6; }
.tfx .t-bar    { fill: var(--tfx-bar); }
.tfx .t-bar.is-max { fill: var(--tfx-bar-max); }
.tfx .t-barlab { font-family: var(--tfx-mono); font-size: 7.5px; fill: var(--tfx-mute); text-anchor: end; }
.tfx .t-barlab.is-truth { fill: var(--tfx-ink); }
.tfx .t-barval { font-family: var(--tfx-mono); font-size: 7.5px; font-weight: 500; fill: var(--tfx-mute); }
.tfx .t-barval.is-max { fill: var(--tfx-ink); }
.tfx .t-truthmark { fill: var(--tfx-ink); }

.tfx .t-verdict circle { fill: none; stroke-width: 1.6; }
.tfx .t-verdict path   { fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.tfx .t-verdicttxt { font-family: var(--tfx-mono); font-size: 8px; font-weight: 500; letter-spacing: .16em; }
.tfx .t-verdict.is-ok  circle, .tfx .t-verdict.is-ok  path { stroke: var(--tfx-ok); }
.tfx .t-verdict.is-ok  .t-verdicttxt { fill: var(--tfx-ok); }
.tfx .t-verdict.is-bad circle, .tfx .t-verdict.is-bad path { stroke: var(--tfx-bad); }
.tfx .t-verdict.is-bad .t-verdicttxt { fill: var(--tfx-bad); }
.tfx .t-pulse { fill: var(--tfx-accent); }

.tfx-bar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1.25rem; flex-wrap: wrap; max-width: 620px;
  margin-top: .4rem; padding-top: .7rem; border-top: 1px solid var(--tfx-rule);
}
/* flex:1 + min-width:0 lets the note wrap inside the status block instead of
   shoving the controls onto a line of their own */
.tfx-status { margin: 0; flex: 1 1 auto; min-width: 0; display: flex; align-items: baseline; gap: .8rem; flex-wrap: wrap; }
.tfx-count {
  font-family: var(--tfx-mono); font-size: 10.5px; font-weight: 500;
  letter-spacing: .12em; text-transform: uppercase; color: var(--tfx-ink);
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.tfx-note { font-size: 13.5px; line-height: 1.4; color: var(--tfx-mute); }
.tfx-note.is-error { color: var(--tfx-bad); font-family: var(--tfx-mono); font-size: 12px; }
.tfx-ctrls { display: flex; gap: .5rem; flex: 0 0 auto; margin-left: auto; }
.tfx-btn {
  width: 32px; height: 32px; padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid var(--tfx-rule); border-radius: 999px;
  color: var(--tfx-ink); cursor: pointer;
  transition: color .2s ease, border-color .2s ease;
}
.tfx-btn:hover { color: var(--tfx-accent); border-color: var(--tfx-accent); }
.tfx-btn:focus-visible { outline: 2px solid var(--tfx-accent); outline-offset: 3px; }
.tfx-btn svg { width: 14px; height: 14px; display: block; fill: currentColor; }
.tfx-btn .ico { display: none; }
.tfx-btn[data-icon="pause"] .ico-pause,
.tfx-btn[data-icon="play"]  .ico-play,
.tfx-btn[data-icon="step"]  .ico-step { display: block; }
.tfx-btn .ico-stroke { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; }

@media (max-width: 620px) {
  .tfx-bar { flex-direction: column; align-items: flex-start; gap: .7rem; }
}
`;

function injectStyle() {
  if (document.getElementById("tfx-styles")) return;
  const s = document.createElement("style");
  s.id = "tfx-styles";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/* --------------------------------------------------------------------------- */

function svgEl(name, attrs, cls) {
  const n = document.createElementNS(NS, name);
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (cls) n.setAttribute("class", cls);
  return n;
}
function svgText(parent, attrs, cls, s) {
  const t = svgEl("text", attrs, cls);
  t.textContent = s;
  parent.appendChild(t);
  return t;
}
function htmlEl(name, cls, attrs) {
  const n = document.createElement(name);
  if (cls) n.setAttribute("class", cls);
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}

const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeInOut = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, t) => a + (b - a) * t;

function wrapWords(text, maxChars) {
  const out = [];
  let cur = "";
  text.split(/\s+/).filter(Boolean).forEach(word => {
    let w = word;
    while (w.length > maxChars) {          // a word that can never fit gets hard-broken
      if (cur) { out.push(cur); cur = ""; }
      out.push(w.slice(0, maxChars));
      w = w.slice(maxChars);
    }
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += " " + w;
    else { out.push(cur); cur = w; }
  });
  if (cur) out.push(cur);
  return out;
}

// Largest type size at which the prompt re-wraps into the space above the
// chart. The config's own line breaks are a starting point, not a constraint.
function fitPrompt(lines) {
  const text = lines.join(" ").trim();
  const avail = M.prompt.w - 2 * M.prompt.padX;
  const top = M.input.y + M.input.size + M.prompt.gap;
  const availH = M.chartTop - top - 6;
  let best = null;

  for (let size = M.prompt.maxSize; size >= M.prompt.minSize - 0.001; size -= 0.25) {
    const lh = size * M.prompt.lineRatio;
    const maxLines = Math.floor((availH - 2 * M.prompt.padY) / lh);
    const chars = Math.floor(avail / (size * M.monoAdvance));
    if (maxLines < 1 || chars < 4) continue;
    best = { size, lh, chars, maxLines, lines: wrapWords(text, chars) };
    if (best.lines.length <= maxLines) break;
  }
  if (!best) best = { size: M.prompt.minSize, lh: M.prompt.minSize * M.prompt.lineRatio, chars: 8, maxLines: 1, lines: [text] };

  let out = best.lines;
  if (out.length > best.maxLines) {        // still too long: show the cut rather than spill
    out = out.slice(0, best.maxLines);
    const i = out.length - 1;
    out[i] = out[i].slice(0, Math.max(1, best.chars - 1)) + "…";
  }
  return { size: best.size, lh: best.lh, lines: out, h: 2 * M.prompt.padY + out.length * best.lh };
}

export function validate(c) {
  const errs = [];
  if (!c || typeof c !== "object") return ["config is missing"];
  if (c.__error) return [c.__error];
  if (!Array.isArray(c.classes) || c.classes.length < 2) errs.push("classes must list at least 2 names");
  if (!Array.isArray(c.steps) || c.steps.length < 2) errs.push("steps must contain at least 2 entries");
  if (errs.length) return errs;

  if (c.classes.indexOf(c.truth) < 0) errs.push(`truth "${c.truth}" is not one of classes`);
  if (c.steps[0].ablate) errs.push("steps[0] is the intact model and must have ablate: null");

  const nLayers = (c.layerLabels || []).length || 2;
  const nHeads = c.headsPerLayer || 4;
  c.steps.forEach((s, i) => {
    if (!Array.isArray(s.p) || s.p.length !== c.classes.length) {
      errs.push(`steps[${i}].p needs ${c.classes.length} probabilities`);
      return;
    }
    const sum = s.p.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1) > 0.02) errs.push(`steps[${i}].p sums to ${sum.toFixed(2)}, not 1`);
    if (i > 0) {
      if (!s.ablate) { errs.push(`steps[${i}] needs an ablate entry`); return; }
      if (s.ablate.layer < 0 || s.ablate.layer >= nLayers) errs.push(`steps[${i}] ablates layer ${s.ablate.layer}, outside 0..${nLayers - 1}`);
      if (s.ablate.head < 0 || s.ablate.head >= nHeads) errs.push(`steps[${i}] ablates head ${s.ablate.head}, outside 0..${nHeads - 1}`);
    }
  });

  const seen = {};
  c.steps.forEach((s, i) => {
    if (!s.ablate) return;
    const key = s.ablate.layer + ":" + s.ablate.head;
    if (seen[key]) errs.push(`steps[${i}] ablates layer ${s.ablate.layer} head ${s.ablate.head} again (already removed at step ${seen[key]})`);
    seen[key] = i;
  });

  const t = Object.assign({}, DEFAULT_TIMING, c.timing || {});
  if (t.barAt < t.pulseAt + t.pulseDur - 60) errs.push(`timing: bars start at ${t.barAt}ms but the pulse only lands at ${t.pulseAt + t.pulseDur}ms`);
  if (t.step < t.barAt + t.barDur) errs.push(`timing: step is ${t.step}ms, too short for bars finishing at ${t.barAt + t.barDur}ms`);
  return errs;
}

/* --------------------------------------------------------------------------- */

export function mount(hostEl, options = {}) {
  injectStyle();
  const instance = "tfx" + (++uid);

  /* ---- shell ---- */
  const section = htmlEl("div", "tfx");
  const stage = htmlEl("div", "tfx-stage");
  const svg = svgEl("svg", { viewBox: `0 0 520 ${M.height}`, role: "img" }, "tfx-svg");
  const defs = svgEl("defs");
  const clip = svgEl("clipPath", { id: instance + "-clip" });
  const clipRect = svgEl("rect", { x: 0, y: 0, width: 0, height: 0, rx: 5 });
  clip.appendChild(clipRect); defs.appendChild(clip); svg.appendChild(defs);

  const catG = svgEl("g", null, "t-cat");
  CAT.forEach(p => catG.appendChild(svgEl(p.t, p.a, p.c)));

  const figure = svgEl("g");
  svg.appendChild(figure);
  stage.appendChild(svg);
  section.appendChild(stage);

  const bar = htmlEl("div", "tfx-bar");
  const status = htmlEl("p", "tfx-status");
  const countEl = htmlEl("span", "tfx-count"); countEl.textContent = "—";
  const noteEl = htmlEl("span", "tfx-note"); noteEl.textContent = "loading…";
  status.appendChild(countEl); status.appendChild(noteEl);

  const ctrls = htmlEl("div", "tfx-ctrls");
  const toggle = htmlEl("button", "tfx-btn", { type: "button", "data-icon": "pause" });
  const tSvg = svgEl("svg", { viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false" });
  Object.keys(ICONS).forEach(name => {
    const g = svgEl("g", null, "ico ico-" + name);
    ICONS[name].forEach(sh => g.appendChild(svgEl(sh.t, sh.a)));
    tSvg.appendChild(g);
  });
  toggle.appendChild(tSvg);

  const replay = htmlEl("button", "tfx-btn", { type: "button" });
  const rSvg = svgEl("svg", { viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false" });
  rSvg.appendChild(svgEl("path", { d: "M10.5 3.67 A5 5 0 1 1 7.13 3.08" }, "ico-stroke"));
  rSvg.appendChild(svgEl("path", { d: "M13.27 5.27 L9.4 5.57 L11.6 1.77 Z" }));
  replay.appendChild(rSvg);

  ctrls.appendChild(toggle); ctrls.appendChild(replay);
  bar.appendChild(status); bar.appendChild(ctrls);
  section.appendChild(bar);
  hostEl.appendChild(section);

  /* ---- state ---- */
  let L = null, heads = [], bars = [], vals = [];
  let pulse, verdictG, verdictMark, verdictText;
  let CFG = null, N = 0, T = DEFAULT_TIMING, CYCLE = 0, TOTAL = 0;
  let lastVerdict = null, lastNote = null, lastCount = null;

  function computeLayout(c) {
    const n = c.headsPerLayer;
    const headsW = n * M.headW + (n - 1) * M.headGap;
    const contentW = 8 + headsW + M.mlpGap + M.mlpW - M.mlpInset;
    const frameW = contentW + 18;
    const streamStart = M.input.x + M.prompt.w + 6;

    const layerX = [];
    let x = streamStart + 18;
    for (let i = 0; i < c.layerLabels.length; i++) { layerX.push(x + 6); x += frameW + M.dotsGap; }

    const lastMerge = layerX[layerX.length - 1] + contentW;
    const streamEnd = lastMerge + M.tailRun;               // straight run to the arrowhead
    const chartRight = M.verdict.cx + M.verdict.r + 70;    // room for "CORRECT"
    return { headsW, contentW, frameW, streamStart, layerX, lastMerge, streamEnd,
             width: Math.max(streamEnd + 16, chartRight) };
  }

  const headCx = (l, i) => L.layerX[l] + 8 + i * (M.headW + M.headGap) + M.headW / 2;
  const mergeX = l => L.layerX[l] + L.contentW;

  // The stream is a single straight line, so the pulse is a plain lerp along it.
  const pulseAtT = t => lerp(L.streamStart, L.streamEnd, t);

  function removalStep(c, l, h) {
    for (let s = 1; s < c.steps.length; s++) {
      const a = c.steps[s].ablate;
      if (a && a.layer === l && a.head === h) return s;
    }
    return null;
  }

  function build(c) {
    CFG = c;
    T = Object.assign({}, DEFAULT_TIMING, c.timing || {});
    N = c.steps.length - 1;
    CYCLE = T.intro + N * T.step + T.hold + T.reset;
    L = computeLayout(c);
    TOTAL = c.totalHeads || (c.headsPerLayer * c.layerLabels.length);

    svg.setAttribute("viewBox", `0 0 ${L.width} ${M.height}`);
    svg.setAttribute("aria-label",
      `Diagram of a transformer answering "${(c.prompt || []).join(" ")}" for an image of ${(c.image && c.image.alt) || "an object"}. ` +
      `In each layer the attention heads and the MLP sit side by side above a residual stream they read from and write back into. ` +
      `The stream feeds a bar chart over ${c.classes.join(", ")}. As heads are removed one by one the probability of "${c.truth}" falls ` +
      `and the prediction eventually flips.`);
    while (figure.firstChild) figure.removeChild(figure.firstChild);
    heads = []; bars = []; vals = [];

    /* ---- input ---- */
    const ix = M.input.x, iy = M.input.y, isz = M.input.size;
    svgText(figure, { x: ix, y: 20 }, "t-cap", "INPUT");
    figure.appendChild(svgEl("rect", { x: ix, y: iy, width: isz, height: isz, rx: 5 }, "t-frame"));

    if (c.image && c.image.src) {
      clipRect.setAttribute("x", ix); clipRect.setAttribute("y", iy);
      clipRect.setAttribute("width", isz); clipRect.setAttribute("height", isz);
      const img = svgEl("image", {
        x: ix, y: iy, width: isz, height: isz,
        preserveAspectRatio: "xMidYMid slice", "clip-path": `url(#${instance}-clip)`
      });
      img.setAttributeNS("http://www.w3.org/1999/xlink", "href", c.image.src);   // older Safari
      img.setAttribute("href", c.image.src);
      figure.appendChild(img);
    } else {
      const s = isz / M.catBox.size;
      catG.setAttribute("transform",
        `translate(${(ix - M.catBox.x * s).toFixed(2)} ${(iy - M.catBox.y * s).toFixed(2)}) scale(${s.toFixed(4)})`);
      figure.appendChild(catG);   // after the frame, or the frame paints over it
    }

    const fit = fitPrompt(c.prompt || []);
    const py = iy + isz + M.prompt.gap;
    figure.appendChild(svgEl("rect", { x: ix, y: py, width: M.prompt.w, height: fit.h, rx: 4 }, "t-prompt"));
    fit.lines.forEach((line, i) => {
      svgText(figure, {
        x: ix + M.prompt.padX,
        y: py + M.prompt.padY + fit.lh * (i + 0.78),
        "font-size": fit.size.toFixed(2)
      }, "t-promptxt", line);
    });

    /* ---- layers: heads and MLP side by side above the stream ---- */
    c.layerLabels.forEach((label, l) => {
      const X0 = L.layerX[l], g = svgEl("g");
      svgText(figure, { x: X0 - 6, y: 20 }, "t-cap", label);
      g.appendChild(svgEl("rect", { x: X0 - 6, y: M.frameY, width: L.frameW, height: M.frameH, rx: 6 }, "t-layer"));

      const headsX0 = X0 + 8, headsX1 = headsX0 + L.headsW, rowBottom = M.headY + M.headH;
      g.appendChild(svgEl("path", { d: `M${headsX0} ${M.spineY} V${M.busY} H${headsX1} V${M.spineY}` }, "t-wire"));

      for (let i = 0; i < c.headsPerLayer; i++) {
        const cx = headCx(l, i), x = cx - M.headW / 2;
        g.appendChild(svgEl("line", { x1: cx, y1: rowBottom, x2: cx, y2: M.busY }, "t-headstub"));

        const box = svgEl("rect", { x, y: M.headY, width: M.headW, height: M.headH, rx: 3 }, "t-head");
        g.appendChild(box);

        const cells = svgEl("g");                     // 3x3 mini attention map
        for (let r = 0; r < 3; r++) {
          for (let cc = 0; cc < 3; cc++) {
            const seed = (l * 97 + i * 31 + r * 7 + cc * 13) % 17;
            cells.appendChild(svgEl("rect", {
              x: x + 2.75 + cc * 6, y: M.headY + 6.75 + r * 6,
              width: 4.5, height: 4.5, rx: 1,
              opacity: (0.32 + (seed / 17) * 0.62).toFixed(2)   // floor keeps faint cells visible
            }, "t-cell"));
          }
        }
        g.appendChild(cells);

        const cross = svgEl("path", {
          d: `M${cx - 6.5} ${M.headY + 8.5} l13 13 M${cx + 6.5} ${M.headY + 8.5} l-13 13`,
          opacity: 0
        }, "t-headx");
        g.appendChild(cross);

        heads.push({ layer: l, head: i, box, cells, cross, step: removalStep(c, l, i) });
      }

      svgText(g, { x: headsX0 + L.headsW / 2, y: 40 }, "t-sub", c.headsPerLayer + " ATTENTION HEADS");

      const mlpX = headsX1 + M.mlpGap, mlpTap = mlpX + M.mlpInset, mx = mergeX(l);
      g.appendChild(svgEl("path", { d: `M${mlpTap} ${M.spineY} V${rowBottom} M${mx} ${M.spineY} V${rowBottom}` }, "t-wire"));
      g.appendChild(svgEl("rect", { x: mlpX, y: M.headY, width: M.mlpW, height: M.headH, rx: 3 }, "t-mlp"));
      svgText(g, { x: mlpX + M.mlpW / 2, y: M.headY + M.headH / 2 + 2.5 }, "t-mlptxt", "MLP");

      [headsX1, mx].forEach(p => {                    // write-back points
        g.appendChild(svgEl("circle", { cx: p, cy: M.spineY, r: 4 }, "t-merge"));
        g.appendChild(svgEl("path", { d: `M${p - 2.2} ${M.spineY} h4.4 M${p} ${M.spineY - 2.2} v4.4` }, "t-mergemark"));
      });

      figure.appendChild(g);
    });

    /* ---- residual stream: straight through, breaking where layers are elided ---- */
    const nL = L.layerX.length;
    for (let l = 0; l < nL; l++) {
      const fl = L.layerX[l] - 6, fr = fl + L.frameW;
      figure.appendChild(svgEl("line", {
        x1: l === 0 ? L.streamStart : fl, y1: M.spineY,
        x2: l === nL - 1 ? L.streamEnd - 6 : fr, y2: M.spineY
      }, "t-spine"));
      if (l > 0) {
        const gx = fl - M.dotsGap / 2, dots = svgEl("g", null, "t-dots");
        [-9, 0, 9].forEach(d => dots.appendChild(svgEl("circle", { cx: gx + d, cy: M.spineY, r: 2.8 })));
        figure.appendChild(dots);
      }
    }
    figure.appendChild(svgEl("path", {
      d: `M${L.streamEnd - 7} ${M.spineY - 4.5} L${L.streamEnd + 2} ${M.spineY} L${L.streamEnd - 7} ${M.spineY + 4.5} Z`
    }, "t-arrow"));

    /* ---- chart ---- */
    svgText(figure, { x: M.input.x, y: M.chartTop + 6 }, "t-cap", "SOFTMAX P(CLASS)");
    const widest = c.classes.reduce((a, b) => (b.length > a.length ? b : a), "");
    const markX = M.chart.labelRight - widest.length * 4.6 - 9;
    c.classes.forEach((name, i) => {
      const y = M.chart.firstRow + i * M.chart.rowPitch, top = y - M.chart.barH / 2;
      figure.appendChild(svgEl("rect", { x: M.chart.trackX, y: top, width: M.chart.trackMax, height: M.chart.barH, rx: 3 }, "t-track"));
      svgText(figure, { x: M.chart.labelRight, y: y + 2.8 }, "t-barlab" + (name === c.truth ? " is-truth" : ""), name);
      if (name === c.truth) {
        figure.appendChild(svgEl("path", { d: `M${markX} ${y - 3.2} l4.6 3.2 l-4.6 3.2 Z` }, "t-truthmark"));
      }
      const b = svgEl("rect", { x: M.chart.trackX, y: top, width: 0, height: M.chart.barH, rx: 3 }, "t-bar");
      figure.appendChild(b); bars.push(b);
      vals.push(svgText(figure, { x: M.chart.trackX + 6, y: y + 2.8 }, "t-barval", ""));
    });

    /* ---- verdict + pulse ---- */
    verdictG = svgEl("g", null, "t-verdict");
    verdictG.appendChild(svgEl("circle", { cx: M.verdict.cx, cy: M.verdict.cy, r: M.verdict.r }));
    verdictMark = svgEl("path", { d: "" });
    verdictG.appendChild(verdictMark);
    verdictText = svgText(verdictG, { x: M.verdict.cx + 20, y: M.verdict.cy + 3 }, "t-verdicttxt", "");
    figure.appendChild(verdictG);

    pulse = svgEl("circle", { cx: 0, cy: M.spineY, r: 4.2, opacity: 0 }, "t-pulse");
    figure.appendChild(pulse);

    lastVerdict = null; lastNote = null; lastCount = null;
  }

  /* ---- every frame is a pure function of cycle time ---- */
  function render(t) {
    const steps = CFG.steps;
    let k, lt, phase, resetT = 0;

    if (t < T.intro) { k = 0; lt = 0; phase = "intro"; }
    else if (t < T.intro + N * T.step) {
      k = Math.floor((t - T.intro) / T.step) + 1;
      lt = (t - T.intro) % T.step;
      phase = "run";
    } else if (t < T.intro + N * T.step + T.hold) { k = N; lt = T.step; phase = "hold"; }
    else { k = N; lt = T.step; phase = "reset"; resetT = t - (T.intro + N * T.step + T.hold); }

    let ablated = 0;
    for (const hd of heads) {
      let prog = 0;
      if (hd.step !== null) {
        if (hd.step < k) prog = 1;
        else if (hd.step === k) prog = easeOut(clamp01(lt / T.ablateIn));
      }
      if (phase === "reset" && prog > 0) {
        prog *= 1 - easeOut(clamp01((resetT - (hd.step - 1) * 45) / 340));      // staggered rewind
      }
      if (prog > .5) ablated++;
      hd.cells.setAttribute("opacity", (1 - prog * 0.92).toFixed(3));
      hd.box.setAttribute("opacity", (1 - prog * 0.55).toFixed(3));
      hd.box.setAttribute("stroke-dasharray", prog > .05 ? "2 2" : "none");
      hd.cross.setAttribute("opacity", prog.toFixed(3));
    }

    const from = steps[Math.max(0, k - 1)].p, to = steps[k].p;
    let mix;
    if (phase === "intro") mix = 0;
    else if (phase === "run") mix = easeOut(clamp01((lt - T.barAt) / T.barDur));
    else mix = 1;

    const p = CFG.classes.map((_, c) => lerp(from[c], to[c], mix));
    if (phase === "reset") {
      const rp = easeInOut(clamp01(resetT / T.reset));
      for (let c = 0; c < p.length; c++) p[c] = lerp(steps[N].p[c], steps[0].p[c], rp);
    }

    let maxI = 0;
    for (let m = 1; m < p.length; m++) if (p[m] > p[maxI]) maxI = m;

    for (let b = 0; b < bars.length; b++) {
      const w = Math.max(0, p[b]) * M.chart.trackMax;
      bars[b].setAttribute("width", w);
      bars[b].setAttribute("class", "t-bar" + (b === maxI ? " is-max" : ""));
      vals[b].setAttribute("x", M.chart.trackX + w + 6);
      vals[b].textContent = Math.round(p[b] * 100) + "%";
      vals[b].setAttribute("class", "t-barval" + (b === maxI ? " is-max" : ""));
    }

    const ok = CFG.classes[maxI] === CFG.truth;
    if (ok !== lastVerdict) {
      const vx = M.verdict.cx, vy = M.verdict.cy;
      verdictG.setAttribute("class", "t-verdict " + (ok ? "is-ok" : "is-bad"));
      verdictMark.setAttribute("d", ok
        ? `M${vx - 5.5} ${vy} l4 4 l7.5 -8.5`
        : `M${vx - 5} ${vy - 5} l10 10 M${vx + 5} ${vy - 5} l-10 10`);
      verdictText.textContent = ok ? "CORRECT" : "WRONG";
      if (!reduce.matches) {
        verdictG.style.transformOrigin = `${vx}px ${vy}px`;
        verdictG.style.transform = "scale(1.18)";
        requestAnimationFrame(() => {                    // settles back — a pop, not a bounce
          verdictG.style.transition = "transform .3s cubic-bezier(.34,1.56,.64,1)";
          verdictG.style.transform = "scale(1)";
        });
      }
      lastVerdict = ok;
    }

    /* one forward pass, straight from the input image to the end of the stream */
    if (phase === "run" && lt >= T.pulseAt && lt <= T.pulseAt + T.pulseDur) {
      const pt = clamp01((lt - T.pulseAt) / T.pulseDur);
      pulse.setAttribute("cx", pulseAtT(easeInOut(pt)));
      pulse.setAttribute("cy", M.spineY);
      pulse.setAttribute("opacity", clamp01(Math.min(pt, 1 - pt) / 0.12).toFixed(3));
    } else {
      pulse.setAttribute("opacity", 0);
    }

    const countTxt = `${ablated} / ${TOTAL} heads ablated`;
    if (countTxt !== lastCount) { countEl.textContent = countTxt; lastCount = countTxt; }
    // hold the previous note until the bars actually move, so the caption never
    // claims a collapse while the chart still shows the old distribution
    const noteStep = (phase === "run" && lt < T.barAt) ? Math.max(0, k - 1) : k;
    const noteTxt = phase === "reset" ? "restoring every head — running again" : steps[noteStep].note;
    if (noteTxt !== lastNote) { noteEl.textContent = noteTxt; lastNote = noteTxt; }
  }

  /* ---- clock ---- */
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let raf = null, last = 0, elapsed = 0;
  let userPaused = false, visible = true, stepIdx = 0, ready = false;

  function frame(now) {
    if (last) elapsed += now - last;
    last = now;
    render(elapsed % CYCLE);
    raf = requestAnimationFrame(frame);
  }
  function play() { if (raf || reduce.matches || !ready) return; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = null; last = 0; }
  function sync() { if (!userPaused && visible && !reduce.matches && ready) play(); else stop(); }

  function setBtn(btn, icon, label) {
    btn.setAttribute("data-icon", icon);
    btn.setAttribute("aria-label", label);
    btn.setAttribute("title", label);
  }
  const renderStatic = i => render(i === 0 ? T.intro - 1 : T.intro + i * T.step - 1);

  function applyMode() {
    if (!ready) return;
    if (reduce.matches) {
      stop();
      setBtn(toggle, "step", "Step forward");
      setBtn(replay, "replay", "Reset");
      stepIdx = 0; renderStatic(0);
    } else {
      setBtn(toggle, userPaused ? "play" : "pause", userPaused ? "Play" : "Pause");
      setBtn(replay, "replay", "Replay");
      sync();
    }
  }

  toggle.addEventListener("click", () => {
    if (!ready) return;
    if (reduce.matches) {
      stepIdx = (stepIdx + 1) % (N + 1);
      renderStatic(stepIdx);
      setBtn(toggle, "step", stepIdx === N ? "Start over" : "Step forward");
      return;
    }
    userPaused = !userPaused;
    setBtn(toggle, userPaused ? "play" : "pause", userPaused ? "Play" : "Pause");
    sync();
  });

  replay.addEventListener("click", () => {
    if (!ready) return;
    if (reduce.matches) { stepIdx = 0; renderStatic(0); setBtn(toggle, "step", "Step forward"); return; }
    elapsed = 0; last = 0; userPaused = false;
    setBtn(toggle, "pause", "Pause");
    render(0); sync();
  });

  if (typeof IntersectionObserver !== "undefined") {
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); },
      { threshold: 0.15 }).observe(section);
  }
  if (reduce.addEventListener) reduce.addEventListener("change", applyMode);

  function showError(errs) {
    countEl.textContent = "config error";
    noteEl.setAttribute("class", "tfx-note is-error");
    noteEl.textContent = errs.slice(0, 3).join(" · ") + (errs.length > 3 ? ` · (+${errs.length - 3} more)` : "");
    if (typeof console !== "undefined") console.error("[attention-ablation] config problems:", errs);
  }

  function start(cfg) {
    const errs = validate(cfg);
    if (errs.length) { ready = false; stop(); showError(errs); return false; }
    noteEl.setAttribute("class", "tfx-note");
    build(cfg);
    ready = true;
    elapsed = 0; last = 0;
    render(0);
    applyMode();
    return true;
  }

  /* ---- config: defaults now, external JSON layered on when it arrives ---- */
  const base = Object.assign({}, DEFAULT_CONFIG, options.config || {});
  start(base);

  const src = options.configUrl || hostEl.getAttribute("data-config");
  if (src && typeof fetch !== "undefined") {
    fetch(src)
      .then(r => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json(); })
      .then(c => { stop(); start(Object.assign({}, base, c)); })
      .catch(e => console.warn(`[attention-ablation] could not load ${src} — using built-in config.`, e));
  }

  return { el: section, start, render, destroy() { stop(); hostEl.removeChild(section); } };
}

/* --------------------------------------------------------------------------- */

export function autoInit(root = document) {
  root.querySelectorAll("[data-attention-ablation]").forEach(el => {
    if (el.getAttribute("data-tfx-mounted")) return;
    el.setAttribute("data-tfx-mounted", "1");
    mount(el);
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => autoInit());
  else autoInit();
}
