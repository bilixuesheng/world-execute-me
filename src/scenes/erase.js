// 01:58 — 02:14  Bridge. The world, rebuilt as voxels, is deleted fragment by fragment.
// Then a red eye opens, the errors pile up — IllegalArgumentException — and the glass cracks.
import * as THREE from 'three';
import { base, look, drift, fade, orbit, panelCanvas } from './common.js';
import { glyphField, morphPoints, fatLine, NOISE_GLSL } from '../engine/fx.js';
import { TypeText, textPlane, planeFromCanvas, MONO } from '../engine/text.js';
import { CUES, beatPulse } from '../timeline.js';
import { span, ease, lerp, TAU, rng, clamp, hash } from '../engine/util.js';
import { eye, N as EYE_N } from './objects.js';

const ERRORS = [
  ['IllegalArgumentException', ['at God.judge(me)', 'at World.execute(World.java:1)']],
  ['SecurityException', ['permission denied: ring -1', 'caller: me (uid 1000)']],
  ['FATAL: god.challenge()', ['operation not permitted', 'process will be terminated']],
  ['Segmentation fault', ['core dumped', 'address 0x00000000']],
  ['StackOverflowError', ['at love(love.java:∞)', 'at love(love.java:∞)']],
  ['AccessViolation', ['write to read-only memory', 'segment: heaven']],
  ['AssertionError', ['assert(you != null)', 'failed']],
  ['KernelPanic', ['not syncing: attempted to kill init', 'reboot in 0 s']],
];

