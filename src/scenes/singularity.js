// 03:13 — 03:25  Instrumental outro. A black hole, ray-marched with gravitational lensing.
// Its accretion disk is made of code, orbiting and falling in. The camera spirals down
// toward the horizon and plunges through.
import * as THREE from 'three';
import { base, fade } from './common.js';
import { formulaPlane } from '../engine/text.js';
import { beatPulse } from '../timeline.js';
import { span, ease, lerp, noise1 } from '../engine/util.js';

const START = 193.46, END = 205.56;

const FRAG = /* glsl */`
  uniform vec3 uCamPos; uniform mat3 uCamRot; uniform float uTanFov, uAspect, uTime, uPulse, uFade, uDiskBright;
  varying vec2 vUv;
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }

  vec3 sky(vec3 d){
    // stars on a spherical grid + a faint band
    vec3 c = vec3(0.0);
    for (int k = 0; k < 2; k++) {
      float sc = k == 0 ? 90.0 : 220.0;
      vec3 q = d * sc; vec3 id = floor(q), f = fract(q) - 0.5;
      float h = h31(id + float(k) * 17.0);
      if (h > 0.965) { float s = smoothstep(0.12, 0.0, length(f)); c += vec3(0.8 + h * 0.2, 0.85, 1.0) * s * (k == 0 ? 1.6 : 0.8); }
    }
    float band = exp(-pow(d.y * 3.0 + sin(d.x * 2.0) * 0.3, 2.0));
    c += vec3(0.035, 0.028, 0.06) * band;
    return c;
  }

  // Code texture on the disk: rings of little dot-matrix characters.
  vec3 disk(vec3 q, vec3 rd){
    float r = length(q.xz);
    float ang = atan(q.z, q.x);
    float omega = 1.6 * pow(r, -1.5);
    float a = ang + uTime * omega * 3.0;
    float ringW = 0.55;
    float ring = floor(r / ringW);
    float fr = fract(r / ringW);
    float cells = floor(r * 5.0);
    float ca = a / 6.28318 * cells;
    float cell = floor(ca), fc = fract(ca);
    float present = step(0.3, h21(vec2(cell, ring)));
    // 3x5 dot matrix inside each cell
    vec2 g = vec2(fc * 4.0, fr * 7.0) - vec2(0.5, 1.0);
    vec2 gi = floor(g);
    float inside = step(0.0, gi.x) * step(gi.x, 2.0) * step(0.0, gi.y) * step(gi.y, 4.0);
    float bit = step(0.45, h21(vec2(cell * 7.0 + gi.x, ring * 13.0 + gi.y + floor(uTime * 2.0 + cell) * 0.0)));
    vec2 gf = fract(g) - 0.5;
    float dotm = smoothstep(0.5, 0.2, max(abs(gf.x), abs(gf.y)));
    float glyph = present * inside * bit * dotm;
    // temperature: hot inside, cooler out
    float temp = pow(2.4 / r, 1.6);
    vec3 hot = mix(vec3(1.6, 0.35, 0.15), vec3(2.2, 1.6, 1.1), clamp(temp, 0.0, 1.0));
    hot = mix(hot, vec3(1.6, 1.8, 2.4), clamp(temp - 1.0, 0.0, 1.0));
    // doppler beaming: the side moving toward us is brighter and bluer
    vec3 vel = normalize(vec3(-q.z, 0.0, q.x));
    float beta = 0.55 / sqrt(r);
    float dop = 1.0 / (1.0 - beta * dot(vel, -rd));
    float beam = pow(dop, 3.0);
    float fadeR = smoothstep(2.3, 3.0, r) * smoothstep(11.0, 7.0, r);
    float base = 0.4 + 0.6 * glyph;
    float swirl = 0.6 + 0.4 * sin(a * 3.0 + r * 2.0);
    return hot * base * swirl * beam * fadeR * uDiskBright * (1.0 + uPulse);
  }

  void main(){
    vec2 ndc = vUv * 2.0 - 1.0;
    vec3 rd = normalize(uCamRot * vec3(ndc.x * uTanFov * uAspect, ndc.y * uTanFov, -1.0));
    vec3 p = uCamPos, v = rd;
    vec3 h = cross(p, v); float h2 = dot(h, h);
    vec3 col = vec3(0.0); float alpha = 0.0; bool swallowed = false;
    for (int i = 0; i < 160; i++) {
      float r2 = dot(p, p), r = sqrt(r2);
      if (r < 1.0) { swallowed = true; break; }
      if (r > 80.0) break;
      float dt = clamp(0.06 * r, 0.015, 2.0);
      vec3 acc = -1.5 * h2 * p / (r2 * r2 * r);
      v += acc * dt;
      vec3 pn = p + v * dt;
      if (p.y * pn.y < 0.0) {
        vec3 q = mix(p, pn, p.y / (p.y - pn.y));
        float rq = length(q.xz);
        if (rq > 2.3 && rq < 11.0) {
          vec3 e = disk(q, normalize(v));
          float op = clamp(0.35 + dot(e, vec3(0.3)), 0.0, 0.95);
          col += e * (1.0 - alpha);
          alpha += (1.0 - alpha) * op;
        }
      }
      p = pn;
      if (alpha > 0.98) break;
    }
    if (!swallowed) col += sky(normalize(v)) * (1.0 - alpha);
    gl_FragColor = vec4(col * (1.0 - uFade), 1.0);
  }`;

