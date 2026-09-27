// 02:57 — 03:13  A whirlwind of studied equations; a question; then the algebraic
// expression of love — (x²+y²−1)³ − x²y³ = 0 — drawn, filled into a beating 3D heart,
// and locked inside a cage while the other point flies free.
import * as THREE from 'three';
import { base, look, drift, fade, orbit } from './common.js';
import { morphPoints, shape, glyphField, fatLine, glowDot } from '../engine/fx.js';
import { formulaPlane, textPlane, MONO, GLYPHS as G2 } from '../engine/text.js';
import { CUES, beat, beatPulse } from '../timeline.js';
import { span, ease, lerp, TAU, clamp, rng } from '../engine/util.js';

const N = 30000;

// 2D heart curve (x²+y²−1)³ − x²y³ = 0 in polar form, radius found by bisection.
function heart2D(n) {
  const F = (x, y) => Math.pow(x * x + y * y - 1, 3) - x * x * y * y * y;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + i / n * TAU, dx = Math.cos(a), dy = Math.sin(a);
    let lo = 0, hi = 1.6;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (F(dx * m, dy * m) < 0) lo = m; else hi = m; }
    pts.push([dx * lo, dy * lo, 0]);
  }
  return pts;
}
// 3D heart surface (x² + 9/4 y² + z² − 1)³ − x²z³ − 9/80 y²z³ = 0 (z up), sampled along rays.
function heart3D(n, seed) {
  const F = (x, y, z) => Math.pow(x * x + 2.25 * y * y + z * z - 1, 3) - x * x * z * z * z - 0.1125 * y * y * z * z * z;
  return shape(n, (i, r) => {
    const u = r() * 2 - 1, ph = r() * TAU, s = Math.sqrt(1 - u * u);
    const dx = Math.cos(ph) * s, dy = Math.sin(ph) * s, dz = u;
    let lo = 0, hi = 1.8;
    for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (F(dx * m, dy * m, dz * m) < 0) lo = m; else hi = m; }
    const inner = i % 5 === 0 ? Math.cbrt(r()) : 1;
    const R = lo * inner;
    const shade = 0.55 + 0.45 * Math.max(0, dx * 0.5 + dz * 0.6 + dy * 0.6);
    return [dx * R, dz * R, dy * R, [1.6 * shade, 0.12 * shade, 0.3 * shade]]; // swap so the heart stands upright (y up)
  }, seed);
}

