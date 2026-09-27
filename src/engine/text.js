// Typography: embedded fonts, text textures, a tiny TeX-like formula renderer,
// and the glyph atlas the "code universe" particles are drawn from.

import * as THREE from 'three';
import monoUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2';
import monoBoldUrl from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-800-normal.woff2';
import serifUrl from '@fontsource/stix-two-text/files/stix-two-text-latin-400-normal.woff2';
import serifItUrl from '@fontsource/stix-two-text/files/stix-two-text-latin-400-italic.woff2';
import mathUrl from '@fontsource/stix-two-math/files/stix-two-math-latin-400-normal.woff2';

export const MONO = '"JBM", "DejaVu Sans Mono", "Consolas", monospace';
export const MONO_B = '"JBM", "DejaVu Sans Mono", "Consolas", monospace';
export const SERIF = '"STIXText", "STIXMath", "Cambria Math", "DejaVu Serif", serif';
const MATH = '"STIXMath", "STIXText", "Cambria Math", "DejaVu Serif", serif';

export async function loadFonts() {
  const faces = [
    new FontFace('JBM', `url(${monoUrl})`, { weight: '400' }),
    new FontFace('JBM', `url(${monoBoldUrl})`, { weight: '800' }),
    new FontFace('STIXText', `url(${serifUrl})`, { style: 'normal' }),
    new FontFace('STIXText', `url(${serifItUrl})`, { style: 'italic' }),
    new FontFace('STIXMath', `url(${mathUrl})`),
  ];
  await Promise.all(faces.map(f => f.load().then(ff => document.fonts.add(ff)).catch(() => {})));
  await document.fonts.ready;
}

// ---------------------------------------------------------------------------
// Plain text → canvas → texture → plane

export function drawTextCanvas(lines, o = {}) {
  const size = o.size ?? 64, lh = (o.lineHeight ?? 1.25) * size, pad = o.pad ?? size * 0.4;
  const font = `${o.weight ?? 400} ${size}px ${o.family ?? MONO}`;
  const c = o.canvas ?? document.createElement('canvas'), g = c.getContext('2d');
  g.font = font;
  const cols = o.cols;
  const w = Math.ceil(o.width ?? Math.max(1, ...lines.map(l => g.measureText(cols ? 'M'.repeat(cols) : l.text ?? l).width)) + pad * 2);
  const h = Math.ceil(o.height ?? lines.length * lh + pad * 2);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } else g.clearRect(0, 0, w, h);
  g.font = font; g.textBaseline = 'middle';
  g.textAlign = o.align ?? 'left';
  const x0 = g.textAlign === 'center' ? w / 2 : g.textAlign === 'right' ? w - pad : pad;
  lines.forEach((l, i) => {
    const text = l.text ?? l;
    g.fillStyle = l.color ?? o.color ?? '#fff';
    if (o.glow) { g.shadowColor = l.color ?? o.color ?? '#fff'; g.shadowBlur = size * o.glow; }
    g.fillText(text, x0, pad + lh * (i + 0.5));
  });
  return c;
}

export function planeFromCanvas(canvas, worldH, o = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: o.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending, color: new THREE.Color(o.intensity ?? 1, o.intensity ?? 1, o.intensity ?? 1),
    toneMapped: false,
  });
  const aspect = canvas.width / canvas.height;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldH * aspect, worldH), mat);
  mesh.userData.aspect = aspect;
  return mesh;
}

export function textPlane(lines, worldH, o = {}) {
  lines = Array.isArray(lines) ? lines : [lines];
  return planeFromCanvas(drawTextCanvas(lines, o), worldH, o);
}

