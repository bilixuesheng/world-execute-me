// 02:41 — 02:57  The big bang. Galaxies condense out of the blast; the camera flies
// through a universe where the laws of physics hang in space as glowing equations.
// On "trapped" it pulls all the way out: the whole universe sits inside a sphere of code.
import * as THREE from 'three';
import { base, look, fade } from './common.js';
import { morphPoints, shape, glyphField, fatLine, glowDot } from '../engine/fx.js';
import { formulaPlane } from '../engine/text.js';
import { CUES, beatPulse } from '../timeline.js';
import { span, ease, lerp, TAU, rng, clamp } from '../engine/util.js';

const N = 64000;
const GALAXIES = [
  { c: [-48, 12, -70], r: 34, tilt: [0.9, 0.2, 0.3], hue: [0.45, 0.65, 1.4] },
  { c: [80, -26, -150], r: 44, tilt: [0.3, 0.5, 1.2], hue: [1.3, 0.35, 0.7] },
  { c: [-70, 26, -235], r: 50, tilt: [1.3, 0.1, 0.4], hue: [0.4, 1.0, 1.3] },
  { c: [45, 22, -320], r: 38, tilt: [0.6, 1.1, 0.2], hue: [1.4, 0.8, 0.35] },
  { c: [-58, -38, -405], r: 50, tilt: [0.2, 0.3, 0.9], hue: [0.8, 0.45, 1.4] },
  { c: [80, 40, -490], r: 46, tilt: [1.0, 0.7, 0.1], hue: [0.45, 0.8, 1.5] },
];
const PATH = [[0, 6, 42], [12, 9, -40], [-16, 1, -118], [26, 14, -198], [-22, -4, -278], [14, 9, -358], [0, 2, -436], [-6, 0, -500]];
const MAIN = [
  'e^{iπ} + 1 = 0',
  'E = mc^{2}',
  'iħ\\frac{∂}{∂t}Ψ = \\hat{H}Ψ',
  'G_{μν} + Λg_{μν} = \\frac{8πG}{c^{4}}T_{μν}',
  '∇ × \\bf{B} = μ_{0}\\bf{J} + μ_{0}ε_{0}\\frac{∂\\bf{E}}{∂t}',
  '(iγ^{μ}∂_{μ} - m)ψ = 0',
  '\\hat{f}(ξ) = \\big{∫} f(x)\\,e^{-2πixξ}\\,dx',
  'z_{n+1} = z_{n}^{2} + c',
];
const EXTRA = [
  '∇ · \\bf{E} = \\frac{ρ}{ε_{0}}', 'S = k_{B}\\ln Ω', 'Δx\\,Δp ≥ \\frac{ħ}{2}', 'ζ(s) = \\big{∑} \\frac{1}{n^{s}}',
  '\\big{∫} e^{-x^{2}}\\,dx = \\sqrt{π}', 'P(A|B) = \\frac{P(B|A)\\,P(A)}{P(B)}', 'E = hν', 'F = G\\frac{m_{1}m_{2}}{r^{2}}',
  '\\frac{dx}{dt} = σ(y - x)', '∇ · \\bf{B} = 0', 'e^{x} = \\big{∑} \\frac{x^{n}}{n!}', 'a^{2} + b^{2} = c^{2}',
];

function universe() {
  const quat = new THREE.Quaternion(), v = new THREE.Vector3();
  return shape(N, (i, r) => {
    const gi = i % 7;
    if (gi < GALAXIES.length) {
      const g = GALAXIES[gi];
      quat.setFromEuler(new THREE.Euler(...g.tilt));
      const arm = Math.floor(r() * 3), rad = Math.pow(r(), 0.7) * g.r;
      const a = arm / 3 * TAU + rad / g.r * 5.5 + (r() - 0.5) * (0.35 + 6 / (rad + 2));
      const y = (r() + r() - 1) * g.r * 0.05 * Math.exp(-rad / g.r * 2) * 2;
      v.set(Math.cos(a) * rad, y, Math.sin(a) * rad).applyQuaternion(quat);
      const core = Math.exp(-rad / g.r * 5);
      let col = g.hue.map((h, k) => lerp(h, [1.15, 0.9, 0.65][k], core));
      if (r() < 0.06) col = [1.5, 0.25, 0.6];
      return [g.c[0] + v.x, g.c[1] + v.y, g.c[2] + v.z, col];
    }
    // cosmic web: filaments between neighbouring galaxies
    const k = Math.floor(r() * (GALAXIES.length - 1)), A = GALAXIES[k].c, B = GALAXIES[k + 1].c, u = r();
    const s = 6 + Math.sin(u * Math.PI) * 10;
    return [lerp(A[0], B[0], u) + (r() - 0.5) * s, lerp(A[1], B[1], u) + (r() - 0.5) * s, lerp(A[2], B[2], u) + (r() - 0.5) * s, [0.35, 0.3, 0.6]];
  }, 42);
}

