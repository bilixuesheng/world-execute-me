// Reusable GPU building blocks. Everything animates from uniforms (uTime etc.),
// so a frame at time t never depends on the frames before it.

import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { ATLAS_COLS } from './text.js';
import { rng } from './util.js';

export const NOISE_GLSL = /* glsl */`
  vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x){ return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0; vec4 s1 = floor(b1) * 2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
  mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
`;

// ---------------------------------------------------------------------------
// GlyphField: many camera-facing characters. `body` is GLSL that may modify
//   vec3 p (world-ish position, starts at aPos), float size, float bright, vec3 col, float glyph
// using attributes aPos, aRand (vec4 in 0..1), aGlyph and uniforms uTime, uA..uD (floats), uCol1/uCol2.

export function glyphField({ count, atlas, positions, glyphs, body = '', size = 0.3, color = [1, 1, 1], color2 = [0.2, 0.9, 1], seed = 7, facing = 'camera', fog = 0 }) {
  const quad = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = quad.index; g.setAttribute('position', quad.getAttribute('position')); g.setAttribute('uv', quad.getAttribute('uv'));
  const pos = new Float32Array(count * 3), rnd = new Float32Array(count * 4), gl = new Float32Array(count);
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const p = positions ? positions(i, r) : [0, 0, 0];
    pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
    for (let k = 0; k < 4; k++) rnd[i * 4 + k] = r();
    gl[i] = glyphs ? glyphs(i, r) : Math.floor(r() * atlas.count);
  }
  g.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3));
  g.setAttribute('aRand', new THREE.InstancedBufferAttribute(rnd, 4));
  g.setAttribute('aGlyph', new THREE.InstancedBufferAttribute(gl, 1));
  g.instanceCount = count;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: atlas.texture }, uCount: { value: atlas.count }, uTime: { value: 0 }, uSize: { value: size },
      uA: { value: 0 }, uB: { value: 0 }, uC: { value: 0 }, uD: { value: 0 }, uFog: { value: fog },
      uCol1: { value: new THREE.Vector3(...color) }, uCol2: { value: new THREE.Vector3(...color2) }, uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */`
      ${NOISE_GLSL}
      attribute vec3 aPos; attribute vec4 aRand; attribute float aGlyph;
      uniform float uTime, uSize, uA, uB, uC, uD, uCount, uFog; uniform vec3 uCol1, uCol2;
      varying vec2 vUv; varying vec3 vCol; varying float vBright;
      void main(){
        vec3 p = aPos; float size = uSize; float bright = 1.0; vec3 col = uCol1; float glyph = aGlyph;
        ${body}
        glyph = mod(floor(glyph), uCount);
        vec2 cell = vec2(mod(glyph, ${ATLAS_COLS}.0), floor(glyph / ${ATLAS_COLS}.0));
        vUv = (cell + vec2(uv.x, 1.0 - uv.y)) / ${ATLAS_COLS}.0; vUv.y = 1.0 - vUv.y;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        ${facing === 'camera' ? 'mv.xy += position.xy * size;' : ''}
        ${facing !== 'camera' ? 'mv = modelViewMatrix * vec4(p + vec3(position.xy * size, 0.0), 1.0);' : ''}
        float fogK = uFog > 0.0 ? exp(-uFog * max(0.0, -mv.z)) : 1.0;
        vCol = col; vBright = bright * fogK;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uAtlas; uniform float uOpacity; varying vec2 vUv; varying vec3 vCol; varying float vBright;
      void main(){ float a = texture2D(uAtlas, vUv).a; if (a < 0.02) discard; gl_FragColor = vec4(vCol * vBright * a * uOpacity, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------------------
// MorphPoints: a point cloud that morphs between two shapes (set with setShapes).
// Shapes are Float32Arrays of length count*3.

export function morphPoints({ count, size = 0.05, color = [1, 0.3, 0.4], body = '', seed = 3 }) {
  const g = new THREE.BufferGeometry();
  const a = new Float32Array(count * 3), b = new Float32Array(count * 3), rnd = new Float32Array(count * 4);
  const ca = new Float32Array(count * 3).fill(1), cb = new Float32Array(count * 3).fill(1);
  const r = rng(seed); for (let i = 0; i < count * 4; i++) rnd[i] = r();
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  g.setAttribute('aTo', new THREE.BufferAttribute(b, 3));
  g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4));
  g.setAttribute('aCol', new THREE.BufferAttribute(ca, 3));
  g.setAttribute('aColTo', new THREE.BufferAttribute(cb, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uMix: { value: 0 }, uSize: { value: size }, uPx: { value: 1080 }, uCol: { value: new THREE.Vector3(...color) },
      uCol2: { value: new THREE.Vector3(1, 1, 1) }, uScatter: { value: 0 }, uA: { value: 0 }, uB: { value: 0 }, uC: { value: 0 }, uOpacity: { value: 1 }, uMaxSize: { value: 0.03 },
    },
    vertexShader: /* glsl */`
      ${NOISE_GLSL}
      attribute vec3 aTo, aCol, aColTo; attribute vec4 aRand;
      uniform float uTime, uMix, uSize, uPx, uScatter, uA, uB, uC, uMaxSize; uniform vec3 uCol, uCol2;
      varying vec3 vCol; varying float vBright;
      void main(){
        float d = clamp(uMix * 1.6 - aRand.x * 0.6, 0.0, 1.0); d = d * d * (3.0 - 2.0 * d);
        vec3 p = mix(position, aTo, d);
        vec3 sw = vec3(snoise(p * .6 + uTime * .3 + aRand.xyz * 4.), snoise(p * .6 + 11.3 + uTime * .3), snoise(p * .6 + 23.1 - uTime * .3));
        p += sw * (sin(d * 3.14159) * 0.8 + uScatter);
        float size = uSize * (0.6 + aRand.y * 0.8); float bright = 1.0; vec3 col = uCol * mix(aCol, aColTo, d);
        ${body}
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = min(size * uPx / max(0.1, -mv.z), uPx * uMaxSize);
        vCol = col; vBright = bright;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uOpacity; varying vec3 vCol; varying float vBright;
      void main(){ vec2 c = gl_PointCoord - .5; float r = length(c); if (r > .5) discard;
        float a = smoothstep(.5, .0, r); a = a * a; gl_FragColor = vec4(vCol * vBright * a * uOpacity, 1.); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  let cur = [null, null];
  // Shapes are { pos: Float32Array, col?: Float32Array } (or a bare Float32Array of positions).
  pts.userData.setShapes = (from, to) => {
    if (cur[0] === from && cur[1] === to) return;
    cur = [from, to];
    a.set(from.pos ?? from); b.set(to.pos ?? to);
    if (from.col) ca.set(from.col); else ca.fill(1);
    if (to.col) cb.set(to.col); else cb.fill(1);
    for (const k of ['position', 'aTo', 'aCol', 'aColTo']) g.attributes[k].needsUpdate = true;
  };
  return pts;
}

// Sample `count` points from a generator (i, r) → [x, y, z] or [x, y, z, [r, g, b]].
export function shape(count, fn, seed = 11) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3).fill(1), r = rng(seed);
  for (let i = 0; i < count; i++) {
    const p = fn(i, r, count);
    pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
    if (p[3]) { col[i * 3] = p[3][0]; col[i * 3 + 1] = p[3][1]; col[i * 3 + 2] = p[3][2]; }
  }
  return { pos, col };
}

