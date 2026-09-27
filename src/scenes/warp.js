// 02:14 — 02:27  Instrumental build. Through the cracked glass: a tunnel of code,
// flown at ever-increasing speed while the recursion depth explodes.
import * as THREE from 'three';
import { base, look, fade } from './common.js';
import { glyphField, glowDot, NOISE_GLSL } from '../engine/fx.js';
import { drawTextCanvas, planeFromCanvas, MONO } from '../engine/text.js';
import { beat, beatPulse } from '../timeline.js';
import { span, ease, lerp, rng } from '../engine/util.js';

const L = 420;
const START = 134.38, END = 147.48, DUR = END - START;

// distance travelled after lt seconds (speed ramps from 18 to ~260 units/s)
const dist = lt => 18 * lt + 240 * DUR / 4.2 * Math.pow(Math.max(0, lt) / DUR, 4.2);
const speed = lt => 18 + 240 * Math.pow(Math.max(0, lt) / DUR, 3.2);

export function create({ atlas }) {
  const { scene, camera } = base(70);

  const tunnel = glyphField({
    count: 42000, atlas, size: 0.42, color: [0.7, 0.9, 1.3], color2: [1.8, 0.2, 0.4],
    positions: (i, r) => {
      const a = r() * Math.PI * 2, ring = r() < 0.3;
      const z = ring ? -Math.floor(r() * (L / 24)) * 24 : -r() * L;
      const rad = ring ? 6.2 : 6.5 + r() * 3.5;
      return [Math.cos(a) * rad, Math.sin(a) * rad, z];
    },
    body: /* glsl */`
      float z = mod(aPos.z + uA, ${L}.0) - ${L - 6}.0;
      p.z = z;
      float bend = uC;
      p.x += sin(z * 0.018 + uTime * 0.7) * bend * 4.0;
      p.y += cos(z * 0.014 + uTime * 0.5) * bend * 3.0;
      float fk = smoothstep(${-L + 6}.0, -120.0, z) * smoothstep(8.0, -4.0, z);
      glyph += floor(uTime * (6.0 + aRand.x * 12.0));
      col = mix(uCol1, uCol2, step(1.0 - uB, aRand.y));
      bright = fk * (0.18 + 0.5 * aRand.z) * (1.0 + uD);`,
  });
  scene.add(tunnel);

  // speed streaks
  const n = 2600, r = rng(8);
  const sp = new Float32Array(n * 2 * 3), end = new Float32Array(n * 2), sr = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, rad = 2.5 + r() * 9, z = -r() * L, k = r();
    for (let e = 0; e < 2; e++) { sp.set([Math.cos(a) * rad, Math.sin(a) * rad, z], (i * 2 + e) * 3); end[i * 2 + e] = e; sr[i * 2 + e] = k; }
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sg.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  sg.setAttribute('aR', new THREE.BufferAttribute(sr, 1));
  const streakMat = new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 }, uLen: { value: 1 }, uTime: { value: 0 }, uRed: { value: 0 }, uC: { value: 0 }, uBright: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aEnd, aR; uniform float uA, uLen, uTime, uC; varying float vF; varying float vR;
      void main(){
        vec3 p = position;
        float z = mod(p.z + uA * (0.8 + aR * 0.4), ${L}.0) - ${L - 6}.0;
        p.z = z - aEnd * uLen * (0.5 + aR);
        p.x += sin(p.z * 0.018 + uTime * 0.7) * uC * 4.0;
        p.y += cos(p.z * 0.014 + uTime * 0.5) * uC * 3.0;
        vF = smoothstep(${-L + 6}.0, -80.0, z) * smoothstep(6.0, -2.0, z); vR = aR;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uRed, uBright; varying float vF; varying float vR;
      void main(){ vec3 c = mix(vec3(0.6, 0.9, 1.5), vec3(1.8, 0.2, 0.45), step(1.0 - uRed, vR)); gl_FragColor = vec4(c * vF * uBright, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const streaks = new THREE.LineSegments(sg, streakMat); streaks.frustumCulled = false;
  scene.add(streaks);

  const core = glowDot(1, [3, 2.6, 3]); core.position.set(0, 0, -150); scene.add(core);

  // recursion-depth readout pinned to the camera
  const cv = document.createElement('canvas');
  const readout = planeFromCanvas(drawTextCanvas(['depth = 0'], { size: 64, weight: 800, canvas: cv, cols: 28, color: '#ffffff', align: 'center' }), 0.075, { intensity: 1.4 });
  scene.add(camera); camera.add(readout); readout.position.set(0, -0.3, -1);
  let lastTxt = '';

  return {
    scene, camera,
    update(t, ch, a) {
      const lt = t - START, q = beat(t), bp = beatPulse(t, 8);
      const D = dist(lt), v = speed(lt);
      const late = span(lt, DUR - 3.7, DUR, ease.in2);
      const u = tunnel.material.uniforms;
      u.uTime.value = t; u.uA.value = D; u.uB.value = 0.08 + late * 0.8; u.uC.value = 0.6 * (1 - late * 0.8); u.uD.value = bp * 0.8 + a.hit * 0.4;
      u.uSize.value = 0.42 * (1 + bp * 0.2);
      streakMat.uniforms.uA.value = D; streakMat.uniforms.uLen.value = v * 0.045; streakMat.uniforms.uTime.value = t;
      streakMat.uniforms.uRed.value = late; streakMat.uniforms.uC.value = u.uC.value; streakMat.uniforms.uBright.value = span(lt, 0, 1.5);

      // the light at the end of the tunnel
      const cz = lerp(-150, -8, span(lt, DUR - 2.2, DUR, ease.in3));
      core.position.z = cz; core.scale.setScalar(lerp(4, 60, span(lt, DUR - 2.4, DUR, ease.in3)) * (1 + bp * 0.3));
      fade(core, span(lt, 2, 6));

      // readout: recursion depth doubling
      const depth = Math.floor(Math.pow(2, lt * 2.45));
      const txt = lt > DUR - 1.2 ? 'depth = ∞' : `depth = ${depth.toLocaleString('en-US')}`;
      if (txt !== lastTxt) { drawTextCanvas([txt], { size: 64, weight: 800, canvas: cv, cols: 28, color: late > 0.5 ? '#ff4d6d' : '#ffffff', align: 'center' }); readout.material.map.needsUpdate = true; lastTxt = txt; }
      fade(readout, span(lt, 0.5, 1.2) * 0.85);

      // camera sits in the tunnel, rolling and shaking harder as speed rises
      const roll = Math.sin(lt * 0.6) * 0.3 + late * lt * 0.9;
      look(camera, [Math.sin(lt * 1.3) * 0.4, Math.cos(lt * 1.1) * 0.3, 0], [0, 0, -30], roll);
      camera.fov = lerp(70, 105, late); camera.updateProjectionMatrix();

      // strobe on eighth notes for the last two bars
      const strobe = lt > DUR - 3.69 ? (Math.floor(q.b * 2) % 2 === 0 ? Math.exp(-((q.b * 2) % 1) * 4) * 0.35 : 0) : 0;
      return {
        bloom: 0.45 + bp * 0.3 + late * 0.35, ca: 0.002 + late * 0.012, barrel: 0.15 + late * 0.5, shake: late * 1.2,
        flash: strobe + span(lt, DUR - 0.35, DUR, ease.in2) * 0.9, vignette: 0.6, glitch: a.hit > 0.7 ? 0.08 : 0,
      };
    },
  };
}
