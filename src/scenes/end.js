// 03:25 — 03:32  "Execution." White-out, then a terminal: world.execute(me);
// The "me" is deleted, the process exits, and the last red point goes out.
import { base, look, fade } from './common.js';
import { drawTextCanvas, planeFromCanvas, MONO } from '../engine/text.js';
import { glowDot } from '../engine/fx.js';
import { CUES } from '../timeline.js';
import { span, ease, clamp } from '../engine/util.js';

export function create() {
  const { scene, camera } = base(35);
  const T = CUES.final;

  const cv = document.createElement('canvas');
  const draw = (text, cursor, exitLine) => drawTextCanvas(
    [{ text: text + (cursor ? '█' : ' ') }, { text: '' }, { text: exitLine, color: '#7c86a6' }],
    { size: 96, weight: 800, family: MONO, canvas: cv, cols: 34, color: '#ffffff', align: 'left' });
  draw('', true, '');
  const term = planeFromCanvas(cv, 1.6, { intensity: 0.85 });
  scene.add(term);
  const dot = glowDot(0.2, [4, 0.6, 1.2]); scene.add(dot);
  let last = '';

  // the red "me" drawn over the white text while it exists
  const cvMe = document.createElement('canvas');
  const meLayer = planeFromCanvas(drawTextCanvas([{ text: '' }, { text: '' }, { text: '' }], { size: 96, weight: 800, family: MONO, canvas: cvMe, cols: 34 }), 1.6, { intensity: 1.3 });
  meLayer.position.z = 0.01; scene.add(meLayer);
  let lastMe = '';

  return {
    scene, camera,
    update(t) {
      const full = 'world.execute(me);';
      const typed = clamp(Math.floor((t - (T + 1.1)) * 16), 0, full.length);
      let text = full.slice(0, typed);
      // backspace "me)" … then retype ")"
      const del = t > T + 3.0 ? clamp(Math.floor((t - (T + 3.0)) * 6), 0, 2) : 0;
      if (typed === full.length && del > 0) text = 'world.execute(' + 'me'.slice(0, 2 - del) + ');';
      const blink = Math.floor(t * 2.4) % 2 === 0;
      const exitLine = t > T + 4.2 ? '[process exited with code 0]'.slice(0, clamp(Math.floor((t - (T + 4.2)) * 40), 0, 28)) : '';
      const key = text + blink + exitLine;
      if (key !== last) { draw(text, blink, exitLine); term.material.map.needsUpdate = true; last = key; }
      // red overlay for the characters "me" while they exist
      const meVis = text.startsWith('world.execute(m') ? (text.startsWith('world.execute(me') ? 'me' : 'm') : '';
      const meKey = meVis;
      if (meKey !== lastMe) {
        drawTextCanvas([{ text: ' '.repeat(14) + meVis }, { text: '' }, { text: '' }], { size: 96, weight: 800, family: MONO, canvas: cvMe, cols: 34, color: '#ff2a55' });
        meLayer.material.map.needsUpdate = true; lastMe = meKey;
      }
      fade(term, span(t, T + 0.9, T + 1.2) * (1 - span(t, 211.4, 212.3)));
      fade(meLayer, term.material.opacity);
      term.position.set(0, 0, 0); meLayer.position.set(0, 0, 0.01);

      // one red point below the text, flickering out
      const out = span(t, 210.2, 211.2);
      const flick = t > 209.8 ? (Math.sin(t * 60) > 0.2 ? 1 : 0.3) : 1;
      dot.position.set(-3.35, -1.02, 0.05);
      dot.scale.setScalar(0.22 * (1 - out) * flick * span(t, T + 1.0, T + 1.3));

      look(camera, [-0.75, 0.05, 6.6 - span(t, T, 212.3, ease.out2) * 0.5], [-0.75, -0.05, 0], 0);
      return { bloom: 0.3, scan: 0.18, barrel: 0.2, vignette: 0.7, grain: 0.07, ca: 0.002 };
    },
  };
}
