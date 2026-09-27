// 01:28 — 01:43  Pre-chorus 2. A split-flap board flips between states, a clock
// spins from AM to PM, then everything dissolves into a hypnotic spiral.
import * as THREE from 'three';
import { base, look, drift, fade } from './common.js';
import { fatLine, glowDot } from '../engine/fx.js';
import { glyphIndex, ATLAS_COLS } from '../engine/text.js';
import { CUES, beatPulse, beat } from '../timeline.js';
import { span, ease, lerp, TAU, rng, clamp, bump } from '../engine/util.js';

const COLS = 22, ROWS = 7;
const MESSAGES = ['SWITCH(ME)', 'F  <=>  M', 'DO { ANY; }', 'AM  =>  PM', 'ROLE.SWAP()', 'S  <=>  M'];

function layoutMessage(msg, seed) {
  const r = rng(seed), cells = new Array(COLS * ROWS).fill(-1);
  const row = 3, start = Math.floor((COLS - msg.length) / 2);
  for (let i = 0; i < msg.length; i++) cells[row * COLS + start + i] = msg[i] === ' ' ? -1 : glyphIndex(msg[i]);
  const noise = '01{}<>=;#$%&*+-/';
  for (let i = 0; i < cells.length; i++) if (Math.floor(i / COLS) !== row && r() < 0.16) cells[i] = glyphIndex(noise[Math.floor(r() * noise.length)]);
  return cells;
}