// ---------------------------------------------------------------------------
// Infinite neon grid floor (fragment-shader lines).

export function gridFloor({ size = 400, color = [0.3, 0.9, 1], cell = 1, fade = 60 } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uCol: { value: new THREE.Vector3(...color) }, uCell: { value: cell }, uFade: { value: fade }, uTime: { value: 0 },
      uWave: { value: 0 }, uWaveR: { value: 0 }, uBright: { value: 1 }, uMajor: { value: 8 }, uScroll: { value: 0 },
    },
    // Lines are laid out in the plane's own coordinates, so the grid works at any orientation.
    vertexShader: /* glsl */`varying vec2 vL; void main(){ vL = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */`
      uniform vec3 uCol; uniform float uCell, uFade, uTime, uWave, uWaveR, uBright, uMajor, uScroll; varying vec2 vL;
      float line(vec2 p, float w){ vec2 g = abs(fract(p - .5) - .5) / max(fwidth(p), vec2(1e-4)); return 1. - min(min(g.x, g.y) / w, 1.); }
      void main(){
        vec2 p = vL / uCell + vec2(0., uScroll);
        float l = line(p, 1.) * .55 + line(p / uMajor, 1.4) * .9;
        float d = length(vL);
        float fade = exp(-d / uFade);
        float ring = uWave * exp(-abs(d - uWaveR) * .6);
        vec3 c = uCol * (l * (0.6 + ring * 3.) + ring * .15) * fade * uBright;
        gl_FragColor = vec4(c, 1.);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2;
  return m;
}

// ---------------------------------------------------------------------------
// Fat neon lines (world-space width) with a "draw-on" progress.

export function fatLine(points, { color = [1, 1, 1], width = 0.05, opacity = 1 } = {}) {
  const geo = new LineGeometry();
  const flat = []; for (const p of points) flat.push(p.x ?? p[0], p.y ?? p[1], p.z ?? p[2] ?? 0);
  geo.setPositions(flat);
  const mat = new LineMaterial({ color: new THREE.Color(...color), linewidth: width, worldUnits: true, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  mat.resolution.set(1920, 1080);
  const line = new Line2(geo, mat);
  line.frustumCulled = false;
  const segs = points.length - 1;
  line.userData.draw = p => { geo.instanceCount = Math.max(0, Math.min(segs, Math.floor(segs * p))); };
  line.userData.setPoints = pts => {
    const f = []; for (const p of pts) f.push(p.x ?? p[0], p.y ?? p[1], p.z ?? p[2] ?? 0);
    geo.setPositions(f);
  };
  return line;
}

// Glowing sprite dot (a soft radial texture), handy for "points", stars, cores.
let dotTex = null;
export function dotTexture() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.15, 'rgba(255,255,255,.85)'); grd.addColorStop(0.4, 'rgba(255,255,255,.2)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}
export function glowDot(size = 1, color = [1, 1, 1]) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(), color: new THREE.Color(...color), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  s.scale.setScalar(size);
  return s;
}

export const hdr = (hex, k = 1) => { const c = new THREE.Color(hex); return [c.r * k, c.g * k, c.b * k]; };

// Palette
export const PAL = {
  me: 0xff2a55,   // crimson: "me"
  you: 0x33e6ff,  // cyan: "you"
  code: 0xe8f0ff, // near-white code
  gold: 0xffc46b,
  violet: 0x8a5cff,
  warn: 0xff3b30,
};
