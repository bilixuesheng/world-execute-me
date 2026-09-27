// 01:13 — 01:28  Verse 2. Objects are instantiated from a cloud of points:
// an eggplant, a tomato, a tabby cat — and finally the Eye of God.
import * as THREE from 'three';
import { base, look, drift, fade, orbit } from './common.js';
import { morphPoints, shape, gridFloor, glyphField, fatLine } from '../engine/fx.js';
import { TypeText, formulaPlane, textPlane, MONO } from '../engine/text.js';
import { CUES, beatPulse } from '../timeline.js';
import { span, ease, lerp, TAU, clamp, bump } from '../engine/util.js';

export const N = 22000;

// --- shape generators -------------------------------------------------------
const PURPLE = [0.55, 0.12, 1.0], GREEN = [0.25, 1.1, 0.3], RED = [1.6, 0.12, 0.08];

const eggplant = shape(N, (i, r) => {
  if (i < N * 0.12) { // calyx + stem
    if (i < N * 0.02) { const h = r(); return [0.25 * 0.6 + Math.cos(r() * TAU) * 0.07, 1.35 + h * 0.55, Math.sin(r() * TAU) * 0.07, GREEN]; }
    const leaf = Math.floor(r() * 5), a = leaf / 5 * TAU + (r() - 0.5) * 0.35, rad = 0.1 + r() * 0.62;
    return [0.15 + Math.cos(a) * rad, 1.32 - rad * rad * 0.8 + (r() - 0.5) * 0.04, Math.sin(a) * rad, GREEN];
  }
  const v = r(), y = lerp(-1.7, 1.35, v);
  const prof = Math.pow(Math.sin(Math.PI * Math.pow(1 - v, 0.75)), 0.8) * (0.4 + 0.6 * Math.pow(1 - v, 0.6)) * 0.95 + 0.12;
  const phi = r() * TAU, bend = 0.3 * Math.pow((y + 1.7) / 3.05, 2);
  const shade = 0.55 + 0.45 * Math.max(0, Math.cos(phi - 0.8));
  return [Math.cos(phi) * prof + bend, y, Math.sin(phi) * prof, PURPLE.map(c => c * shade)];
}, 21);

const tomato = shape(N, (i, r) => {
  if (i < N * 0.08) {
    const leaf = Math.floor(r() * 5), a = leaf / 5 * TAU + (r() - 0.5) * 0.25, rad = r() * 0.7;
    return [Math.cos(a) * rad, 1.05 - rad * 0.25 + (r() - 0.5) * 0.03, Math.sin(a) * rad, GREEN];
  }
  const u = r() * 2 - 1, phi = r() * TAU, s = Math.sqrt(1 - u * u);
  const lobe = 1 + 0.07 * Math.cos(5 * phi) * s;
  const R = 1.35 * lobe, shade = 0.5 + 0.5 * Math.max(0, s * Math.cos(phi - 0.8) * 0.8 + u * 0.4);
  return [Math.cos(phi) * s * R, u * R * 0.8, Math.sin(phi) * s * R, RED.map(c => c * (0.6 + shade * 0.7))];
}, 22);

const cat = shape(N, (i, r) => {
  const orange = (x, y, z) => { const st = Math.sin(y * 9 + Math.sin(x * 3) * 1.5 + z * 2) > 0.35; return st ? [0.45, 0.15, 0.04] : [1.7, 0.75, 0.2]; };
  const ell = (cx, cy, cz, rx, ry, rz) => { const u = r() * 2 - 1, phi = r() * TAU, s = Math.sqrt(1 - u * u); const p = [cx + Math.cos(phi) * s * rx, cy + u * ry, cz + Math.sin(phi) * s * rz]; return [...p, orange(...p)]; };
  const k = i / N;
  if (k < 0.42) return ell(0, -0.55, 0, 0.85, 1.05, 0.72);            // body
  if (k < 0.72) return ell(0, 0.85, 0.15, 0.62, 0.52, 0.55);          // head
  if (k < 0.8) { // ears
    const side = k < 0.76 ? -1 : 1, h = r(), a = r() * TAU, rad = (1 - h) * 0.2;
    return [side * 0.36 + Math.cos(a) * rad, 1.25 + h * 0.42, 0.15 + Math.sin(a) * rad * 0.6, [1.7, 0.75, 0.2]];
  }
  if (k < 0.93) { // tail curling round the front
    const u = r(), a = -0.4 + u * 3.6, R = 1.05, a2 = r() * TAU, tr = 0.12 * (1 - u * 0.5);
    const p = [Math.cos(a) * R + Math.cos(a2) * tr, -1.45 + u * 0.35 + Math.sin(a2) * tr, Math.sin(a) * R * 0.8];
    return [...p, orange(...p)];
  }
  if (k < 0.96) { const side = k < 0.945 ? -1 : 1; const u = r() * 2 - 1, phi = r() * TAU, s = Math.sqrt(1 - u * u); return [side * 0.23 + Math.cos(phi) * s * 0.09, 0.93 + u * 0.1, 0.66 + Math.sin(phi) * s * 0.05, [0.6, 2.6, 0.8]]; } // eyes
  const side = r() < 0.5 ? -1 : 1, u = r(); // whiskers
  return [side * (0.25 + u * 0.7), 0.72 + (r() - 0.5) * 0.12 - u * 0.1 * side * 0, 0.68, [1.8, 1.8, 1.8]];
}, 23);