function lorenz(n) {
  let x = 0.1, y = 0, z = 0; const out = [];
  for (let i = 0; i < n * 3; i++) {
    const dx = 10 * (y - x), dy = x * (28 - z) - y, dz = x * y - 8 / 3 * z;
    x += dx * 0.004; y += dy * 0.004; z += dz * 0.004;
    if (i % 3 === 0) out.push([x, z - 25, y]);
  }
  return out;
}

export function create({ atlas }) {
  const { scene, camera } = base(62);
  const C = CUES.cosmos, BANG = CUES.bang;

  const U = universe();
  const seed = shape(N, (i, r) => { const u = r() * 2 - 1, p = r() * TAU, s = Math.sqrt(1 - u * u), R = Math.cbrt(r()) * 0.4; return [Math.cos(p) * s * R, u * R, Math.sin(p) * s * R, [2, 1.9, 1.7]]; }, 43);
  const cosmos = morphPoints({ count: N, size: 0.9, color: [1, 1, 1], body: /* glsl */`
    float twinkle = 0.75 + 0.25 * sin(uTime * 3.0 + aRand.w * 40.0);
    bright = twinkle * (0.8 + uA * 1.2);
    // points right next to the lens would bloom into a white wall; let them fade out
    bright *= mix(1.0, smoothstep(6.0, 80.0, -(modelViewMatrix * vec4(p, 1.0)).z), uC);
    size *= 1.0 + uB * 2.0;` });
  cosmos.userData.setShapes(seed, U);
  scene.add(cosmos);

  // distant stars that turn out to be characters
  const stars = glyphField({
    count: 16000, atlas, size: 4, color: [0.7, 0.8, 1.1],
    positions: (i, r) => { const u = r() * 2 - 1, p = r() * TAU, s = Math.sqrt(1 - u * u), R = 1100 + r() * 700; return [Math.cos(p) * s * R, u * R, Math.sin(p) * s * R - 230]; },
    body: /* glsl */`glyph += floor(uTime * 2.0 * aRand.x); bright = uA * (0.2 + 0.8 * pow(aRand.y, 3.0));`,
  });
  scene.add(stars);

  // the universe's code shell
  const shell = glyphField({
    count: 42000, atlas, size: 9, color: [0.55, 0.85, 1.3], color2: [1.4, 0.25, 0.5],
    positions: (i, r) => { const u = r() * 2 - 1, p = r() * TAU, s = Math.sqrt(1 - u * u), R = 640; return [Math.cos(p) * s * R, u * R, Math.sin(p) * s * R - 230]; },
    body: /* glsl */`
      float lat = asin(clamp((aPos.y) / 640.0, -1.0, 1.0));
      float row = floor(lat * 60.0);
      glyph += floor(uTime * 3.0 + row * 7.0);
      col = mix(uCol1, uCol2, step(0.92, aRand.x));
      float scan = 0.5 + 0.5 * sin(row * 0.7 - uTime * 4.0);
      bright = uA * (0.25 + 0.75 * scan * aRand.y);`,
  });
  scene.add(shell);

  // camera path + equations along it
  const curve = new THREE.CatmullRomCurve3(PATH.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const t0 = C[0] - 0.4, t1 = C[6] + 0.2;
  const uAt = t => clamp((t - t0) / (t1 - t0)) * 0.97;
  const main = MAIN.map((src, i) => {
    const m = formulaPlane(src, i === 3 || i === 4 || i === 6 ? 7.5 : 9, { size: 120, color: ['#ffffff', '#ffe2a6', '#bff4ff', '#ffd0dc'][i % 4], intensity: 1.35 });
    const pass = curve.getPointAt(uAt(C[i] + 2.4)), tan = curve.getTangentAt(uAt(C[i] + 2.4));
    const side = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
    m.position.copy(pass).addScaledVector(side, (i % 2 ? 1 : -1) * 17).add(new THREE.Vector3(0, (i % 3 - 1) * 5, 0));
    m.userData.cue = C[i];
    scene.add(m); return m;
  });
  const er = rng(5);
  const extra = EXTRA.map((src, i) => {
    const m = formulaPlane(src, 3 + er() * 2, { size: 96, color: '#9fb8ff', intensity: 0.8 });
    const p = curve.getPointAt((i + 0.5) / EXTRA.length * 0.95);
    const side = i % 2 ? 1 : -1; // keep them well clear of the flight path
    m.position.set(p.x + side * (26 + er() * 30), p.y + (er() - 0.5) * 36, p.z + (er() - 0.5) * 30);
    m.userData.phase = er() * TAU;
    scene.add(m); return m;
  });

  const attractor = fatLine(lorenz(3000), { color: [1.6, 1.1, 0.4], width: 0.12 });
  attractor.position.set(-38, 4, -300); attractor.scale.setScalar(1.3); attractor.rotation.set(0.3, 0.8, 0);
  scene.add(attractor);

  // Mandelbrot nebula on the far wall
  const mandel = new THREE.Mesh(new THREE.PlaneGeometry(900, 520), new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uOpacity; varying vec2 vUv;
      void main(){
        vec2 c = (vUv - .5) * vec2(3.2, 1.85) * (1.0 - 0.15 * sin(uTime * 0.05)) + vec2(-0.6, 0.0);
        vec2 z = vec2(0.0); float it = 0.0;
        for (int i = 0; i < 90; i++) { z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c; if (dot(z, z) > 64.0) break; it += 1.0; }
        float sm = it - log2(log2(dot(z, z))) + 4.0;
        float k = it >= 89.0 ? 0.0 : sm / 90.0;
        vec3 col = 0.5 + 0.5 * cos(6.2831 * (k * 2.2 + vec3(0.62, 0.72, 0.9)));
        col *= smoothstep(0.0, 0.25, k) * 0.1;
        vec2 e = min(vUv, 1.0 - vUv); col *= smoothstep(0.0, 0.2, min(e.x, e.y * 1.7));
        gl_FragColor = vec4(col * uOpacity, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  mandel.position.set(0, 0, -760); scene.add(mandel);

  const flashCore = glowDot(1, [3, 2.8, 2.6]); scene.add(flashCore);

  return {
    scene, camera,
    update(t, ch, a) {
      const lt = t - BANG, bp = beatPulse(t, 6);
      const u = cosmos.material.uniforms;
      u.uTime.value = t;
      u.uMix.value = ease.outExpo(clamp(lt / 3.2));
      u.uA.value = Math.exp(-lt * 1.2) + bp * 0.25 + a.hit * 0.15;
      u.uB.value = Math.exp(-lt * 2.5);
      u.uSize.value = 0.9; u.uC.value = span(lt, 1.5, 3); u.uMaxSize.value = lerp(0.03, 0.011, span(lt, 1.5, 3));
      flashCore.scale.setScalar(Math.max(0, 40 * Math.exp(-lt * 2.2)));
      stars.material.uniforms.uTime.value = t; stars.material.uniforms.uA.value = span(lt, 1, 4);

      const pull = span(t, C[6] - 0.1, 176.8, ease.inOut3);
      shell.material.uniforms.uTime.value = t; shell.material.uniforms.uA.value = span(t, C[6] + 0.3, C[7] + 1.2);
      mandel.material.uniforms.uTime.value = t; mandel.material.uniforms.uOpacity.value = span(lt, 2, 6) * (1 - pull * 0.7);

      // camera: blast → flight along the path → pull out of the universe
      const uu = uAt(t);
      const pos = curve.getPointAt(uu), ahead = curve.getPointAt(Math.min(1, uu + 0.035));
      if (t < t0) { pos.set(0, 6, 42 + (t0 - t) * 6); ahead.set(0, 0, 0); }
      const outPos = new THREE.Vector3(0, 480, 1450), center = new THREE.Vector3(0, 0, -230);
      if (t >= t0) ahead.lerp(new THREE.Vector3(0, 0, 0), 1 - span(t, t0, t0 + 1.2, ease.inOut2)); // ease the gaze from the blast onto the path
      const cam = pos.clone().lerp(outPos, pull), tgt = ahead.clone().lerp(center, Math.min(1, pull * 1.6));
      const roll = Math.sin(t * 0.35) * 0.12 * (1 - pull);
      look(camera, cam.toArray(), tgt.toArray(), roll);
      camera.fov = lerp(62, 48, pull); camera.far = 8000; camera.updateProjectionMatrix();

      main.forEach(m => {
        const st = t - m.userData.cue;
        const near = THREE.MathUtils.smoothstep(camera.position.distanceTo(m.position), 13, 25); // gone before it fills the lens
        const on = span(st, -0.1, 0.35) * near * (1 - pull);
        fade(m, on);
        m.quaternion.copy(camera.quaternion);
        m.scale.setScalar(1 + Math.exp(-Math.max(0, st) * 5) * 0.3);
      });
      extra.forEach(m => {
        const near = THREE.MathUtils.smoothstep(camera.position.distanceTo(m.position), 18, 34);
        fade(m, span(lt, 2, 4) * near * (1 - pull) * (0.55 + 0.45 * Math.sin(t * 0.8 + m.userData.phase)));
        m.quaternion.copy(camera.quaternion);
      });
      attractor.userData.draw(span(t, C[3], C[6], ease.inOut2));
      fade(attractor, span(t, C[3], C[3] + 0.5) * (1 - pull));

      return {
        bloom: 0.5 + Math.exp(-lt * 1.5) * 0.6 + bp * 0.15, exposure: 1 + Math.exp(-lt * 2) * 0.5,
        ca: 0.0015 + Math.exp(-lt * 2) * 0.01, shake: Math.exp(-lt * 1.5) * 1.5 + bp * 0.2 * (1 - pull), vignette: 0.5, barrel: Math.exp(-lt * 2) * 0.4,
      };
    },
  };
}