export function create({ atlas }) {
  const { scene, camera } = base(40);
  const C = CUES.switch;
  const msgTimes = [C[0], C[1], C[2], C[3], C[4], C[5]];
  const layouts = MESSAGES.map((m, i) => layoutMessage(m, i * 13 + 5));
  const blank = new Array(COLS * ROWS).fill(-1);

  // --- split-flap board
  const quad = new THREE.PlaneGeometry(0.9, 1.3);
  const g = new THREE.InstancedBufferGeometry();
  g.index = quad.index; g.setAttribute('position', quad.getAttribute('position')); g.setAttribute('uv', quad.getAttribute('uv'));
  const n = COLS * ROWS;
  const off = new Float32Array(n * 2), oldG = new Float32Array(n).fill(-1), newG = new Float32Array(n).fill(-1), delay = new Float32Array(n);
  const r = rng(4);
  for (let i = 0; i < n; i++) {
    const cx = i % COLS, cy = Math.floor(i / COLS);
    off[i * 2] = (cx - (COLS - 1) / 2) * 1.0; off[i * 2 + 1] = ((ROWS - 1) / 2 - cy) * 1.42;
    delay[i] = cx * 0.012 + r() * 0.08;
  }
  g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 2));
  g.setAttribute('aOld', new THREE.InstancedBufferAttribute(oldG, 1));
  g.setAttribute('aNew', new THREE.InstancedBufferAttribute(newG, 1));
  g.setAttribute('aDelay', new THREE.InstancedBufferAttribute(delay, 1));
  g.instanceCount = n;
  const boardMat = new THREE.ShaderMaterial({
    uniforms: { uAtlas: { value: atlas.texture }, uT: { value: 10 }, uBright: { value: 1 }, uAccent: { value: 0 }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */`
      attribute vec2 aOff; attribute float aOld, aNew, aDelay; uniform float uT;
      varying vec2 vUv; varying float vGlyph; varying float vShade; varying float vRow;
      void main(){
        float f = clamp((uT - aDelay) / 0.22, 0.0, 1.0);
        float g = f < 0.5 ? aOld : aNew;
        float sy = abs(cos(f * 3.14159));
        vec3 p = vec3(position.x, position.y * max(sy, 0.04), 0.0);
        p.xy += aOff;
        vGlyph = floor(g + 0.5); vUv = uv; vShade = 0.6 + 0.4 * sy; vRow = aOff.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uAtlas; uniform float uBright, uAccent, uOpacity; varying vec2 vUv; varying float vGlyph; varying float vShade; varying float vRow;
      void main(){
        vec3 bg = vec3(0.035, 0.04, 0.06) * vShade;
        float seam = smoothstep(0.012, 0.0, abs(vUv.y - 0.5));
        bg *= 1.0 - seam * 0.8;
        vec2 e = min(vUv, 1.0 - vUv); bg *= smoothstep(0.0, 0.05, min(e.x, e.y));
        float a = 0.0;
        float gi = floor(vGlyph + 0.5);
        if (gi >= 0.0) {
          vec2 cell = vec2(mod(gi, ${ATLAS_COLS}.0), floor(gi / ${ATLAS_COLS}.0));
          vec2 guv = vec2((vUv.x - 0.5) * 1.25 + 0.5, (vUv.y - 0.5) * 0.9 + 0.5);
          if (guv.x > 0.0 && guv.x < 1.0 && guv.y > 0.0 && guv.y < 1.0) {
            vec2 uv = (cell + vec2(guv.x, 1.0 - guv.y)) / ${ATLAS_COLS}.0; uv.y = 1.0 - uv.y;
            a = texture2D(uAtlas, uv).a;
          }
        }
        bool isMain = abs(vRow) < 0.1;
        vec3 ink = isMain ? mix(vec3(1.6, 1.6, 1.7), vec3(2.6, 0.35, 0.8), uAccent) : vec3(0.45, 0.55, 0.8);
        gl_FragColor = vec4((bg + ink * a * vShade) * uBright * uOpacity, 1.0);
      }`,
    transparent: true,
  });
  const board = new THREE.Mesh(g, boardMat); board.frustumCulled = false;
  scene.add(board);

  // --- clock behind the board
  const clock = new THREE.Group(); clock.position.z = -6; scene.add(clock);
  const R = 9;
  clock.add(fatLine(Array.from({ length: 181 }, (_, i) => [Math.cos(i / 180 * TAU) * R, Math.sin(i / 180 * TAU) * R, 0]), { color: [1.4, 1.2, 0.8], width: 0.07 }));
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * TAU, l = i % 5 ? 0.5 : 1.3;
    clock.add(fatLine([[Math.cos(a) * R, Math.sin(a) * R, 0], [Math.cos(a) * (R - l), Math.sin(a) * (R - l), 0]], { color: [1.2, 1.0, 0.7], width: i % 5 ? 0.04 : 0.1 }));
  }
  const hourHand = fatLine([[0, 0, 0], [0, R * 0.5, 0]], { color: [2, 1.6, 1.0], width: 0.22 });
  const minHand = fatLine([[0, 0, 0], [0, R * 0.85, 0]], { color: [2, 2, 2.2], width: 0.12 });
  clock.add(hourHand, minHand);
  const sunDot = glowDot(3, [3, 1.8, 0.6]), moonDot = glowDot(2.4, [1.2, 1.6, 3]);
  clock.add(sunDot, moonDot);

  // --- hypnotic spiral (a big disc in front of the camera)
  const spiralMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uPulse: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uOpacity, uPulse; varying vec2 vUv;
      void main(){
        vec2 c = (vUv - .5) * vec2(1.7778, 1.0) * 2.0;
        float r = length(c), a = atan(c.y, c.x);
        float s = sin(9.0 * log(r + 0.001) - 4.0 * a + uTime * 7.0);
        float s2 = sin(9.0 * log(r + 0.001) + 4.0 * a - uTime * 5.0);
        float band = smoothstep(-0.15, 0.15, s) * 0.9;
        vec3 col = mix(vec3(1.0, 0.08, 0.28), vec3(0.08, 0.7, 1.0), smoothstep(-0.2, 0.2, s2));
        col *= band * (0.18 + 0.7 * smoothstep(1.4, 0.0, r)) * (1.0 + uPulse * 0.6);
        col += vec3(1.4, 1.2, 1.3) * smoothstep(0.1, 0.0, r);
        gl_FragColor = vec4(col * uOpacity, 1.);
      }`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  });
  const spiral = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), spiralMat);
  spiral.renderOrder = 10;
  scene.add(spiral);

  let shown = -2;
  const bgDay = new THREE.Color(0x100804), bgNight = new THREE.Color(0x02030c), bg = new THREE.Color();

  return {
    scene, camera,
    update(t, ch, a) {
      const bp = beatPulse(t, 6);
      // board state
      let mi = -1; msgTimes.forEach((c, i) => { if (t >= c - 0.1) mi = i; });
      if (mi !== shown) {
        const prev = mi > 0 ? layouts[mi - 1] : blank, next = mi >= 0 ? layouts[mi] : blank;
        oldG.set(prev); newG.set(next);
        g.attributes.aOld.needsUpdate = true; g.attributes.aNew.needsUpdate = true;
        shown = mi;
      }
      const u = boardMat.uniforms;
      u.uT.value = mi >= 0 ? t - (msgTimes[mi] - 0.1) : 10;
      u.uAccent.value = mi % 2 === 1 ? 1 : 0;
      u.uBright.value = 0.9 + bp * 0.35;
      const boardOut = span(t, C[6] - 0.3, C[6] + 0.8, ease.in2);
      u.uOpacity.value = 1 - boardOut;
      board.visible = u.uOpacity.value > 0.01;
      board.position.z = -boardOut * 6;

      // clock: visible from "do whatever" through "role", hands race AM → PM
      const cIn = span(t, C[2] - 0.2, C[2] + 0.8), cOut = span(t, C[6] - 0.5, C[6] + 0.5);
      fade(clock, cIn * (1 - cOut) * 0.9);
      const hours = 3 + span(t, C[2], C[6], ease.inOut2) * 12 + Math.max(0, t - C[2]) * 0.4;
      hourHand.rotation.z = -hours / 12 * TAU; minHand.rotation.z = -hours * TAU;
      const day = 0.5 + 0.5 * Math.cos((hours - 12) / 24 * TAU);
      sunDot.position.set(Math.sin(hours / 24 * TAU) * R * 0.6, -Math.cos(hours / 24 * TAU) * R * 0.6, 0.1);
      moonDot.position.set(-sunDot.position.x, -sunDot.position.y, 0.1);
      clock.rotation.z = Math.sin(t * 0.3) * 0.05;
      bg.copy(bgNight).lerp(bgDay, day * cIn * (1 - cOut));
      scene.background.copy(bg);

      // trance
      const tr = span(t, C[6] - 0.4, C[6] + 1.0);
      spiralMat.uniforms.uTime.value = t; spiralMat.uniforms.uOpacity.value = tr * (1 - span(t, 102.5, 103.2));
      spiralMat.uniforms.uPulse.value = bp * 0.6 + a.bass * 0.3;
      spiral.visible = spiralMat.uniforms.uOpacity.value > 0.001;

      // camera
      const d = drift(t, 0.12, 0.4);
      const push = msgTimes.reduce((acc, c) => acc + bump(t - c, 0.3), 0) * 1.2;
      const z = lerp(19, 16, span(t, ch.start, C[6])) - push;
      look(camera, [d[0] + Math.sin(t * 0.25) * 1.5, d[1] + 0.3, z], [0, 0, -2], Math.sin(t * 0.2) * 0.03 + (t > C[6] ? (t - C[6]) * 0.4 : 0));
      // keep the spiral glued in front of the camera
      spiral.position.copy(camera.position); spiral.quaternion.copy(camera.quaternion);
      spiral.translateZ(-1); const h = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 1; spiral.scale.set(h * 16 / 9, h, 1);

      const trance = tr * (1 - span(t, 102.4, 103));
      return { bloom: 0.5 + bp * 0.25 + trance * 0.1, barrel: trance * 0.35, ca: 0.0015 + trance * 0.006, vignette: 0.6 };
    },
  };
}
