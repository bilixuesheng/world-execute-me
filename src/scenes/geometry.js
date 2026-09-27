// 00:29 — 00:44  A lesson in shapes: a point gains dimensions, a circle is traced,
// it unrolls into a sine wave (with a sliding tangent), and the wave folds into ∞.
import * as THREE from 'three';
import { base, look, drift, fade } from './common.js';
import { fatLine, glowDot, glyphField, gridFloor } from '../engine/fx.js';
import { formulaPlane, glyphIndex, GLYPHS } from '../engine/text.js';
import { CUES, beatPulse } from '../timeline.js';
import { span, ease, lerp, TAU, clamp, glide, bump } from '../engine/util.js';

const N = 400;
const PI_DIGITS = '3.14159265358979323846264338327950288419716939937510582097494459230781640628620899862803482534211706798214808651';

export function create({ atlas }) {
  const { scene, camera } = base(42);
  const [c0, c1, c2, c3] = CUES.geometry, [b0, b1, b2, b3] = CUES.geometryB;

  // Graph paper behind everything.
  const paper = gridFloor({ color: [0.25, 0.35, 0.6], cell: 0.5, fade: 9 });
  paper.rotation.set(0, 0, 0); paper.position.set(0, 0, -3);
  paper.material.uniforms.uMajor.value = 4;
  scene.add(paper);

  // Axes
  const axes = [
    fatLine([[-6, 0, 0], [6, 0, 0]], { color: [1.6, 0.35, 0.5], width: 0.022 }),
    fatLine([[0, -3.5, 0], [0, 3.5, 0]], { color: [1.2, 1.2, 1.3], width: 0.022 }),
    fatLine([[0, 0, -6], [0, 0, 6]], { color: [0.3, 1.2, 1.6], width: 0.022 }),
  ];
  axes.forEach(a => scene.add(a));

  const R = 1.6;
  const circle = fatLine(Array.from({ length: N + 1 }, (_, i) => [R * Math.cos(i / N * TAU), R * Math.sin(i / N * TAU), 0]), { color: [1.1, 1.1, 1.25], width: 0.045 });
  const radius = fatLine([[0, 0, 0], [R, 0, 0]], { color: [2.4, 0.5, 0.8], width: 0.03 });
  const wave = fatLine(Array.from({ length: N + 1 }, () => [0, 0, 0]), { color: [0.3, 1.2, 1.6], width: 0.05 });
  const link = fatLine([[0, 0, 0], [1, 0, 0]], { color: [1, 1, 1], width: 0.012 });
  const tangent = fatLine([[-1, 0, 0], [1, 0, 0]], { color: [2.6, 1.6, 0.4], width: 0.03 });
  [circle, radius, wave, link, tangent].forEach(l => scene.add(l));

  const dot = glowDot(0.5, [4, 0.8, 1.4]); scene.add(dot);
  const dot2 = glowDot(0.35, [0.8, 3, 4]); scene.add(dot2);

  // π written around the circle
  const piRing = glyphField({
    count: 96, atlas, size: 0.2, color: [0.9, 0.9, 1.1],
    positions: i => { const a = Math.PI / 2 - i / 96 * TAU; return [Math.cos(a) * (R + 0.42), Math.sin(a) * (R + 0.42), 0]; },
    glyphs: i => glyphIndex(PI_DIGITS[i % PI_DIGITS.length]),
    body: /* glsl */`
      float idx = float(gl_InstanceID) / 96.0;
      bright = smoothstep(idx, idx + 0.02, uA) * (0.7 + 0.3 * sin(uTime * 3.0 + idx * 40.0));
      p.xy = rot2(uB) * p.xy; p.x += uC;`,
  });
  scene.add(piRing);

  // Drifting math glyphs
  const mathFirst = GLYPHS.indexOf('α');
  const dust = glyphField({
    count: 700, atlas, size: 0.16, color: [0.45, 0.55, 0.9],
    positions: (i, r) => [(r() - 0.5) * 22, (r() - 0.5) * 12, -2 - r() * 8],
    glyphs: (i, r) => mathFirst + Math.floor(r() * (GLYPHS.length - mathFirst)),
    body: /* glsl */`p.y += mod(uTime * (0.1 + aRand.x * 0.2) + aRand.y * 12.0, 12.0) - 6.0 - aPos.y; bright = uA * (0.25 + 0.75 * aRand.z);`,
  });
  scene.add(dust);

  const F = (src, h, color = '#ffffff', k = 1.4) => { const m = formulaPlane(src, h, { size: 110, color, intensity: k }); scene.add(m); return m; };
  const fDim = F('\\rm{dim}\\,P = 0', 0.55);
  const fR3 = F('P ∈ ℝ^{3}', 0.55, '#ffd9e2');
  const fCirc = F('C = 2πr', 0.7, '#ffffff');
  const fDeriv = F('\\frac{d}{dx}\\sin x = \\cos x', 0.95, '#ffe0a0');
  const fLim = F('\\lim_{x→∞}\\,\\frac{1}{x} = 0', 1.0, '#bfefff');

  const lemn = (u, a) => { const th = u * TAU + Math.PI / 2, s = Math.sin(th), d = 1 + s * s; return [a * Math.cos(th) / d, a * s * Math.cos(th) / d, 0]; };

  return {
    scene, camera,
    update(t, ch, a) {
      const bp = beatPulse(t, 6);
      paper.material.uniforms.uBright.value = 0.2 + 0.15 * bp;
      dust.material.uniforms.uTime.value = t; dust.material.uniforms.uA.value = span(t, c0, c0 + 2);

      // --- point & axes
      const axIn = [span(t, b0, b0 + 0.6, ease.out3), span(t, b0 + 0.2, b0 + 0.8, ease.out3), span(t, b0 + 0.4, b0 + 1.0, ease.out3)];
      const axOut = 1 - span(t, c1 - 0.3, c1 + 0.4);
      axes.forEach((l, i) => { l.userData.draw(axIn[i]); fade(l, axOut * (i === 2 ? 0.6 : 0.9) + span(t, c2, c2 + 1) * 0.35 * (i === 0 ? 1 : 0)); });
      fade(fDim, span(t, c0 + 0.2, c0 + 0.8) * (1 - span(t, b0 - 0.2, b0 + 0.2)));
      fade(fR3, span(t, b0 + 0.3, b0 + 0.9) * (1 - span(t, c1 - 0.3, c1)));
      fDim.position.set(1.2, 0.8, 0.2); fR3.position.set(1.4, 0.9, 0.2);

      // --- circle traced by the radius. θ is the one angle everything below follows:
      // the red point rides the circle at θ, and the sine wave is that same point unrolled.
      const grow = span(t, c1, c1 + 0.45, ease.out3);               // radius extends out of the centre point
      const trace = span(t, c1 + 0.3, c1 + 1.6, ease.inOut2);       // then sweeps the circle once
      const OMEGA = 2.1;
      const theta = trace * TAU + Math.max(0, t - (c1 + 1.6)) * OMEGA;
      const cx = lerp(0, -3.4, span(t, c2 - 0.2, c2 + 0.9, ease.inOut3));
      circle.position.x = cx; radius.position.x = cx;
      circle.userData.draw(trace);
      fade(circle, span(t, c1 + 0.3, c1 + 0.4) * (1 - span(t, c3 + 0.4, c3 + 1.4)));
      const rr = R * grow;
      const px = Math.cos(theta) * rr, py = Math.sin(theta) * rr;
      radius.userData.setPoints([[0, 0, 0], [px, py, 0]]);
      fade(radius, span(t, c1, c1 + 0.15) * (1 - span(t, c3, c3 + 0.8)));
      fade(fCirc, span(t, b1, b1 + 0.5) * (1 - span(t, c2 - 0.2, c2 + 0.3)));
      fCirc.position.set(0, -2.45, 0.2);
      piRing.material.uniforms.uTime.value = t;
      piRing.material.uniforms.uA.value = span(t, b1, b1 + 1.6);
      piRing.material.uniforms.uB.value = -(t - c1) * 0.25;
      piRing.material.uniforms.uC.value = cx;
      fade(piRing, 1 - span(t, c2 + 0.5, c2 + 1.2));

      // --- the sine wave: y(x) = R·sin(θ − (x − xs)/R), so at its start x = xs it sits exactly
      // at the height of the point on the circle, and it travels right as θ turns.
      const xs = cx + R + 0.55;
      const len = 8.6 * span(t, c2 + 0.3, c2 + 2.2, ease.inOut2);
      const m = span(t, c3, c3 + 1.6, ease.inOut3);
      const aL = 3.4 + span(t, c3 + 1.6, 44.04, ease.in2) * 0.6;
      const pts = new Array(N + 1);
      for (let i = 0; i <= N; i++) {
        const u = i / N, x = xs + u * Math.max(len, 0.001);
        const sy = R * Math.sin(theta - (x - xs) / R);
        const l = lemn(u, aL);
        pts[i] = [lerp(x, l[0], m), lerp(sy, l[1], m), 0];
      }
      wave.userData.setPoints(pts);
      wave.userData.draw(1);
      fade(wave, span(t, c2 + 0.25, c2 + 0.45));
      wave.material.linewidth = 0.05 * (1 + 0.4 * bp);

      // points: red rides the circle; cyan marks where the wave is being drawn from
      const onCircle = [cx + px, py, 0];
      const waveStart = pts[0];
      const runU = Math.max(0, t - c3) * 0.28;
      const run = pts[Math.floor((runU % 1) * N)];
      const toRun = span(t, c3, c3 + 0.9, ease.inOut2);
      const dp = onCircle.map((v, i) => lerp(v, run[i], toRun));
      dot.position.set(...dp);
      dot.scale.setScalar(0.45 * (1 + bp * 0.6 + a.hit * 0.4) * (0.4 + 0.6 * span(t, c0, c0 + 0.3)));
      fade(dot2, span(t, c2 + 0.3, c2 + 0.6) * (1 - span(t, c3, c3 + 0.5)));
      dot2.position.set(...waveStart);
      link.userData.setPoints([onCircle, [waveStart[0], onCircle[1], 0]]);
      fade(link, span(t, c2 + 0.3, c2 + 0.6) * (1 - span(t, c3 - 0.3, c3)) * 0.8);

      // tangent sliding along the wave
      const tu = 0.12 + 0.7 * span(t, b2, c3 - 0.1, ease.inOut2);
      const ti = Math.min(N - 2, Math.floor(tu * N)), tp = pts[ti], tq = pts[ti + 2];
      const dx = tq[0] - tp[0], dy = tq[1] - tp[1], dl = Math.hypot(dx, dy) || 1;
      tangent.userData.setPoints([[tp[0] - dx / dl * 1.4, tp[1] - dy / dl * 1.4, 0.01], [tp[0] + dx / dl * 1.4, tp[1] + dy / dl * 1.4, 0.01]]);
      fade(tangent, span(t, b2, b2 + 0.3) * (1 - span(t, c3 - 0.2, c3 + 0.2)));
      fade(fDeriv, span(t, b2 + 0.2, b2 + 0.7) * (1 - span(t, c3 - 0.1, c3 + 0.3)));
      fDeriv.position.set(1.6, 2.2, 0.2);
      fade(fLim, span(t, b3, b3 + 0.5) * (1 - span(t, 43.4, 44.0)));
      fLim.position.set(0, -2.3, 0.4);

      // camera: glides between framings (no jumps), a soft push-in on each phrase, dive into ∞ at the end
      const d = drift(t, 0.12, 0.35);
      const camZ0 = glide(t, [[0, 5.2], [c1, 6.8], [c2, 9.5], [c3, 8.6]], 1.2);
      const camX = glide(t, [[0, 0.4], [c1, 0], [c2, 0.4], [c3, 0]], 1.2), camY = 0.2;
      const punch = [c0, c1, c2, c3].reduce((acc, c) => acc + bump(t - c, 0.3), 0) * 0.6;
      const dive = span(t, 42.6, 44.1, ease.in3);
      const camZ = lerp(camZ0 - punch, 0.9, dive);
      const az = Math.sin(t * 0.3) * 0.18 + span(t, b0, c1, ease.inOut2) * 0.7 * (1 - span(t, c1, c1 + 1.4, ease.inOut2));
      look(camera, [camX + Math.sin(az) * camZ + d[0], camY + d[1] + Math.sin(az) * 0.4, Math.cos(az) * camZ + d[2]], [camX * 0.5, 0, 0], d[2] * 0.2);

      return { bloom: 0.55 + bp * 0.25, ca: 0.0015 + dive * 0.01, vignette: 0.55, scan: 0.04, barrel: dive * 0.4 };
    },
  };
}
