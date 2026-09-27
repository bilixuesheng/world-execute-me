// 00:44 — 00:58  Oscilloscope: AC and DC, lightning, a dizzy spiral,
// a tunnel through the years, and two points that finally meet.
import * as THREE from 'three';
import { base, look, drift, fade } from './common.js';
import { fatLine, glowDot, gridFloor, glyphField } from '../engine/fx.js';
import { textPlane, MONO } from '../engine/text.js';
import { CUES, beat, beatPulse } from '../timeline.js';
import { span, ease, lerp, TAU, rng, clamp } from '../engine/util.js';

const N = 260;
const YEARS = ['4.5×10⁹ BC', '3000 BC', '776 BC', '221 BC', '0', '79 AD', '622', '1066', '1492', '1687', '1789', '1879', '1905', '1945', '1969', '1989', '2016', '2077', '3000', '10¹⁰⁰'];

export function create({ atlas }) {
  const { scene, camera } = base(45);
  const C = CUES.current;

  // --- oscilloscope
  const scope = new THREE.Group(); scene.add(scope);
  const grat = gridFloor({ color: [0.2, 0.9, 0.55], cell: 1, fade: 7 });
  grat.rotation.set(0, 0, 0); grat.position.z = -0.05; grat.material.uniforms.uMajor.value = 5;
  scope.add(grat);
  const ac = fatLine(Array.from({ length: N + 1 }, () => [0, 0, 0]), { color: [0.3, 1.4, 1.8], width: 0.06 });
  const dc = fatLine(Array.from({ length: N + 1 }, () => [0, 0, 0]), { color: [1.8, 0.25, 0.5], width: 0.06 });
  scope.add(ac, dc);
  const arcs = Array.from({ length: 4 }, () => { const l = fatLine(Array.from({ length: 33 }, () => [0, 0, 0]), { color: [2.2, 2.2, 3.2], width: 0.025 }); scope.add(l); return l; });
  const lblAC = textPlane('AC  ∿  V₀·sin ωt', 0.32, { size: 60, color: '#7ff4ff', intensity: 1.6 });
  const lblDC = textPlane('DC  ⎓  V = IR', 0.32, { size: 60, color: '#ff7f9f', intensity: 1.6 });
  scope.add(lblAC, lblDC);

  // --- dizzy spiral: many rotated copies of the wave
  const spiral = new THREE.Group(); scene.add(spiral);
  const copies = Array.from({ length: 12 }, (_, i) => {
    const hue = i % 2 ? [0.2, 0.8, 1.1] : [1.1, 0.18, 0.4];
    const l = fatLine(Array.from({ length: N + 1 }, (_, k) => { const x = (k / N - 0.5) * 16; return [x, Math.sin(x * 1.3) * 0.8, 0]; }), { color: hue, width: 0.05 });
    l.rotation.z = i / 12 * Math.PI; spiral.add(l); return l;
  });

  // --- time tunnel
  const tunnel = new THREE.Group(); scene.add(tunnel);
  const years = YEARS.map((y, i) => {
    const m = textPlane(y, 0.9, { size: 120, weight: 800, family: MONO, color: i === 16 ? '#ff4d73' : '#e8f0ff', intensity: i === 16 ? 2.2 : 1.1 });
    const a = i * 2.4;
    m.position.set(Math.cos(a) * 3.2, Math.sin(a) * 1.9, -i * 7 - 6);
    m.rotation.z = Math.sin(a) * 0.2;
    tunnel.add(m); return m;
  });
  const ringPts = n => Array.from({ length: n + 1 }, (_, i) => [Math.cos(i / n * TAU) * 5, Math.sin(i / n * TAU) * 5, 0]);
  const rings = Array.from({ length: 16 }, (_, i) => { const r = fatLine(ringPts(96), { color: [0.5, 0.9, 2.0], width: 0.03 }); r.position.z = -i * 9; tunnel.add(r); return r; });
  const ticks = glyphField({
    count: 1400, atlas, size: 0.3, color: [0.6, 0.8, 1.4],
    positions: (i, r) => { const a = r() * TAU, rad = 4 + r() * 1.5; return [Math.cos(a) * rad, Math.sin(a) * rad, -r() * 140]; },
    body: /* glsl */`glyph = 32.0 + mod(floor(uTime * 8.0 + aRand.x * 10.0), 10.0); bright = uA * (0.3 + 0.7 * aRand.y);`,
  });
  tunnel.add(ticks);

  // --- two points uniting
  const me = glowDot(0.6, [4, 0.7, 1.3]), you = glowDot(0.6, [0.7, 3, 4]);
  const trailMe = fatLine(Array.from({ length: 121 }, () => [0, 0, 0]), { color: [1.6, 0.25, 0.5], width: 0.035 });
  const trailYou = fatLine(Array.from({ length: 121 }, () => [0, 0, 0]), { color: [0.25, 1.2, 1.7], width: 0.035 });
  const burst = fatLine(ringPts(128), { color: [3, 2.4, 2.8], width: 0.08 });
  scene.add(me, you, trailMe, trailYou, burst);

  const pairPos = (tt, who) => {
    const k = clamp((tt - C[6]) / (58.45 - C[6])); // 0 → 1 as they approach
    const r = lerp(4.2, 0, Math.pow(k, 1.6));
    const u = Math.max(0, tt - C[6]), a = 1.5 * u + 1.25 * u * u + (who ? Math.PI : 0);
    return [Math.cos(a) * r, Math.sin(tt * 1.7 + (who ? 1 : 0)) * r * 0.25, Math.sin(a) * r];
  };

  return {
    scene, camera,
    update(t, ch, a) {
      const bp = beatPulse(t, 7), q = beat(t);
      const inA = t < C[2], inB = t >= C[2] && t < C[4], inC = t >= C[4] && t < C[6], inD = t >= C[6];

      // --- A: scope
      scope.visible = t < C[2] + 0.6;
      if (scope.visible) {
        const split = span(t, C[1], C[1] + 0.5, ease.out3);
        const acPts = [], dcPts = [];
        for (let i = 0; i <= N; i++) {
          const x = (i / N - 0.5) * 11;
          acPts.push([x, lerp(0, 1.15, split) + Math.sin(x * 2.2 - t * 9) * (0.9 + a.bass * 0.5), 0]);
          const sq = Math.sign(Math.sin(x * 1.1 - t * 5));
          dcPts.push([x, lerp(0, -1.3, split) + lerp(sq * 0.5, 0.35, span(t, C[1] + 0.4, C[1] + 1.2)), 0]);
        }
        ac.userData.setPoints(acPts); dc.userData.setPoints(dcPts);
        const on = span(t, 44.0, 44.4);
        ac.userData.draw(span(t, 44.0, 44.8)); dc.userData.draw(span(t, C[1], C[1] + 0.6));
        fade(ac, on); fade(dc, span(t, C[1], C[1] + 0.2));
        grat.material.uniforms.uBright.value = 0.5 + bp * 0.3;
        // lightning between the two traces on every beat
        const r = rng(q.n * 7 + 3);
        arcs.forEach((l, j) => {
          const x0 = (r() - 0.5) * 9, pts = [];
          for (let i = 0; i <= 32; i++) { const u = i / 32; pts.push([x0 + (r() - 0.5) * 0.5 + u * (r() - 0.5) * 0.6, lerp(-1.2, 1.1, u), 0.02]); }
          l.userData.setPoints(pts);
          fade(l, split * Math.exp(-q.frac * 5) * (j < 2 ? 1 : a.hit));
        });
        lblAC.position.set(-3.6, 2.45, 0); lblDC.position.set(-3.8, -2.3, 0);
        fade(lblAC, span(t, C[1], C[1] + 0.4)); fade(lblDC, span(t, C[1] + 0.2, C[1] + 0.6));
        fade(grat, 1 - span(t, C[2], C[2] + 0.5));
      }

      // --- B: blind + dizzy
      spiral.visible = t > C[2] - 0.1 && t < C[4] + 0.4;
      if (spiral.visible) {
        const open = span(t, C[2], C[2] + 0.9, ease.out3);
        spiral.rotation.z = (t - C[2]) * lerp(0.5, 3.5, span(t, C[3], C[4], ease.in2));
        copies.forEach((l, i) => {
          l.scale.setScalar(lerp(0.2, 1.0, open) * (1 + 0.15 * Math.sin(t * 3 + i)));
          l.rotation.z = i / 12 * Math.PI + Math.sin(t * 1.3 + i) * 0.2 * span(t, C[3], C[3] + 1);
          l.position.z = Math.sin(i * 1.7 + t) * span(t, C[3], C[4]) * 2;
          fade(l, open * (1 - span(t, C[4] - 0.2, C[4] + 0.3)));
        });
      }

      // --- C: time tunnel
      tunnel.visible = inC || (t > C[4] - 0.2 && t < C[6] + 0.5);
      const fly = Math.max(0, t - C[4]);
      if (tunnel.visible) {
        tunnel.position.z = fly * 26 + fly * fly * 1.5;
        tunnel.rotation.z = (t >= C[5] ? -1 : 1) * fly * 0.4;
        years.forEach(m => { const wz = m.position.z + tunnel.position.z; fade(m, clamp(1 - Math.abs(wz + 12) / 16) * span(t, C[4], C[4] + 0.3)); });
        rings.forEach((r, i) => { r.material.linewidth = 0.03 + 0.05 * bp; fade(r, 0.8 * (1 - span(t, C[6] - 0.3, C[6] + 0.3))); });
        ticks.material.uniforms.uTime.value = t; ticks.material.uniforms.uA.value = 1 - span(t, C[6] - 0.3, C[6] + 0.2);
      }

      // --- D: unite
      const showPair = t > C[6] - 0.3;
      me.visible = you.visible = trailMe.visible = trailYou.visible = showPair && t < 58.5;
      if (showPair) {
        const pm = pairPos(t, 0), py = pairPos(t, 1);
        me.position.set(...pm); you.position.set(...py);
        const s = 0.55 * (1 + bp * 0.5);
        me.scale.setScalar(s); you.scale.setScalar(s);
        const tm = [], ty = [];
        for (let i = 0; i <= 120; i++) { const tt = t - (120 - i) * 0.012; tm.push(pairPos(tt, 0)); ty.push(pairPos(tt, 1)); }
        trailMe.userData.setPoints(tm); trailYou.userData.setPoints(ty);
        fade(trailMe, span(t, C[6], C[6] + 0.5)); fade(trailYou, span(t, C[6], C[6] + 0.5));
      }
      const bt = t - 58.45;
      burst.visible = bt > 0;
      if (bt > 0) { burst.scale.setScalar(0.1 + bt * 18); fade(burst, Math.exp(-bt * 4)); }

      // --- camera
      const d = drift(t, 0.1, 0.4);
      if (t < C[2]) look(camera, [d[0], 0.1 + d[1], 7.2 - span(t, 44.04, C[2], ease.inOut2) * 1.2], [0, 0, 0], d[2] * 0.1);
      else if (t < C[4]) {
        const roll = (t - C[2]) * lerp(0.3, 2.4, span(t, C[3], C[4], ease.in2));
        look(camera, [d[0], d[1], lerp(9, 5.5, span(t, C[2], C[4]))], [0, 0, 0], roll);
      } else if (t < C[6]) look(camera, [d[0] * 2, d[1] * 2, 4], [0, 0, -20], Math.sin(fly * 0.8) * 0.3);
      else {
        const k = span(t, C[6], 58.65, ease.inOut2);
        const r = lerp(12, 5, k), az = t * 0.35;
        look(camera, [Math.sin(az) * r + d[0], 2.5 - k * 1.5 + d[1], Math.cos(az) * r], [0, 0, 0], 0);
      }

      const blind = Math.exp(-Math.max(0, t - C[2]) * 2.2) * (t >= C[2] ? 1 : 0);
      return {
        bloom: 0.6 + bp * 0.25 + blind * 1.2, exposure: 1 + blind * 2.2, ca: 0.0015 + (inB ? 0.004 : 0),
        vignette: 0.55, barrel: inB ? 0.2 : 0, glitch: inA ? a.hit * 0.08 : 0,
        flash: t > 58.45 ? Math.exp(-(t - 58.45) * 5) * 0.7 : 0,
      };
    },
  };
}
