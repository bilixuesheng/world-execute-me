import * as THREE from 'three';
import { noise1, clamp, lerp, ease } from '../engine/util.js';

export function base(fov = 50, bg = 0x000000) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bg);
  const camera = new THREE.PerspectiveCamera(fov, 16 / 9, 0.05, 6000);
  return { scene, camera };
}

// Show a mesh at opacity v (hides it when invisible so it costs nothing).
export function fade(obj, v) {
  obj.visible = v > 0.003;
  obj.traverse?.(o => { if (o.material) { o.material.opacity = v; if (o.material.uniforms?.uOpacity) o.material.uniforms.uOpacity.value = v; } });
}

export function look(camera, p, target, roll = 0) {
  camera.position.set(p[0], p[1], p[2]);
  camera.up.set(Math.sin(roll), Math.cos(roll), 0);
  camera.lookAt(target[0], target[1], target[2]);
}

// Hand-held drift: small smooth offsets.
export const drift = (t, amp = 1, speed = 0.3, seed = 0) =>
  [noise1(t * speed + seed) * amp, noise1(t * speed + seed + 17.3) * amp, noise1(t * speed + seed + 41.9) * amp];

// Orbit position around a target.
export const orbit = (r, az, el, target = [0, 0, 0]) =>
  [target[0] + r * Math.cos(el) * Math.sin(az), target[1] + r * Math.sin(el), target[2] + r * Math.cos(el) * Math.cos(az)];

// Box / panel canvas with a border, for error windows.
export function panelCanvas(title, lines, { w = 900, color = '#ff3b30', bg = 'rgba(40,0,4,0.85)', size = 30, font } = {}) {
  const c = document.createElement('canvas'), lh = size * 1.35;
  c.width = w; c.height = Math.ceil(lh * (lines.length + 1) + size * 2.2);
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = color; g.lineWidth = 4; g.strokeRect(2, 2, c.width - 4, c.height - 4);
  g.fillStyle = color; g.fillRect(0, 0, c.width, lh * 1.1);
  g.font = `800 ${size}px ${font}`; g.textBaseline = 'middle'; g.fillStyle = '#000';
  g.fillText(title, size * 0.5, lh * 0.55);
  g.fillStyle = color; g.font = `400 ${size * 0.9}px ${font}`;
  lines.forEach((l, i) => g.fillText(l, size * 0.5, lh * 1.1 + size * 0.6 + lh * (i + 0.5)));
  return c;
}

// Camera "shots" that blend into each other instead of cutting.
// shots: [{ at, pose: t => ({ p: [x,y,z], target: [x,y,z], roll }) }]; each blend spans `w` seconds centred on `at`.
export function shotCam(camera, t, shots, w = 0.9) {
  let i = 0;
  for (let k = 1; k < shots.length; k++) if (t >= shots[k].at - w / 2) i = k;
  let pose = shots[i].pose(t);
  if (i > 0) {
    const k = clamp((t - (shots[i].at - w / 2)) / w);
    if (k < 1) {
      const prev = shots[i - 1].pose(t), e = ease.inOut3(k);
      pose = {
        p: prev.p.map((v, j) => lerp(v, pose.p[j], e)),
        target: prev.target.map((v, j) => lerp(v, pose.target[j], e)),
        roll: lerp(prev.roll ?? 0, pose.roll ?? 0, e),
      };
    }
  }
  look(camera, pose.p, pose.target, pose.roll ?? 0);
  return pose;
}
