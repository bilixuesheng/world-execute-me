// 02:27 — 02:41  EXECUTION ×12: a vortex galaxy made of code, a shockwave and a slam
// on every hit; then a countdown 1…6 as the whole galaxy implodes into a point.
import * as THREE from 'three';
import { base, look, fade, orbit } from './common.js';
import { glyphField, fatLine, glowDot } from '../engine/fx.js';
import { textPlane, MONO } from '../engine/text.js';
import { CUES, beatPulse } from '../timeline.js';
import { span, ease, lerp, TAU, cueIndex, hash } from '../engine/util.js';

const WORDS = ['EXECUTION', 'execute(me);', 'EXECUTION', 'kill -9 me', 'EXECUTION', 'exec(world)'];

export function create({ atlas }) {
  const { scene, camera } = base(55);
  const E = CUES.execution, K = CUES.countdown, BANG = CUES.bang;

  const galaxy = glyphField({
    count: 36000, atlas, size: 0.24, color: [1.1, 0.35, 0.5], color2: [0.3, 0.6, 1.2],
    positions: (i, r) => {
      const arm = i % 4, rad = Math.pow(r(), 0.6) * 34 + 0.6;
      const a = arm * Math.PI / 2 + rad * 0.22 + (r() - 0.5) * (0.5 + 8 / rad);
      const y = (r() + r() + r() - 1.5) * 1.6 * Math.exp(-rad / 18);
      return [Math.cos(a) * rad, y, Math.sin(a) * rad];
    },
    body: /* glsl */`
      float rad = length(aPos.xz);
      p.xz = rot2(uA / (0.4 + rad * 0.06)) * p.xz;
      p *= 1.0 - uB * (0.4 + 0.6 * smoothstep(0.0, 34.0, rad));
      p.y += sin(uTime * 2.0 + rad * 0.3) * uC * 0.8;
      glyph += floor(uTime * (4.0 + aRand.x * 10.0));
      col = mix(vec3(1.0, 0.85, 0.7), mix(uCol1, uCol2, step(0.5, aRand.y)), smoothstep(1.5, 12.0, rad));
      bright = (0.1 + 0.3 * aRand.z) * (1.0 + uC * 1.2) * (1.0 + uB * 1.5) * uD * mix(0.35, 1.0, smoothstep(0.0, 10.0, rad));
      size *= 1.0 + smoothstep(20.0, 0.0, rad) * 0.5;`,
  });
  scene.add(galaxy);

  const core = glowDot(3, [1.5, 1.05, 0.85]); scene.add(core);

  const rings = Array.from({ length: 4 }, () => {
    const l = fatLine(Array.from({ length: 161 }, (_, i) => [Math.cos(i / 160 * TAU), 0, Math.sin(i / 160 * TAU)]), { color: [2.2, 1.4, 1.8], width: 0.25 });
    scene.add(l); return l;
  });

  const words = WORDS.map((w, i) => {
    const m = textPlane(w, 1.6, { size: 150, weight: 800, family: MONO, color: i % 2 ? '#ff2a55' : '#ffffff', intensity: i % 2 ? 2.0 : 1.5 });
    m.material.depthTest = false; m.renderOrder = 50; camera.add(m); return m;
  });
  scene.add(camera);
  const nums = ['1', '2', '3', '4', '5', '6'].map((d, i) => {
    const g = new THREE.Group();
    const big = textPlane(d, 5, { size: 260, weight: 800, family: MONO, color: i % 2 ? '#ff2a55' : '#ffffff', intensity: 2.2 });
    const bin = textPlane((i + 1).toString(2).padStart(3, '0'), 0.9, { size: 110, family: MONO, color: '#7fe8ff', intensity: 1.5 });
    bin.position.y = -3.1;
    for (const m of [big, bin]) { m.material.depthTest = false; m.renderOrder = 60; g.add(m); }
    camera.add(g); return g;
  });

  return {
    scene, camera,
    update(t, ch, a) {
      const bp = beatPulse(t, 7);
      const ei = cueIndex(t, E), ki = cueIndex(t, K);
      const since = ei >= 0 ? t - E[ei] : 9;
      const hitE = Math.exp(-since * 5);
      const implode = span(t, K[0], BANG, ease.in3);

      const u = galaxy.material.uniforms;
      // spin accumulates with every hit
      u.uA.value = (t - 147.48) * 0.4 + (ei + 1) * 0.35 + ease.out3(Math.min(1, since * 2)) * 0.35 + implode * 6;
      u.uB.value = implode; u.uC.value = hitE * 0.6; u.uTime.value = t;
      u.uD.value = span(t, 147.3, 147.7) * (1 - span(t, BANG - 0.12, BANG));
      core.scale.setScalar((1.8 + hitE * 2 + implode * 8) * (1 + bp * 0.15));
      fade(core, 1 - span(t, BANG - 0.05, BANG + 0.2));

      rings.forEach((l, i) => {
        const idx = ei - ((ei - i) % 4 + 4) % 4; // most recent cue owned by this ring
        const st = idx >= 0 ? t - E[idx] : 9;
        l.visible = st < 1.6 && ki < 0;
        if (l.visible) { l.scale.setScalar(2 + st * 38); fade(l, Math.exp(-st * 2.2)); l.rotation.x = (hash(idx) - 0.5) * 0.5; }
      });

      words.forEach((m, i) => {
        const on = ki < 0 && ei >= 0 && ei % WORDS.length === i;
        m.visible = on;
        if (on) {
          const slam = ease.outExpo(Math.min(1, since / 0.16));
          m.material.opacity = Math.min(1, since * 20) * Math.exp(-Math.max(0, since - 0.5) * 3);
          m.position.set(0, (hash(ei * 3) - 0.5) * 1.2, lerp(-3, -9, slam));
          m.rotation.z = (hash(ei * 5) - 0.5) * 0.25;
          m.scale.setScalar(1 + since * 0.15);
        }
      });
      nums.forEach((g, i) => {
        const on = i === ki && t < BANG;
        g.visible = on;
        if (on) {
          const st = t - K[i];
          g.position.set(0, 0, lerp(-4, -14, ease.outExpo(Math.min(1, st / 0.12))));
          g.scale.setScalar(1 + st * 0.6);
          fade(g, 1);
        }
      });

      // camera: a new angle on every hit, pushing in as the countdown runs
      const h = ei >= 0 ? ei : 0;
      const baseR = lerp(62, 40, span(t, 147.48, K[0]));
      let p = orbit(baseR - hitE * 4, hash(h * 1.9) * TAU, lerp(0.45, 1.3, hash(h * 4.7)));
      if (ki >= 0) p = orbit(lerp(36, 6, implode), t * 1.5, 0.5 + ki * 0.1);
      const roll = ei >= 0 ? (hash(h * 8.3) - 0.5) * 0.6 : 0;
      look(camera, p, [0, 0, 0], roll + (ki >= 0 ? ki * 0.4 : 0));

      const kHit = ki >= 0 ? Math.exp(-(t - K[ki]) * 8) : 0;
      return {
        bloom: 0.5 + hitE * 0.4 + implode * 0.6 + bp * 0.15, ca: 0.002 + hitE * 0.008 + kHit * 0.01, shake: hitE * 1.2 + kHit * 1.5,
        flash: kHit * 0.35 + (since < 0.05 ? 0.3 : 0), glitch: kHit * 0.3 + hitE * 0.1, barrel: 0.1 + hitE * 0.2 + implode * 0.4,
        invert: ki >= 0 && ki % 2 === 1 && t - K[ki] < 0.08 ? 1 : 0, vignette: 0.55,
      };
    },
  };
}
