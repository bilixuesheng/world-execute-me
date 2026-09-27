// 00:16 — 00:29  Instrumental. The point unfolds a grid; a city of code grows out of it.
import { base, look, drift, orbit } from './common.js';
import { glyphField, gridFloor, glowDot } from '../engine/fx.js';
import { beat, barPulse, beatPulse } from '../timeline.js';
import { span, ease, lerp } from '../engine/util.js';

export function create({ atlas }) {
  const { scene, camera } = base(55);

  const grid = gridFloor({ color: [0.25, 0.75, 1.0], cell: 1, fade: 26 });
  scene.add(grid);

  // Columns of code standing on the grid.
  const cols = [];
  for (let x = -40; x <= 40; x += 2) for (let z = -40; z <= 40; z += 2) {
    const d = Math.hypot(x, z);
    if (d > 3.5 && d < 42) cols.push([x, z]);
  }
  const ROWS = 30, SP = 0.42;
  const pillars = glyphField({
    count: cols.length * ROWS, atlas, size: 0.36, color: [0.75, 0.9, 1.0], color2: [1.0, 0.18, 0.35],
    positions: i => { const c = cols[Math.floor(i / ROWS)]; return [c[0], (i % ROWS) * SP + 0.25, c[1]]; },
    body: /* glsl */`
      float h = hash11(aPos.x * 13.17 + aPos.z * 7.71);
      float row = floor(aPos.y / ${SP.toFixed(2)});
      float d = length(aPos.xz);
      float H = floor(4.0 + h * h * 26.0);
      float grow = clamp((uA - d) / 8.0, 0.0, 1.0);
      float vis = step(row, H * grow - 1.0);
      float head = fract(uTime * (0.35 + h * 0.5) + h * 7.0);
      float hl = exp(-abs(row / H - (1.0 - head)) * 18.0);
      glyph += floor(uTime * (3.0 + aRand.x * 8.0) * (0.2 + hl));
      col = mix(uCol1, uCol2, step(0.9, h));
      bright = vis * (0.18 + hl * 1.8 + uB * 0.5) * exp(-d * 0.035) * uC;
      size *= vis;`,
  });
  scene.add(pillars);

  // Sky of faint code.
  const sky = glyphField({
    count: 3000, atlas, size: 1.1, color: [0.35, 0.45, 0.75], fog: 0,
    positions: (i, r) => { const th = r() * Math.PI * 2, ph = Math.acos(r() * 0.9); const R = 120; return [R * Math.sin(ph) * Math.cos(th), R * Math.cos(ph) - 10, R * Math.sin(ph) * Math.sin(th)]; },
    body: /* glsl */`glyph += floor(uTime * (1.0 + aRand.x * 3.0)); bright = uA * (0.2 + 0.8 * step(0.8, aRand.y)) * (0.6 + 0.4 * sin(uTime * 2.0 + aRand.z * 30.0));`,
  });
  scene.add(sky);

  const core = glowDot(1.2, [4, 0.7, 1.2]);
  core.position.set(0, 0.6, 0);
  scene.add(core);
  const halo = glowDot(3, [0.5, 0.08, 0.18]);
  halo.position.copy(core.position); scene.add(halo);

  return {
    scene, camera,
    update(t, ch, a) {
      const lt = t - ch.start, q = beat(t);
      const bp = barPulse(t, 2.5), kp = beatPulse(t, 8);

      const g = grid.material.uniforms;
      g.uTime.value = t;
      g.uBright.value = span(lt, 0, 2.5) * (0.7 + 0.5 * a.bass) * (1 - 0.8 * span(lt, 11.8, 13.2));
      // A ring rolls out from the point on every bar.
      const barT = ((q.b % 4) + 4) % 4 * (60 / 130);
      g.uWave.value = 1.2 * Math.exp(-barT * 0.8); g.uWaveR.value = barT * 18;

      const u = pillars.material.uniforms;
      u.uTime.value = t;
      u.uA.value = lerp(0, 52, span(lt, 0.8, 10.5, ease.inOut2));
      u.uB.value = kp * 0.6 + a.hit * 0.4;
      u.uC.value = 1 - span(lt, 11.6, 13.0);
      sky.material.uniforms.uTime.value = t;
      sky.material.uniforms.uA.value = 2.2 * span(lt, 3, 8) * (1 - span(lt, 11.5, 13));

      const pulse = 1 + bp * 0.6 + a.hit * 0.3;
      core.scale.setScalar(0.7 * pulse * (0.5 + span(lt, 0, 0.5) * 0.5));
      halo.scale.setScalar(2.2 * pulse);

      // Camera: start at the point, rise into an orbit, then fall back to the point.
      const up = span(lt, 0.2, 9, ease.inOut3), back = span(lt, 11.0, 13.24, ease.inOut3);
      const r = lerp(4.5, 26, up) * (1 - back) + 4 * back;
      const el = lerp(0.12, 0.62, up) * (1 - back) + 0.05 * back;
      const az = 0.3 + lt * 0.12 + up * 0.8;
      const d = drift(t, 0.25, 0.5);
      const p = orbit(r, az, el, [0, 0.6, 0]);
      look(camera, [p[0] + d[0], p[1] + d[1], p[2] + d[2]], [0, 0.6 + up * 1.5 * (1 - back), 0], Math.sin(lt * 0.4) * 0.05);

      return { bloom: 0.7 + bp * 0.4, ca: 0.0015 + a.hit * 0.002, scan: 0.05, vignette: 0.5 };
    },
  };
}
