// 00:58 — 01:13  Chorus 1. A whole wireframe world, flown over at speed —
// then the camera pulls back: the world is sealed inside a cube, one of countless cubes.
import * as THREE from 'three';
import { base, look, drift, fade } from './common.js';
import { gridFloor, glyphField, glowDot, NOISE_GLSL } from '../engine/fx.js';
import { textPlane, MONO } from '../engine/text.js';
import { CUES, beatPulse, barPulse } from '../timeline.js';
import { span, ease, lerp, rng } from '../engine/util.js';

const S = 40; // the world cube is S wide

export function create({ atlas }) {
  const { scene, camera } = base(60);
  const C = CUES.sim;
  const world = new THREE.Group(); scene.add(world);

  // Terrain: a wireframe sheet displaced by noise in the vertex shader, scrolling toward the camera.
  const terrainMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScroll: { value: 0 }, uAmp: { value: 1 }, uBright: { value: 1 }, uPulse: { value: 0 } },
    vertexShader: /* glsl */`
      ${NOISE_GLSL}
      uniform float uScroll, uAmp, uTime; varying float vH; varying float vD;
      void main(){
        vec3 p = position;
        vec2 w = vec2(p.x, p.y - uScroll);
        float valley = smoothstep(2.0, 11.0, abs(p.x));
        float h = (snoise(vec3(w * 0.07, 1.0)) * 0.7 + snoise(vec3(w * 0.19, 4.0)) * 0.3) * 0.5 + 0.5;
        h = pow(h, 1.6) * 9.0 * valley * uAmp;
        p.z = h; vH = h / 9.0; vD = length(position.xy);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uBright, uPulse; varying float vH; varying float vD;
      void main(){
        vec3 lo = vec3(0.05, 0.22, 0.5), hi = vec3(0.8, 0.12, 0.45);
        vec3 c = mix(lo, hi, smoothstep(0.2, 0.9, vH)) * (0.4 + uPulse * 0.5);
        float edge = 1.0 - smoothstep(${(S * 0.38).toFixed(1)}, ${(S * 0.5).toFixed(1)}, vD);
        gl_FragColor = vec4(c * uBright * edge, 1.0);
      }`,
    wireframe: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const terrain = new THREE.Mesh(new THREE.PlaneGeometry(S, S, 44, 44), terrainMat);
  terrain.rotation.x = -Math.PI / 2;
  world.add(terrain);

  const floor = gridFloor({ color: [0.12, 0.4, 0.7], cell: 1, fade: 12, size: S });
  floor.position.y = -0.02; world.add(floor);

  // A synthwave sun made of horizontal slices.
  const sun = new THREE.Group(); world.add(sun);
  const sunMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uBright: { value: 1 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uBright; varying vec2 vUv;
      void main(){
        vec2 c = vUv - .5; float r = length(c); if (r > .5) discard;
        float y = vUv.y;
        float bands = step(0.5, fract(y * 14.0 + uTime * 0.6)) + step(0.55, y);
        if (bands < 0.5) discard;
        vec3 col = mix(vec3(1.3, 0.12, 0.4), vec3(1.5, 0.8, 0.2), smoothstep(0.1, 0.9, y));
        gl_FragColor = vec4(col * uBright * smoothstep(.5, .46, r), 1.);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const sunDisc = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), sunMat);
  sun.add(sunDisc); sun.position.set(0, 5, -S * 0.46);

  // Towers of code along the valley.
  const towers = glyphField({
    count: 5200, atlas, size: 0.34, color: [0.5, 0.65, 0.9], color2: [1.2, 0.2, 0.45],
    positions: (i, r) => { const col = Math.floor(i / 26), rr = rng(col * 7 + 1); const side = rr() < 0.5 ? -1 : 1; return [side * (2.2 + rr() * 5), (i % 26) * 0.42, (rr() - 0.5) * S * 0.9]; },
    body: /* glsl */`
      float h = hash11(aPos.x * 3.1 + aPos.z * 1.7);
      float H = 3.0 + h * 22.0;
      float row = aPos.y / 0.42;
      float z = mod(aPos.z + uA + ${S / 2}.0, ${S}.0) - ${S / 2}.0;
      p.z = z;
      float vis = step(row, H * (0.3 + 0.7 * uB)) * (1.0 - smoothstep(${(S * 0.36).toFixed(1)}, ${(S * 0.48).toFixed(1)}, abs(z)));
      glyph += floor(uTime * (4.0 + aRand.x * 8.0));
      col = mix(uCol1, uCol2, step(0.85, h));
      float head = exp(-abs(row - mod(uTime * 9.0 * (0.5 + h), H + 6.0)) * 0.7);
      bright = vis * (0.15 + head * 1.0 + uC * 0.5);
      size *= vis;`,
  });
  world.add(towers);

  // The pair of points ("us"), flying down the valley together.
  const me = glowDot(0.7, [4, 0.7, 1.3]), you = glowDot(0.7, [0.7, 3, 4]);
  world.add(me, you);

  // "execute" banner in the sky
  const banner = textPlane('while (true) { world.execute(); }', 1.3, { size: 110, weight: 800, family: MONO, color: '#ffffff', intensity: 1.5 });
  banner.position.set(0, 9, -12); world.add(banner);

  // The cube around the world, and the lattice of other worlds.
  const boxEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(S, S * 0.5, S));
  const cube = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ color: new THREE.Color(1.4, 1.4, 1.7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  cube.position.y = S * 0.25 - 0.5; scene.add(cube);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(S, S * 0.5, S), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.006, 0.015, 0.03), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }));
  glass.position.copy(cube.position); scene.add(glass);

  const lattice = new THREE.Group(); scene.add(lattice);
  const L = 3, gap = S * 1.6;
  const pos = [];
  for (let x = -L; x <= L; x++) for (let y = -2; y <= 2; y++) for (let z = -L; z <= L; z++) {
    if (!x && !y && !z) continue;
    pos.push([x * gap, y * gap * 0.6 + S * 0.25, z * gap]);
  }
  const edgeArr = boxEdges.attributes.position.array, latticePts = [];
  for (const p of pos) for (let i = 0; i < edgeArr.length; i += 3) latticePts.push(edgeArr[i] + p[0], edgeArr[i + 1] + p[1], edgeArr[i + 2] + p[2]);
  const latGeo = new THREE.BufferGeometry(); latGeo.setAttribute('position', new THREE.Float32BufferAttribute(latticePts, 3));
  const latMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.2, 0.35, 0.7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  lattice.add(new THREE.LineSegments(latGeo, latMat));
  // tiny suns inside every other world
  const cores = glyphField({
    count: pos.length * 12, atlas, size: 2.2, color: [1.2, 0.3, 0.6], color2: [0.3, 0.9, 1.4],
    positions: (i, rr) => { const p = pos[Math.floor(i / 12)]; return [p[0] + (rr() - 0.5) * S * 0.8, p[1] + (rr() - 0.5) * S * 0.3, p[2] + (rr() - 0.5) * S * 0.8]; },
    body: /* glsl */`glyph += floor(uTime * 3.0 + aRand.x * 9.0); col = mix(uCol1, uCol2, step(0.5, aRand.y)); bright = uA * (0.5 + 0.5 * sin(uTime * 3.0 + aRand.z * 20.0));`,
  });
  lattice.add(cores);

  return {
    scene, camera,
    update(t, ch, a) {
      const lt = t - ch.start, bp = beatPulse(t, 6), br = barPulse(t, 2.5);
      const speed = 14, scroll = lt * speed;
      terrainMat.uniforms.uScroll.value = scroll;
      terrainMat.uniforms.uAmp.value = 0.8 + a.bass * 0.35 + bp * 0.15;
      terrainMat.uniforms.uPulse.value = bp * 0.5 + (lt > C[5] - ch.start ? 0.6 : 0);
      floor.material.uniforms.uScroll.value = scroll;
      floor.material.uniforms.uBright.value = 0.6 + bp * 0.35;
      floor.material.uniforms.uWave.value = br * 1.5; floor.material.uniforms.uWaveR.value = (1 - br) * 25;
      sunMat.uniforms.uTime.value = t; sunMat.uniforms.uBright.value = 0.6 + bp * 0.25;
      const tu = towers.material.uniforms;
      tu.uTime.value = t; tu.uA.value = scroll; tu.uB.value = span(lt, 0, 3) + a.bass * 0.2; tu.uC.value = t > C[5] ? Math.exp(-(t - C[5]) * 1.5) : 0;

      // the pair weaves down the valley
      const wz = 4 - Math.sin(lt * 0.7) * 2;
      me.position.set(Math.sin(t * 2.3) * 0.9, 2.2 + Math.sin(t * 1.6) * 0.4, wz + Math.cos(t * 2.3) * 0.9);
      you.position.set(-Math.sin(t * 2.3) * 0.9, 2.2 + Math.cos(t * 1.6) * 0.4, wz - Math.cos(t * 2.3) * 0.9);
      me.scale.setScalar(0.7 * (1 + bp * 0.4)); you.scale.setScalar(0.7 * (1 + bp * 0.4));

      fade(banner, span(t, C[5], C[5] + 0.3) * (1 - span(t, C[6] - 0.3, C[6] + 0.3)));
      banner.scale.setScalar(1 + span(t, C[5], C[6], ease.out3) * 0.15);

      // --- pull-back reveal
      const pull = span(t, C[6] - 0.2, 73.4, ease.inOut3);
      const pull2 = span(t, C[7], 73.53, ease.in2);
      fade(cube, span(t, C[6] - 0.4, C[6] + 0.6));
      fade(glass, span(t, C[6] - 0.4, C[6] + 0.6) * 0.6);
      latMat.opacity = span(t, C[7] - 0.4, C[7] + 1.0); lattice.visible = latMat.opacity > 0;
      cores.material.uniforms.uTime.value = t; cores.material.uniforms.uA.value = latMat.opacity;
      lattice.rotation.y = (t - C[6]) * 0.05;

      // --- camera
      const d = drift(t, 0.35, 0.5);
      const fly = [me.position.x * 0.3 + d[0], 3.2 + Math.sin(lt * 0.5) * 0.8 + d[1], wz + 7];
      const target = [0, 2.0, wz - 6];
      const outDist = lerp(0, 1, pull) * 55 + pull2 * 180;
      const az = 0.6 + (t - C[6]) * 0.18;
      const outPos = [Math.sin(az) * (30 + outDist), 14 + outDist * 0.55, Math.cos(az) * (30 + outDist)];
      const cam = fly.map((v, i) => lerp(v, outPos[i], pull));
      const tgt = target.map((v, i) => lerp(v, [0, S * 0.2, 0][i], pull));
      const roll = Math.sin(lt * 0.8) * 0.08 * (1 - pull);
      look(camera, cam, tgt, roll);
      camera.fov = lerp(62, 45, pull); camera.updateProjectionMatrix();

      return { bloom: 0.45 + bp * 0.25, ca: 0.0015 + br * 0.003, vignette: 0.5, shake: bp * 0.15 * (1 - pull) };
    },
  };
}
