// 01:43 — 01:58  Chorus 2. A Chladni plate: sand gathers on the nodal lines of the
// vibration. Then the other point leaves — in stuttering jump cuts — and "me" is alone.
import * as THREE from 'three';
import { base, look, drift, fade, orbit } from './common.js';
import { glowDot, fatLine, gridFloor, NOISE_GLSL } from '../engine/fx.js';
import { TypeText } from '../engine/text.js';
import { CUES, beatPulse, beat } from '../timeline.js';
import { span, ease, lerp, TAU, clamp, cueIndex, hash } from '../engine/util.js';

const G = 230; // points per side
const MODES = [[1, 2], [2, 3], [3, 5], [2, 5], [4, 5], [3, 7], [5, 6], [1, 6], [4, 7], [6, 7]];

export function create() {
  const { scene, camera } = base(45);
  const C = CUES.vibe, L = CUES.left;

  const pos = new Float32Array(G * G * 3), rnd = new Float32Array(G * G);
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    const k = i * G + j;
    const jit = (hash(k * 1.7) - 0.5) / G, jit2 = (hash(k * 3.1) - 0.5) / G;
    pos[k * 3] = (i / (G - 1)) * 2 - 1 + jit; pos[k * 3 + 1] = 0; pos[k * 3 + 2] = (j / (G - 1)) * 2 - 1 + jit2;
    rnd[k] = hash(k * 0.37);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aR', new THREE.BufferAttribute(rnd, 1));
  const plateMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uA: { value: new THREE.Vector2(1, 2) }, uB: { value: new THREE.Vector2(2, 3) }, uMix: { value: 0 },
      uAmp: { value: 0.3 }, uRound: { value: 0 }, uPx: { value: 1080 }, uBright: { value: 1 }, uScale: { value: 5 }, uCollapse: { value: 0 },
    },
    vertexShader: /* glsl */`
      ${NOISE_GLSL}
      attribute float aR;
      uniform float uTime, uMix, uAmp, uRound, uPx, uScale, uCollapse; uniform vec2 uA, uB;
      varying float vN; varying float vR; varying float vH;
      float chladni(vec2 p, vec2 nm){ float n = nm.x, m = nm.y; return sin(n * 3.14159 * p.x) * sin(m * 3.14159 * p.y) + sin(m * 3.14159 * p.x) * sin(n * 3.14159 * p.y); }
      void main(){
        vec2 p = position.xz;
        float f = mix(chladni(p, uA), chladni(p, uB), uMix);
        float r = length(p);
        float fr = cos(r * 18.0 - uTime * 2.0) * 1.2;
        f = mix(f, fr, uRound);
        float vib = f * sin(uTime * 30.0) * uAmp * (1.0 - uCollapse);
        // sand drifts toward nodal lines: brightness by how close f is to zero
        vN = exp(-abs(f) * 7.0);
        vR = aR; vH = f;
        vec3 w = vec3(p.x, vib * 0.25 + vN * 0.05, p.y) * uScale;
        w.y -= uCollapse * 2.0 * aR;
        vec4 mv = modelViewMatrix * vec4(w, 1.0);
        gl_PointSize = (0.018 + vN * 0.03) * uPx / max(0.1, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uBright; varying float vN; varying float vR; varying float vH;
      void main(){
        vec2 c = gl_PointCoord - .5; if (length(c) > .5) discard;
        vec3 sand = mix(vec3(0.25, 0.9, 1.3), vec3(1.4, 1.4, 1.5), vR);
        vec3 anti = vec3(0.35, 0.02, 0.1) * abs(vH);
        gl_FragColor = vec4((sand * vN * 1.2 + anti * 0.5) * uBright, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const plate = new THREE.Points(geo, plateMat); plate.frustumCulled = false;
  scene.add(plate);

  const rim = fatLine(Array.from({ length: 5 }, (_, i) => [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [-1, 0, -1]][i].map(v => v * 5.05)), { color: [0.6, 0.7, 1.1], width: 0.03 });
  scene.add(rim);
  const complete = fatLine(Array.from({ length: 201 }, (_, i) => [Math.cos(i / 200 * TAU) * 6.4, 0, Math.sin(i / 200 * TAU) * 6.4]), { color: [2.2, 1.5, 0.6], width: 0.07 });
  scene.add(complete);

  const floor = gridFloor({ color: [0.2, 0.25, 0.5], cell: 2, fade: 40 });
  floor.position.y = -2.5; scene.add(floor);

  const me = glowDot(0.9, [4, 0.7, 1.3]), you = glowDot(0.9, [0.7, 3, 4]);
  scene.add(me, you);
  const tether = fatLine([[0, 0, 0], [1, 0, 0]], { color: [0.8, 0.8, 1.2], width: 0.015 });
  scene.add(tether);

  const log = new TypeText([
    { text: '[1] you.exit()' }, { text: '[2] you.exit()' }, { text: '[3] you.exit()' },
    { text: '[4] you.exit()' }, { text: '[5] you.exit()' },
    { text: 'ReferenceError: you is not defined', color: '#ff4d6d' },
  ], 0.03, { size: 44, color: '#cfe6ff', intensity: 1.1, rows: 6, cursor: false });
  scene.add(camera); camera.add(log.mesh);
  log.mesh.position.set(0.33, -0.12, -1);

  const youPos = i => { // where the other point has jumped to after the i-th cue
    if (i < 0) return [1.2, 1.4, 0];
    const d = 3 + i * i * 4.5, a = 0.5 + i * 1.7;
    return [Math.cos(a) * d, 1.4 + i * 1.3, Math.sin(a) * d];
  };

  return {
    scene, camera,
    update(t, ch, a) {
      const bp = beatPulse(t, 6), q = beat(t);
      const li = cueIndex(t, L); // -1 until the first "left"
      // freeze time on each stutter cue
      const tt = li >= 0 && li < 5 ? L[li] + Math.min(0.12, t - L[li]) : t;
      const bar = Math.max(0, q.bar);
      const m1 = MODES[bar % MODES.length], m2 = MODES[(bar + 1) % MODES.length];
      const u = plateMat.uniforms;
      u.uTime.value = tt; u.uA.value.set(...m1); u.uB.value.set(...m2);
      u.uMix.value = ease.inOut3(clamp((q.b / 4 - Math.floor(q.b / 4) - 0.6) / 0.4));
      u.uAmp.value = 0.25 + a.bass * 0.5 + bp * 0.2;
      u.uRound.value = span(t, C[2], C[3] + 0.5) * (1 - span(t, L[0] - 0.1, L[0]));
      const iso = span(t, L[5], L[5] + 1.2, ease.inOut2);
      u.uCollapse.value = iso;
      u.uBright.value = (0.45 + bp * 0.2) * span(t, 102.93, 103.6) * (1 - iso * 0.9);
      fade(rim, 0.7 * (1 - iso));
      complete.userData.draw(span(t, C[3], C[3] + 1.4, ease.inOut2));
      fade(complete, span(t, C[3], C[3] + 0.1) * (1 - span(t, L[0], L[0] + 0.3)));
      floor.material.uniforms.uBright.value = 0.35 * (0.3 + iso * 0.7);

      // the two points
      const orbitA = t * 1.3;
      me.position.set(Math.cos(orbitA) * 1.2, 1.4 + Math.sin(t * 2) * 0.2, Math.sin(orbitA) * 1.2);
      const yp = li >= 0 ? youPos(li) : [-Math.cos(orbitA) * 1.2, 1.4 + Math.cos(t * 2) * 0.2, -Math.sin(orbitA) * 1.2];
      you.position.set(...yp);
      me.scale.setScalar(0.8 * (1 + bp * 0.4) * lerp(1, 0.55, iso));
      you.scale.setScalar(li >= 5 ? 0 : 0.8 * (1 + bp * 0.4));
      tether.userData.setPoints([me.position.toArray(), you.position.toArray()]);
      fade(tether, li < 0 ? 0.6 : Math.max(0, 0.6 - li * 0.15) * (li < 5 ? 1 : 0));

      let n = 0; const lines = [14, 14, 14, 14, 14, 34];
      L.forEach((c, i) => { n += clamp(Math.floor((t - c) * 60), 0, lines[i]); });
      log.set(n); fade(log.mesh, span(t, L[0], L[0] + 0.05) * (1 - span(t, 117.3, 117.9)));

      // camera: orbiting the plate; hard cuts on every stutter; lonely pull-out for isolation
      const d = drift(t, 0.15, 0.4);
      let p, tgt = [0, 0.4, 0], roll = 0;
      if (li < 0) {
        p = orbit(11 - bp * 0.4, t * 0.22, 0.62 + Math.sin(t * 0.3) * 0.08);
      } else if (li < 5) {
        const h = hash(li * 9.1 + 2);
        p = orbit(lerp(6, 14, h), li * 2.1 + 0.4, lerp(0.15, 1.1, hash(li * 3.3)));
        tgt = [lerp(0, you.position.x, 0.3), 1, lerp(0, you.position.z, 0.3)];
        roll = (h - 0.5) * 0.5;
      } else {
        const k = span(t, L[5], 117.95, ease.out3);
        p = orbit(lerp(9, 42, k), 1.2 + k * 0.4, lerp(0.35, 1.25, k), [me.position.x, 0, me.position.z]);
        tgt = me.position.toArray();
      }
      look(camera, [p[0] + d[0], p[1] + d[1], p[2] + d[2]], tgt, roll);

      const cut = li >= 0 ? Math.exp(-(t - L[li]) * 9) : 0;
      return {
        bloom: 0.55 + bp * 0.25, glitch: li >= 0 && li < 6 ? cut * 0.9 : 0, ca: 0.0015 + cut * 0.01,
        invert: li >= 0 && li < 5 && t - L[li] < 0.05 ? 1 : 0, saturation: lerp(1, 0.35, iso), vignette: 0.6 + iso * 0.3,
      };
    },
  };
}