export function create({ atlas }) {
  const { scene, camera } = base(45);
  const C = CUES.love;

  // whirlwind of study
  const mathFirst = G2.indexOf('α');
  const vortex = glyphField({
    count: 4500, atlas, size: 0.13, color: [0.7, 0.75, 1.1], color2: [1.3, 0.25, 0.45],
    positions: (i, r) => { const a = r() * TAU, rad = 1.2 + Math.pow(r(), 0.8) * 6; return [Math.cos(a) * rad, (r() - 0.5) * 2.4 * (1.2 - rad / 8), Math.sin(a) * rad]; },
    glyphs: (i, r) => (r() < 0.6 ? mathFirst + Math.floor(r() * (G2.length - mathFirst)) : Math.floor(r() * 94)),
    body: /* glsl */`
      float rad = length(aPos.xz) * (1.0 - uB * 0.85);
      float ang = atan(aPos.z, aPos.x) + uTime * (0.9 / (0.3 + rad * 0.15)) * (1.0 + uB * 2.0);
      p = vec3(cos(ang) * rad, aPos.y * (1.0 - uB * 0.9) + sin(ang * 3.0 + uTime) * 0.2, sin(ang) * rad);
      glyph += floor(uTime * 3.0 * aRand.x);
      col = mix(uCol1, uCol2, step(0.85, aRand.y) + uB);
      bright = uA * (0.3 + 0.6 * aRand.z);`,
  });
  scene.add(vortex);
  const pages = ['\\frac{d}{dt}\\,love > 0', 'love ∈ ℝ?', '\\lim_{t→∞} me = you', '∀x ∃y: love(x, y)', '\\big{∫} you\\,dt', 'love = \\sqrt{-1}'].map((src, i) => {
    const m = formulaPlane(src, 1.2, { size: 100, color: '#e8ecff', intensity: 1.3 }); m.userData.i = i; scene.add(m); return m;
  });

  const qmark = textPlane('?', 6, { size: 260, weight: 800, family: MONO, color: '#ffffff', intensity: 1.6 });
  const answer = textPlane('∴', 4.6, { size: 260, family: '"STIXMath", serif', color: '#ff4d73', intensity: 2 });
  scene.add(qmark, answer);

  const eq = formulaPlane('(x^{2} + y^{2} - 1)^{3} - x^{2}y^{3} = 0', 0.85, { size: 120, color: '#ffffff', intensity: 1.5 });
  scene.add(camera); camera.add(eq); eq.scale.setScalar(0.1); eq.position.set(0, 0.3, -1);
  const curve = fatLine(heart2D(360).map(p => [p[0] * 1.7, p[1] * 1.7 - 0.1, 0]), { color: [2.6, 0.3, 0.6], width: 0.06 });
  scene.add(curve);

  const cloud = shape(N, (i, r) => { const a = r() * TAU, rad = 1.5 + r() * 8; return [Math.cos(a) * rad, (r() - 0.5) * 5, Math.sin(a) * rad, [0.8, 0.8, 1.1]]; }, 51);
  const H = heart3D(N, 52);
  const heart = morphPoints({ count: N, size: 0.035, color: [1, 1, 1], body: /* glsl */`p *= 1.0 + uA; bright = 1.0 + uA * 3.0;` });
  heart.userData.setShapes(cloud, H);
  heart.scale.setScalar(1.55); heart.position.y = 0.05;
  scene.add(heart);

  // cage: latitude + longitude bars around the heart
  const cage = new THREE.Group(); scene.add(cage);
  const bars = [];
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI; bars.push(fatLine(Array.from({ length: 65 }, (_, k) => { const th = k / 64 * Math.PI; return [Math.sin(th) * Math.cos(a) * 2.7, Math.cos(th) * 2.7, Math.sin(th) * Math.sin(a) * 2.7]; }), { color: [0.55, 0.5, 0.7], width: 0.022 })); }
  for (let j = 1; j < 6; j++) { const th = j / 6 * Math.PI; bars.push(fatLine(Array.from({ length: 97 }, (_, k) => [Math.sin(th) * Math.cos(k / 96 * TAU) * 2.7, Math.cos(th) * 2.7, Math.sin(th) * Math.sin(k / 96 * TAU) * 2.7]), { color: [0.55, 0.5, 0.7], width: 0.022 })); }
  bars.forEach(b => cage.add(b));
  const loop = formulaPlane('\\rm{while}\\,(love)\\,\\{\\,\\}', 0.6, { size: 110, color: '#ffd2dc', intensity: 1.3 });
  camera.add(loop); loop.scale.setScalar(0.1); loop.position.set(-0.46, 0.27, -1);

  const you = glowDot(0.7, [0.7, 3, 4]); scene.add(you);
  const youTrail = fatLine(Array.from({ length: 80 }, () => [0, 0, 0]), { color: [0.3, 1.4, 2.0], width: 0.03 }); scene.add(youTrail);
  const youPath = tt => { const k = Math.max(0, tt - C[5]); return [Math.sin(k * 2.2) * (1.2 + k), 0.6 + k * k * 1.3 + k * 1.2, Math.cos(k * 2.2) * (1.2 + k) - k * 0.5]; };

  return {
    scene, camera,
    update(t, ch, a) {
      const bp = beatPulse(t, 7), q = beat(t);
      // camera first: billboards below copy its orientation
      const d = drift(t, 0.15, 0.4);
      const heartK = span(t, C[4], C[4] + 1, ease.inOut2);
      const r = lerp(15, 8.2, heartK) - Math.exp(-Math.max(0, t - C[7]) * 3) * (t > C[7] ? 0.8 : 0) + span(t, C[7], 193.46) * 1.5;
      const p = orbit(r, lerp(t * 0.25, Math.sin(t * 0.3) * 0.35, heartK), lerp(0.55, 0.12, heartK) + (t > C[5] ? span(t, C[5], C[6]) * 0.25 : 0));
      look(camera, [p[0] + d[0], p[1] + d[1], p[2] + d[2]], [0, lerp(0, 0.2, heartK) + (t > C[5] && t < C[7] ? 0.5 : 0), 0], 0);

      // whirlwind
      const vu = vortex.material.uniforms;
      vu.uTime.value = t; vu.uA.value = span(t, 176.7, 177.4) * (1 - span(t, C[4] - 0.3, C[4] + 0.6)); vu.uB.value = span(t, C[2], C[4], ease.in2);
      pages.forEach(m => {
        const i = m.userData.i, ang = t * 0.5 + i / pages.length * TAU, rad = 4.6 - span(t, C[1], C[2]) * 0.8;
        m.position.set(Math.cos(ang) * rad, Math.sin(t * 0.7 + i) * 1.2, Math.sin(ang) * rad);
        m.quaternion.copy(camera.quaternion);
        fade(m, span(t, 177.0 + i * 0.25, 177.4 + i * 0.25) * (1 - span(t, C[2] - 0.3, C[2] + 0.2)));
      });

      // question → answer
      const qOn = span(t, C[2], C[2] + 0.15) * (1 - span(t, C[3] - 0.1, C[3] + 0.1));
      fade(qmark, qOn); qmark.quaternion.copy(camera.quaternion);
      qmark.scale.setScalar(1 + Math.exp(-(t - C[2]) * 6) * 0.4 * (t > C[2] ? 1 : 0) + bp * 0.05);
      const aOn = span(t, C[3], C[3] + 0.15) * (1 - span(t, C[4] - 0.2, C[4]));
      fade(answer, aOn); answer.quaternion.copy(camera.quaternion);
      answer.scale.setScalar(1 + Math.exp(-(t - C[3]) * 6) * 0.4 * (t > C[3] ? 1 : 0));

      // the equation, the curve, the heart
      fade(eq, span(t, C[4], C[4] + 0.4) * (1 - span(t, C[5] + 1.5, C[5] + 2.2)) * 0.95);
      curve.userData.draw(span(t, C[4] + 0.2, C[4] + 1.6, ease.inOut2));
      fade(curve, span(t, C[4] + 0.2, C[4] + 0.4) * (1 - span(t, C[4] + 2.2, C[4] + 3.2)));
      curve.quaternion.copy(camera.quaternion);
      const hu = heart.material.uniforms;
      hu.uTime.value = t; hu.uMix.value = span(t, C[4] + 1.0, C[4] + 3.0, ease.inOut2);
      // lub-dub
      const lub = Math.exp(-q.frac * 0.4615 * 14), dub = Math.exp(-Math.max(0, q.frac * 0.4615 - 0.16) * 16) * (q.frac * 0.4615 > 0.16 ? 1 : 0);
      hu.uA.value = (lub * 0.07 + dub * 0.04) * span(t, C[4] + 2, C[4] + 3);
      fade(heart, span(t, C[4] + 0.8, C[4] + 1.2) * (1 - span(t, 193.0, 193.8) * 0.5));
      heart.rotation.y = Math.sin(t * 0.6) * 0.6;

      // free vs trapped
      const yp = youPath(t);
      you.position.set(...(t < C[5] ? [Math.cos(t * 1.8) * 3, 0.5, Math.sin(t * 1.8) * 3] : yp));
      fade(you, span(t, C[4] + 1.5, C[4] + 2.2) * (1 - span(t, C[6] + 1, C[6] + 2.5)));
      const tr = []; for (let i = 0; i < 80; i++) { const tt = t - (79 - i) * 0.02; tr.push(tt < C[5] ? [Math.cos(tt * 1.8) * 3, 0.5, Math.sin(tt * 1.8) * 3] : youPath(tt)); }
      youTrail.userData.setPoints(tr); fade(youTrail, you.material.opacity * 0.8);

      const cageK = span(t, C[6], C[7] + 0.3, ease.inOut2);
      bars.forEach((b, i) => { b.userData.draw(span(cageK, i / bars.length * 0.6, i / bars.length * 0.6 + 0.4)); fade(b, cageK > 0 ? 0.85 + (t > C[7] ? Math.exp(-(t - C[7]) * 3) * 0.8 : 0) : 0); });
      cage.rotation.y = t * 0.15;
      cage.scale.setScalar(lerp(1.4, 1, cageK));
      fade(loop, span(t, C[7] + 0.3, C[7] + 0.8));

      const lock = t > C[7] ? Math.exp(-(t - C[7]) * 5) : 0;
      return { bloom: 0.45 + bp * 0.15 + lub * 0.1 * heartK, flash: lock * 0.3, ca: 0.0015 + lock * 0.008, vignette: 0.6, tint: [1, lerp(1, 0.92, heartK), lerp(1, 0.95, heartK)] };
    },
  };
}