// A terminal block whose characters appear over time. `set(n)` shows the first n characters.
export class TypeText {
  constructor(lines, worldLineH, o = {}) {
    this.lines = lines; this.o = o; this.n = -1;
    this.total = lines.reduce((s, l) => s + (l.text ?? l).length, 0);
    const size = o.size ?? 48;
    this.canvas = document.createElement('canvas');
    const cols = o.cols ?? Math.max(...lines.map(l => (l.text ?? l).length)) + 2;
    this.draw = n => drawTextCanvas(this.visible(n), { ...o, size, canvas: this.canvas, cols, height: (o.rows ?? lines.length) * (o.lineHeight ?? 1.25) * size + size * 0.8 });
    this.draw(0);
    this.mesh = planeFromCanvas(this.canvas, worldLineH * (o.rows ?? lines.length) * (o.lineHeight ?? 1.25) * 1.02, o);
  }
  visible(n) {
    const out = []; let left = n, at = -1;
    this.lines.forEach((l, i) => {
      const text = l.text ?? l;
      if (left <= 0) { out.push({ ...l, text: '' }); return; }
      const k = Math.min(text.length, left); left -= k;
      out.push({ text: text.slice(0, k), color: l.color });
      at = i;
    });
    // the cursor always sits right after the last typed character (blinking if a blink clock is given)
    if (this.o.cursor !== false && at >= 0 && (!this.o.blink || this.o.blink())) out[at] = { ...out[at], text: out[at].text + '█' };
    return out;
  }
  set(n) {
    n = Math.max(0, Math.floor(n));
    const key = n + (this.o.blink ? (this.o.blink() ? 'a' : 'b') : '');
    if (key === this.n) return;
    this.n = key; this.draw(n); this.mesh.material.map.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Formula renderer: a very small subset of TeX, enough for the equations in the video.
//   x^{2}  x_{n}  \frac{a}{b}  \sqrt{x}  \rm{text}  \big{∫}  \bf{E}  \hat{x}  \vec{x}  \dot{x}

const UPRIGHT_WORDS = /^(sin|cos|tan|lim|log|ln|exp|max|min|det|tr|dim|Re|Im|d)$/;

function parse(src) {
  let i = 0;
  const group = () => {
    const items = [];
    while (i < src.length) {
      const ch = src[i];
      if (ch === '}') { i++; return items; }
      if (ch === '{') { i++; items.push({ k: 'grp', c: group() }); continue; }
      if (ch === '^' || ch === '_') {
        i++; const arg = atom(), key = ch === '^' ? 'sup' : 'sub', last = items[items.length - 1];
        if (last?.k === 'script' && !last[key]) { last[key] = arg; continue; } // x_{a}^{b}
        const base = items.pop() ?? { k: 'txt', s: '' };
        items.push({ k: 'script', base, sup: key === 'sup' ? arg : null, sub: key === 'sub' ? arg : null });
        continue;
      }
      if (ch === '\\') {
        i++; let name = '';
        if (i < src.length && !/[a-z]/i.test(src[i])) name = src[i++]; // \, \{ \}
        else while (i < src.length && /[a-z]/i.test(src[i])) name += src[i++];
        if (name === 'frac') { const a = atom(), b = atom(); items.push({ k: 'frac', a, b }); }
        else if (name === 'sqrt') items.push({ k: 'sqrt', a: atom() });
        else if (['rm', 'bf', 'big', 'hat', 'vec', 'dot', 'bar'].includes(name)) items.push({ k: name, a: atom() });
        else if (name === ',') items.push({ k: 'sp', w: 0.18 });
        else if (name === '{' || name === '}') items.push({ k: 'txt', s: name });
        else if (name === 'quad') items.push({ k: 'sp', w: 1 });
        else items.push({ k: 'rm', a: { k: 'txt', s: name } }); // \sin, \cos, \ln …
        continue;
      }
      if (ch === ' ') { i++; items.push({ k: 'sp', w: 0.25 }); continue; }
      let s = ''; while (i < src.length && !'{}^_\\ '.includes(src[i])) s += src[i++];
      // split trailing char so scripts attach to the last symbol only
      if (s.length > 1 && (src[i] === '^' || src[i] === '_')) { items.push({ k: 'txt', s: s.slice(0, -1) }); items.push({ k: 'txt', s: s.slice(-1) }); }
      else items.push({ k: 'txt', s });
    }
    return items;
  };
  const atom = () => {
    if (src[i] === '{') { i++; return { k: 'grp', c: group() }; }
    return { k: 'txt', s: src[i++] ?? '' };
  };
  return { k: 'grp', c: group() };
}

function layout(g, node, size, style = {}) {
  const run = (s, st) => {
    // split into words/symbols; letters are italic unless a known function name
    const parts = s.match(/[A-Za-z]+|[α-ωΑ-Ω]|./gu) ?? [];
    const pieces = parts.map(p => {
      const letters = /^[A-Za-z]+$/.test(p), greekLower = /^[α-ω]$/u.test(p);
      const upright = st.rm || !letters && !greekLower || (letters && UPRIGHT_WORDS.test(p));
      const font = `${st.bf ? 'bold ' : ''}${upright ? '' : 'italic '}${size}px ${letters && !upright ? SERIF : /[A-Za-z0-9]/.test(p) ? SERIF : MATH}`;
      g.font = font;
      const w = g.measureText(p).width;
      const padR = /[=+−\-×·→⇒⟹≈≤≥<>≡∝]/.test(p) && !st.script ? size * 0.28 : 0;
      return { w: w + padR * 2, p, font, padR };
    });
    const w = pieces.reduce((a, b) => a + b.w, 0);
    return { w, asc: size * 0.78, desc: size * 0.25, draw(x, y) { for (const q of pieces) { g.font = q.font; g.fillText(q.p, x + q.padR, y); x += q.w; } } };
  };
  switch (node.k) {
    case 'txt': return run(node.s, style);
    case 'sp': return { w: node.w * size, asc: 0, desc: 0, draw() {} };
    case 'grp': case 'rm': case 'bf': {
      const st = node.k === 'grp' ? style : node.k === 'bf' ? { ...style, bf: true, rm: true } : { ...style, rm: true };
      const kids = (node.k === 'grp' ? node.c : [node.a]).map(n => layout(g, n, size, st));
      return { w: kids.reduce((a, b) => a + b.w, 0), asc: Math.max(size * 0.7, ...kids.map(k => k.asc)), desc: Math.max(size * 0.2, ...kids.map(k => k.desc)),
        draw(x, y) { for (const k of kids) { k.draw(x, y); x += k.w; } } };
    }
    case 'big': {
      const b = layout(g, node.a, size * 1.7, { ...style, rm: true });
      return { w: b.w + size * 0.1, asc: b.asc * 0.85, desc: b.desc * 1.6, draw(x, y) { b.draw(x, y + size * 0.28); } };
    }
    case 'script': {
      const base = layout(g, node.base, size, style), ss = size * 0.62;
      const sup = node.sup && layout(g, node.sup, ss, { ...style, script: true }), sub = node.sub && layout(g, node.sub, ss, { ...style, script: true });
      const w = base.w + Math.max(sup?.w ?? 0, sub?.w ?? 0) + size * 0.05;
      return { w, asc: Math.max(base.asc, sup ? size * 0.45 + sup.asc : 0), desc: Math.max(base.desc, sub ? size * 0.25 + sub.desc : 0),
        draw(x, y) { base.draw(x, y); if (sup) sup.draw(x + base.w + size * 0.03, y - size * 0.45); if (sub) sub.draw(x + base.w + size * 0.03, y + size * 0.25); } };
    }
    case 'frac': {
      const s2 = size * 0.82, a = layout(g, node.a, s2, style), b = layout(g, node.b, s2, style), w = Math.max(a.w, b.w) + size * 0.3;
      const axis = size * 0.28;
      return { w, asc: axis + a.asc + a.desc + size * 0.12, desc: b.asc + b.desc + size * 0.12 - axis,
        draw(x, y) {
          a.draw(x + (w - a.w) / 2, y - axis - a.desc - size * 0.1);
          b.draw(x + (w - b.w) / 2, y - axis + b.asc + size * 0.14);
          g.fillRect(x + size * 0.05, y - axis - size * 0.03, w - size * 0.1, Math.max(1.5, size * 0.055));
        } };
    }
    case 'sqrt': {
      const a = layout(g, node.a, size, style), pre = size * 0.6;
      return { w: a.w + pre + size * 0.1, asc: a.asc + size * 0.18, desc: a.desc,
        draw(x, y) {
          a.draw(x + pre, y);
          g.save(); g.lineWidth = Math.max(1.5, size * 0.055); g.strokeStyle = g.fillStyle; g.beginPath();
          g.moveTo(x + size * 0.05, y - size * 0.2); g.lineTo(x + size * 0.18, y - size * 0.28); g.lineTo(x + size * 0.34, y + a.desc * 0.9);
          g.lineTo(x + pre - size * 0.05, y - a.asc - size * 0.1); g.lineTo(x + pre + a.w + size * 0.05, y - a.asc - size * 0.1); g.stroke(); g.restore();
        } };
    }
    case 'hat': case 'vec': case 'dot': case 'bar': {
      const a = layout(g, node.a, size, style), kind = node.k;
      return { w: a.w, asc: a.asc + size * 0.22, desc: a.desc,
        draw(x, y) {
          a.draw(x, y);
          const cx = x + a.w * 0.55, top = y - a.asc - size * 0.05;
          g.save(); g.lineWidth = Math.max(1.2, size * 0.045); g.strokeStyle = g.fillStyle; g.beginPath();
          if (kind === 'hat') { g.moveTo(cx - size * 0.16, top + size * 0.05); g.lineTo(cx, top - size * 0.1); g.lineTo(cx + size * 0.16, top + size * 0.05); }
          if (kind === 'bar') { g.moveTo(cx - size * 0.2, top); g.lineTo(cx + size * 0.2, top); }
          if (kind === 'vec') { g.moveTo(cx - size * 0.22, top); g.lineTo(cx + size * 0.22, top); g.moveTo(cx + size * 0.12, top - size * 0.08); g.lineTo(cx + size * 0.22, top); g.lineTo(cx + size * 0.12, top + size * 0.08); }
          g.stroke();
          if (kind === 'dot') { g.beginPath(); g.arc(cx, top, size * 0.05, 0, Math.PI * 2); g.fill(); }
          g.restore();
        } };
    }
  }
  return { w: 0, asc: 0, desc: 0, draw() {} };
}

export function formulaCanvas(src, o = {}) {
  const size = o.size ?? 96, pad = size * 0.5;
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const box = layout(g, parse(src), size);
  c.width = Math.ceil(box.w + pad * 2); c.height = Math.ceil(box.asc + box.desc + pad * 2);
  g.fillStyle = o.color ?? '#fff'; g.textBaseline = 'alphabetic';
  if (o.glow) { g.shadowColor = o.color ?? '#fff'; g.shadowBlur = size * o.glow; }
  layout(g, parse(src), size).draw(pad, pad + box.asc);
  return c;
}

export const formulaPlane = (src, worldH, o = {}) => planeFromCanvas(formulaCanvas(src, o), worldH, o);

// ---------------------------------------------------------------------------
// Glyph atlas for instanced "code" particles.

export const GLYPHS = [
  ...'{}()[];=+-*/<>!&|^%~?:.,_#$@\\\'"`',
  ...'0123456789',
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'αβγδεζηθλμπρσφψωΓΔΘΛΞΠΣΦΨΩ∀∃∈∇∂∫∑∏√∞≈≠≤≥±×→⇒⇔∧∨¬ℏ∮',
];
export const ATLAS_COLS = 16;

export function glyphAtlas() {
  const cell = 64, n = GLYPHS.length;
  const c = document.createElement('canvas'); c.width = cell * ATLAS_COLS; c.height = cell * 16;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  GLYPHS.forEach((ch, i) => {
    const x = (i % ATLAS_COLS) * cell + cell / 2, y = Math.floor(i / ATLAS_COLS) * cell + cell / 2;
    const math = i >= 94;
    g.font = `${math ? '' : '800 '}${cell * (math ? 0.72 : 0.78)}px ${math ? MATH : MONO}`;
    g.fillText(ch, x, y + cell * 0.04);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.anisotropy = 4;
  return { texture: tex, count: n, rows: 16 };
}

export const glyphIndex = ch => Math.max(0, GLYPHS.indexOf(ch));