const GOLD = [2.0, 1.35, 0.45];
export const eye = shape(N, (i, r) => {
  const k = i / N;
  if (k < 0.3) { // almond outline (thick)
    const u = r() * 2 - 1, top = r() < 0.5 ? 1 : -1, y = top * 0.95 * (1 - u * u) + (r() - 0.5) * 0.06;
    return [u * 2.0, y, (r() - 0.5) * 0.1, GOLD];
  }
  if (k < 0.62) { // iris
    const a = r() * TAU, rad = 0.36 + Math.sqrt(r()) * 0.46;
    const streak = 0.7 + 0.3 * Math.sin(a * 23);
    return [Math.cos(a) * rad, Math.sin(a) * rad, 0.05, GOLD.map(c => c * streak)];
  }
  if (k < 0.8) { // triangle of providence
    const side = Math.floor(r() * 3), u = r(), A = [[0, 2.7], [-3.1, -1.75], [3.1, -1.75]];
    const p = A[side], q = A[(side + 1) % 3];
    return [lerp(p[0], q[0], u) + (r() - 0.5) * 0.05, lerp(p[1], q[1], u) + (r() - 0.5) * 0.05, -0.1, [1.6, 1.6, 1.9]];
  }
  const a = Math.floor(r() * 36) / 36 * TAU, rad = 3.2 + r() * 2.8; // rays
  return [Math.cos(a) * rad, Math.sin(a) * rad, -0.2 - r() * 0.3, GOLD.map(c => c * (1.3 - (rad - 3.2) / 2.8))];
}, 24);

const cloud = shape(N, (i, r) => { const u = r() * 2 - 1, phi = r() * TAU, s = Math.sqrt(1 - u * u), R = 0.2 + Math.cbrt(r()) * 4; return [Math.cos(phi) * s * R, u * R, Math.sin(phi) * s * R, [0.8, 0.9, 1.3]]; }, 25);