export function create() {
  const { scene, camera } = base(55);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uCamPos: { value: new THREE.Vector3() }, uCamRot: { value: new THREE.Matrix3() }, uTanFov: { value: 0.5 }, uAspect: { value: 16 / 9 },
      uTime: { value: 0 }, uPulse: { value: 0 }, uFade: { value: 0 }, uDiskBright: { value: 1 },
    },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: FRAG, depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false; scene.add(quad);

  const rs = formulaPlane('r_{s} = \\frac{2GM}{c^{2}}', 0.08, { size: 110, color: '#ffe3c2', intensity: 1.2 });
  rs.material.depthTest = false; rs.renderOrder = 10;
  scene.add(camera); camera.add(rs); rs.position.set(-0.62, -0.3, -1);
  const horizon = formulaPlane('\\lim_{r→r_{s}}\\, t = ∞', 0.07, { size: 110, color: '#c9dcff', intensity: 1.1 });
  horizon.material.depthTest = false; horizon.renderOrder = 10;
  camera.add(horizon); horizon.position.set(0.6, -0.3, -1);

  const m4 = new THREE.Matrix4();

  return {
    scene, camera,
    update(t, ch, a) {
      const lt = t - START, bp = beatPulse(t, 6);
      const approach = span(t, START, END - 1.4, ease.inOut2);
      const plunge = span(t, END - 1.4, END - 0.05, ease.in3);
      const r = lerp(lerp(38, 7.5, approach), 0.6, plunge);
      const az = 0.4 + lt * 0.16 + plunge * 1.2;
      const el = lerp(0.3, 0.07, approach) + noise1(t * 0.5) * 0.02;
      const pos = new THREE.Vector3(Math.cos(el) * Math.sin(az) * r, Math.sin(el) * r + 0.05, Math.cos(el) * Math.cos(az) * r);
      camera.position.copy(pos);
      camera.up.set(Math.sin(lt * 0.05) * 0.2, 1, 0);
      camera.lookAt(0, 0, 0);
      camera.fov = lerp(55, 80, plunge); camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      const u = mat.uniforms;
      u.uCamPos.value.copy(pos);
      u.uCamRot.value.setFromMatrix4(m4.extractRotation(camera.matrixWorld));
      u.uTanFov.value = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      u.uTime.value = t; u.uPulse.value = bp * 0.3 + a.bass * 0.2;
      u.uFade.value = 1 - span(t, START - 0.8, START + 1.2);
      u.uDiskBright.value = 0.55 + approach * 0.35;

      fade(rs, span(lt, 1.2, 2.2) * (1 - span(lt, 6.5, 7.5)) * 0.9);
      fade(horizon, span(lt, 3.0, 4.0) * (1 - span(lt, 6.5, 7.5)) * 0.9);

      return { bloom: 0.75 + bp * 0.2 + plunge * 0.6, ca: 0.0015 + plunge * 0.012, barrel: plunge * 0.5, vignette: 0.5, shake: plunge * 0.8, grain: 0.05 };
    },
  };
}
