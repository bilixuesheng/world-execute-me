// 00:00 — 00:16  A dead terminal wakes up and builds the world, line by line.
import * as THREE from 'three';
import { base, look, drift, fade } from './common.js';
import { TypeText, textPlane, MONO } from '../engine/text.js';
import { glyphField, glowDot, PAL } from '../engine/fx.js';
import { CUES } from '../timeline.js';
import { span, ease, clamp, lerp, glide } from '../engine/util.js';

const LINES = [
  { text: '$ power --line=on' },
  { text: '[ OK ] protection layer engaged', color: '#8affc1' },
  { text: '$ ls ./pieces | xargs place' },
  { text: '$ construct --object me' },
  { text: '$ me.params <<< data.bin  [==========] 100%' },
  { text: '[ OK ] initialized', color: '#8affc1' },
  { text: '$ world = new World()   // 0x7f3a2c00' },
  { text: '$ world.simulate()', color: '#ff5577' },
];

export function create({ atlas }) {
  const { scene, camera } = base(40);

  const term = new TypeText(LINES, 0.26, { size: 44, rows: 9, cursor: true, color: '#dfe8ff', intensity: 1.3, blink: null });
  term.mesh.position.set(0, 0.2, 0);
  scene.add(term.mesh);

  // header bar
  const header = textPlane('── tty0 ─────────────────────── world.execute(me); ──', 0.16, { size: 34, color: '#6f7a96' });
  header.position.set(0, 1.62, 0);
  scene.add(header);

  // Title card that replaces the terminal at the end of the intro.
  const title = textPlane([{ text: 'world.execute(  );' }], 1.0, { size: 150, weight: 800, family: MONO, color: '#ffffff', intensity: 0.9 });
  title.position.set(0, 0, 0.5); scene.add(title);
  const titleMe = textPlane([{ text: ' '.repeat(14) + 'me  ' }], 1.0, { size: 150, weight: 800, family: MONO, color: '#ff2a55', intensity: 1.8 });
  titleMe.position.set(0, 0, 0.52); scene.add(titleMe);

  // A cloud of dim code far behind, like dust in the dark.
  const dust = glyphField({
    count: 2500, atlas, size: 0.14, color: [0.25, 0.3, 0.45],
    positions: (i, r) => [(r() - 0.5) * 40, (r() - 0.5) * 22, -6 - r() * 30],
    body: /* glsl */`
      glyph += floor(uTime * (2.0 + aRand.x * 6.0));
      bright = uA * (0.35 + 0.65 * step(0.93, fract(aRand.y * 13.0 + uTime * 0.2))) ;
      p.y += sin(uTime * .2 + aRand.z * 6.28) * .3;`,
  });
  scene.add(dust);

  const core = glowDot(0.001, [3, 0.6, 1]);
  scene.add(core);

  return {
    scene, camera,
    update(t) {
      const c = CUES.boot;
      // characters typed: each line types from its cue at ~34 chars/sec
      let n = 0;
      LINES.forEach((l, i) => { n += clamp(Math.floor((t - c[i]) * 34), 0, l.text.length); });
      term.o.blink = () => Math.floor(t * 2.2) % 2 === 0;
      term.set(n);

      const tEnd = 13.6; // terminal → title
      const k = span(t, tEnd, tEnd + 1.2, ease.inOut3);
      fade(term.mesh, 1 - k); fade(header, (1 - k) * 0.8);
      const tk = span(t, tEnd + 0.4, tEnd + 1.6, ease.out3);
      fade(title, tk * (1 - span(t, 15.4, 16.04)));
      titleMe.visible = title.visible;
      titleMe.material.opacity = tk * (0.75 + 0.25 * Math.sin(t * 40)) * (1 - span(t, 15.4, 16.04));
      title.scale.setScalar(0.9 + 0.1 * tk + span(t, 15.0, 16.04, ease.in3) * 0.6);
      titleMe.scale.copy(title.scale);

      dust.material.uniforms.uTime.value = t;
      dust.material.uniforms.uA.value = 0.3 + 0.7 * span(t, 9, 14);

      // "simulate()" collapses into a single red point
      const pk = span(t, 15.2, 16.04, ease.in3);
      core.scale.setScalar(pk * 1.2);

      // camera: follow the line being typed, pulling back to reveal the whole block, then push into the title
      const lineY = glide(t, LINES.map((l, i) => [i ? c[i] : -1, 1.4 - 0.325 * i]), 0.7); // glide down to each new line
      const reveal = span(t, 0.2, 12.8, ease.inOut2);
      const d = drift(t, 0.04, 0.4);
      const tx = lerp(-1.3, 0, reveal), ty = lerp(lineY, 0.2, reveal * reveal);
      const z = lerp(3.4, 8.2, reveal) - span(t, 13.6, 16.04, ease.inOut2) * 3.2;
      look(camera, [tx * 0.8 + d[0], ty + d[1] - 0.1, z], [tx * (1 - span(t, 13.2, 14.4)), ty * (1 - span(t, 13.2, 14.4)), 0], -0.03 + 0.03 * reveal);

      return { scan: 0.22, barrel: 0.25, ca: 0.002, bloom: 0.55, grain: 0.07, vignette: 0.7, fade: 1 - span(t, 0, 0.6) };
    },
  };
}