export function create({ atlas }) {
  const { scene, camera } = base(40);
  const C = CUES.objects, B = CUES.objectsB;

  const pts = morphPoints({ count: N, size: 0.04, color: [0.72, 0.72, 0.72], body: /* glsl */`
    p *= 1.0 + uA * 0.08 * sin(uTime * 150.0 + p.y * 3.0);  // purr vibration
    p += normalize(p + 0.001) * uB * aRand.z * 1.2;          // burst on cues
    bright = 0.9 + 0.5 * uB;` });
  scene.add(pts);

  const floor = gridFloor({ color: [0.3, 0.4, 0.9], cell: 0.5, fade: 5 });
  floor.position.y = -2.2; scene.add(floor);
  const ring = fatLine(Array.from({ length: 129 }, (_, i) => [Math.cos(i / 128 * TAU) * 2.4, -2.18, Math.sin(i / 128 * TAU) * 2.4]), { color: [1.2, 0.3, 0.6], width: 0.03 });
  scene.add(ring);

  const codeLines = [
    { text: 'let a = new Eggplant();' }, { text: 'let b = new Tomato();' },
    { text: 'let c = new TabbyCat();' }, { text: 'const god = God.getInstance();', color: '#ffd27a' },
  ];
  const code = new TypeText(codeLines, 0.028, { size: 44, color: '#dfe8ff', intensity: 1.1, rows: 4 });
  scene.add(camera); camera.add(code.mesh);
  code.mesh.position.set(-0.36, 0.2, -1);

  const facts = [
    textPlane('K  Mg  Fe  C₆H₁₂O₆', 0.32, { size: 64, color: '#c9a2ff', intensity: 1.3 }),
    textPlane('C₄₀H₅₆  // lycopene', 0.32, { size: 64, color: '#ff8a7a', intensity: 1.3 }),
    textPlane('~ 25–150 Hz ~', 0.32, { size: 64, color: '#ffc27a', intensity: 1.3 }),
  ];
  facts.forEach(f => scene.add(f));
  const proof = formulaPlane('you ⊢ ∃\\,me', 0.85, { size: 120, color: '#fff2c8', intensity: 1.6 });
  scene.add(proof);

  const halo = glyphField({
    count: 2000, atlas, size: 0.12, color: [1.0, 0.85, 0.4],
    positions: (i, r) => { const a = r() * TAU, rad = 6 + r() * 5; return [Math.cos(a) * rad, Math.sin(a) * rad, -1 - r() * 3]; },
    body: /* glsl */`p.xy = rot2(uTime * 0.05 * (aRand.x - 0.5)) * p.xy; glyph += floor(uTime * 4.0 * aRand.y); bright = uA * (0.3 + 0.7 * aRand.z);`,
  });
  scene.add(halo);

  const shapes = [cloud, eggplant, tomato, cat, eye];

  // Turntable spin that slows to a stop exactly facing the camera for the eye (integrated, so it never jumps).
  const spinRate = tt => 0.45 * (1 - THREE.MathUtils.smoothstep(tt, C[3] - 0.8, C[3] + 0.9));
  const integrate = (t0, t1) => { let r = 0; for (let x = t0; x < t1; x += 0.02) r += spinRate(x) * Math.min(0.02, t1 - x); return r; };
  const T0 = 70, total = integrate(T0, C[3] + 1.2);
  const settle = -(((total % TAU) + TAU + Math.PI) % TAU - Math.PI); // shortest turn to face front
  const spin = tt => integrate(T0, tt) + settle * THREE.MathUtils.smoothstep(tt, C[3] - 0.8, C[3] + 0.9) + Math.sin(tt * 0.5) * 0.25 * THREE.MathUtils.smoothstep(tt, C[3] + 0.9, C[3] + 2.5);

  return {
    scene, camera,
    update(t, ch, a) {
      const bp = beatPulse(t, 6);
      // which pair of shapes, and how far along the morph
      let idx = 0; C.forEach((c, i) => { if (t >= c - 0.35) idx = i + 1; });
      const from = shapes[Math.max(0, idx - 1)], to = shapes[idx];
      const mt = idx === 0 ? 0 : span(t, C[idx - 1] - 0.35, C[idx - 1] + 0.75, ease.inOut2);
      pts.userData.setShapes(from, to);
      const u = pts.material.uniforms;
      u.uTime.value = t; u.uMix.value = mt;
      u.uScatter.value = 0.02 + a.hit * 0.05;
      u.uA.value = t > B[2] && t < C[3] ? span(t, B[2], B[2] + 0.3) * (1 - span(t, C[3] - 0.5, C[3])) : 0;
      let burst = 0; for (const b of B.slice(0, 2)) burst = Math.max(burst, bump(t - b, 0.14) * 0.6);
      u.uB.value = burst;
      u.uSize.value = 0.04 * (1 + bp * 0.25);
      pts.rotation.y = spin(t);
      pts.position.y = 0.4 * span(t, C[3] - 0.35, C[3] + 0.75, ease.inOut2);

      floor.material.uniforms.uBright.value = 0.5 + bp * 0.3;
      fade(floor, 1 - span(t, C[3], C[3] + 0.8)); fade(ring, 1 - span(t, C[3], C[3] + 0.8));

      let n = 0; codeLines.forEach((l, i) => { n += clamp(Math.floor((t - C[i] + 0.1) * 40), 0, l.text.length); });
      code.set(n);
      fade(code.mesh, span(t, C[0], C[0] + 0.2) * (1 - span(t, 87.8, 88.3)));

      facts.forEach((f, i) => {
        const on = span(t, B[i], B[i] + 0.3) * (1 - span(t, C[i + 1] - 0.5, C[i + 1] - 0.1));
        fade(f, on); f.position.set(2.2, -1.7 + span(t, B[i], C[i + 1]) * 0.4, 0.6);
      });
      fade(proof, span(t, B[3], B[3] + 0.5));
      proof.position.set(0, -2.7, 0.8);
      proof.scale.setScalar(1 + span(t, B[3], 88.34) * 0.1);
      halo.material.uniforms.uTime.value = t; halo.material.uniforms.uA.value = span(t, C[3], C[3] + 1.2);

      // camera: circle the object, pull back for God
      const d = drift(t, 0.1, 0.4);
      const godK = span(t, C[3] - 0.3, C[3] + 1.2, ease.inOut3);
      const push = C.slice(0, 3).reduce((acc, c) => acc + bump(t - (c - 0.2), 0.35), 0) * 0.7; // soft push-in on each new object
      const r = lerp(7.2, 11, godK) - push;
      const az = lerp(Math.sin(t * 0.35) * 0.5, 0, godK);
      const p = orbit(r, az, lerp(0.18, 0.02, godK), [0, 0, 0]);
      look(camera, [p[0] + d[0], p[1] + d[1], p[2] + d[2]], [0.3 * (1 - godK), lerp(-0.1, 0.1, godK), 0], 0);

      return { bloom: 0.6 + bp * 0.25 + godK * 0.3, ca: 0.0015 + u.uB.value * 0.004, vignette: 0.55, tint: [1, 1, 1] };
    },
  };
}