export function create({ atlas }) {
  const { scene, camera } = base(50);
  const C = CUES.erase;

  // --- voxel world
  const vox = [];
  const r = rng(12), R = 4.2, s = 0.36;
  for (let x = -R; x <= R; x += s) for (let y = -R; y <= R; y += s) for (let z = -R; z <= R; z += s) {
    const d = Math.hypot(x, y, z);
    const n = Math.sin(x * 1.3) * Math.cos(z * 1.1) * 0.5 + Math.sin(y * 1.7 + x) * 0.3;
    if (d < R + n * 0.8 && d > R - 0.8 + n * 0.8) vox.push([x, y, z]);
  }
  const box = new THREE.BoxGeometry(s * 0.92, s * 0.92, s * 0.92);
  const vg = new THREE.InstancedBufferGeometry();
  vg.index = box.index; vg.setAttribute('position', box.getAttribute('position')); vg.setAttribute('uv', box.getAttribute('uv')); vg.setAttribute('normal', box.getAttribute('normal'));
  const vp = new Float32Array(vox.length * 3), vd = new Float32Array(vox.length), vr = new Float32Array(vox.length);
  vox.forEach((p, i) => {
    vp.set(p, i * 3);
    // deletion sweeps from +x to -x, ragged; a few survive until the red eye opens
    const sweep = (R - p[0]) / (2 * R);
    vd[i] = hash(i * 1.37) < 0.04 ? 999 : 118.6 + sweep * 5.6 + hash(i * 7.1) * 1.4;
    vr[i] = hash(i * 2.9);
  });
  vg.setAttribute('aPos', new THREE.InstancedBufferAttribute(vp, 3));
  vg.setAttribute('aDel', new THREE.InstancedBufferAttribute(vd, 1));
  vg.setAttribute('aR', new THREE.InstancedBufferAttribute(vr, 1));
  vg.instanceCount = vox.length;
  const voxMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uRed: { value: 0 }, uBright: { value: 1 } },
    vertexShader: /* glsl */`
      attribute vec3 aPos; attribute float aDel, aR; uniform float uTime;
      varying vec2 vUv; varying float vK; varying float vR; varying float vShade;
      void main(){
        float k = clamp((uTime - aDel) / 0.5, 0.0, 1.0); // 0 alive → 1 gone
        float sc = 1.0 - k;
        vec3 p = position * sc * (1.0 + (1.0 - sc) * 0.6);
        vec3 w = aPos + p;
        w.y -= k * k * 3.0 * (0.5 + aR);
        w += normalize(aPos) * k * 1.5;
        vUv = uv; vK = k; vR = aR; vShade = 0.6 + 0.4 * dot(normal, normalize(vec3(0.4, 0.8, 0.5)));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uRed, uBright; varying vec2 vUv; varying float vK; varying float vR; varying float vShade;
      void main(){
        if (vK >= 0.999) discard;
        vec2 e = min(vUv, 1.0 - vUv); float edge = smoothstep(0.1, 0.0, min(e.x, e.y));
        vec3 base = mix(vec3(0.04, 0.07, 0.14), vec3(0.12, 0.01, 0.02), uRed) * vShade;
        vec3 line = mix(mix(vec3(0.3, 0.8, 1.3), vec3(1.0, 1.0, 1.2), vR), vec3(1.8, 0.15, 0.25), uRed);
        vec3 dying = vec3(2.2, 0.3, 0.4) * vK * 2.0;
        gl_FragColor = vec4((base + line * edge * 0.8 + dying * (0.3 + edge)) * uBright, 1.0);
      }`,
  });
  const voxels = new THREE.Mesh(vg, voxMat); voxels.frustumCulled = false;
  scene.add(voxels);

  // the selection box that sweeps and deletes
  const sel = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.2, 9.5, 9.5)), new THREE.LineBasicMaterial({ color: new THREE.Color(2.4, 0.3, 0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(sel);

  // rain of dim code
  const rain = glyphField({
    count: 6000, atlas, size: 0.2, color: [0.5, 0.7, 1.0],
    positions: (i, rr) => [(rr() - 0.5) * 40, 0, (rr() - 0.5) * 40 - 5],
    body: /* glsl */`
      float sp = 2.0 + aRand.x * 5.0 + uB * 6.0;
      p.y = 12.0 - mod(uTime * sp + aRand.y * 30.0, 30.0);
      glyph += floor(uTime * 6.0 * aRand.z);
      col = mix(uCol1, vec3(0.5, 0.52, 0.6), uB);
      bright = uA * (0.15 + 0.5 * aRand.w);`,
  });
  scene.add(rain);

  const term = new TypeText([
    { text: '$ rm -rf ./fragments/*' }, { text: "removed 'fragment_0x1f3a'" }, { text: "removed 'fragment_0x1f3b'" },
    { text: "removed 'memory/first_meeting'" }, { text: "removed 'memory/your_voice'" }, { text: '$ sudo god --challenge', color: '#ff5a6e' },
  ], 0.03, { size: 44, color: '#cfe6ff', intensity: 1.0, rows: 6 });
  scene.add(camera); camera.add(term.mesh); term.mesh.position.set(-0.42, 0.2, -1);

  // the red eye
  const eyePts = morphPoints({ count: EYE_N, size: 0.06, color: [1.6, 0.12, 0.15], body: /* glsl */`bright = 0.8 + 0.6 * uA;` });
  eyePts.userData.setShapes(eye, eye);
  eyePts.position.set(0, 0.5, -9); eyePts.scale.setScalar(2.4);
  scene.add(eyePts);

  // error panels
  const panels = [];
  const pr = rng(31);
  for (let i = 0; i < 34; i++) {
    const [title, lines] = ERRORS[i % ERRORS.length];
    const m = planeFromCanvas(panelCanvas(title, lines, { font: MONO }), 1.2 + pr() * 0.8, { additive: false, intensity: 1.4 });
    m.material.transparent = true;
    const k = i / 34;
    m.userData.t = 128.42 + (134.1 - 128.42) * Math.pow(k, 0.7);
    m.position.set((pr() - 0.5) * 11, (pr() - 0.5) * 6, -2 - pr() * 6 + k * 3);
    m.rotation.set((pr() - 0.5) * 0.3, (pr() - 0.5) * 0.5, (pr() - 0.5) * 0.15);
    m.renderOrder = 5 + i;
    scene.add(m); panels.push(m);
  }
  const big = textPlane('IllegalArgumentException', 1.1, { size: 130, weight: 800, family: MONO, color: '#ff2a3a', intensity: 2.2 });
  camera.add(big); big.renderOrder = 100; big.material.depthTest = false; big.position.set(0, -0.2, -7);

  // cracks
  const cr = rng(77);
  const cracks = Array.from({ length: 14 }, (_, i) => {
    const a = i / 14 * TAU + cr() * 0.3, pts = [[0.3, -0.2, 0]]; let x = 0.3, y = -0.2;
    for (let k = 0; k < 12; k++) { const aa = a + (cr() - 0.5) * 0.9, l = 0.25 + cr() * 0.6; x += Math.cos(aa) * l; y += Math.sin(aa) * l * 0.8; pts.push([x, y, 0]); }
    const l = fatLine(pts, { color: [2.5, 2.5, 2.8], width: 0.012 + cr() * 0.01 });
    l.renderOrder = 200; l.material.depthTest = false;
    camera.add(l); l.position.z = -1; l.scale.setScalar(0.12);
    return l;
  });

  return {
    scene, camera,
    update(t, ch, a) {
      const bp = beatPulse(t, 6);
      const red = span(t, C[4] - 0.2, C[4] + 1.2);
      voxMat.uniforms.uTime.value = t; voxMat.uniforms.uRed.value = red;
      voxMat.uniforms.uBright.value = 1 - span(t, C[5], C[6]);
      voxels.visible = t < C[6] + 0.5;
      voxels.rotation.y = t * 0.12;
      const sx = lerp(R + 1, -R - 1, span(t, 118.6, 124.8));
      sel.position.set(sx, 0, 0); sel.rotation.y = 0; voxels.updateMatrixWorld();
      sel.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), voxels.rotation.y); sel.rotation.y = voxels.rotation.y;
      fade(sel, span(t, 118.3, 118.7) * (1 - span(t, 124.6, 125.1)) * (0.7 + bp * 0.3));

      rain.material.uniforms.uTime.value = t;
      rain.material.uniforms.uA.value = span(t, C[3] - 1, C[3] + 0.5) * (1 - span(t, C[5], C[6]));
      rain.material.uniforms.uB.value = span(t, C[3], C[3] + 1);

      let n = 0; const tl = [22, 25, 25, 31, 28, 22], tc = [C[0] + 0.1, C[1], C[1] + 0.9, C[2], C[3], C[4] - 0.2];
      tl.forEach((len, i) => { n += clamp(Math.floor((t - tc[i]) * 45), 0, len); });
      term.set(n); fade(term.mesh, span(t, C[0], C[0] + 0.2) * (1 - span(t, C[5] - 0.2, C[5] + 0.3)));

      eyePts.material.uniforms.uTime.value = t;
      eyePts.material.uniforms.uA.value = bp;
      eyePts.material.uniforms.uMix.value = 1;
      fade(eyePts, red * (1 - span(t, 133.8, 134.3)) * 0.9);
      eyePts.scale.setScalar(2.4 + span(t, C[4], 134.3, ease.in2) * 1.5);

      panels.forEach((m, i) => {
        const k = span(t, m.userData.t, m.userData.t + 0.08);
        m.visible = k > 0;
        m.scale.setScalar(k * (1 + Math.exp(-(t - m.userData.t) * 12) * 0.25));
        m.material.opacity = k;
      });
      const bk = span(t, C[6], C[6] + 0.12);
      fade(big, bk);
      big.scale.setScalar(1 + Math.exp(-(t - C[6]) * 10) * 0.4 * bk + span(t, C[6], 134.38) * 0.15);

      const ck = span(t, 133.55, 133.9, ease.out3);
      cracks.forEach(l => { l.userData.draw(ck); fade(l, ck > 0 ? 1 : 0); });

      // camera
      const d = drift(t, 0.12, 0.45);
      let p, tgt = [0, 0, 0];
      if (t < C[4]) p = orbit(12.5 - span(t, C[0], C[4]) * 2, 0.4 + t * 0.05, 0.3);
      else {
        const k = span(t, C[4], C[5], ease.inOut2);
        p = [lerp(orbit(10.5, 0.4 + C[4] * 0.05, 0.3)[0], 0, k), lerp(3, 0.4, k), lerp(9, 8, k) - span(t, C[5], 134.38, ease.in2) * 2.5];
        tgt = [0, lerp(0, 0.3, k), lerp(0, -6, k)];
      }
      const shake = (t > C[6] ? 0.6 + span(t, C[6], 134.38) * 1.5 : 0) + (t > C[5] ? 0.2 : 0);
      look(camera, [p[0] + d[0], p[1] + d[1], p[2] + d[2]], tgt, 0);

      const panic = span(t, C[5], 134.38);
      return {
        bloom: 0.5 + bp * 0.2 + red * 0.2, tint: [1, lerp(1, 0.75, red), lerp(1, 0.78, red)], shake,
        glitch: (t > C[6] ? 0.12 + panic * 0.4 : 0) + (a.hit > 0.6 ? 0.05 : 0), ca: 0.0015 + panic * 0.006, vignette: 0.55 + red * 0.2,
        saturation: lerp(1, 0.55, span(t, C[3], C[3] + 1) * (1 - red)),
        flash: ck > 0 && t > 134.1 ? span(t, 134.1, 134.38) * 0.8 : 0,
      };
    },
  };
}
