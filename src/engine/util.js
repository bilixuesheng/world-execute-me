// Small, dependency-free helpers shared by every scene.
// Every scene is a pure function of time, so nothing here keeps hidden state.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const smoothstep = (a, b, x) => { const t = invLerp(a, b, x); return t * t * (3 - 2 * t); };
export const fract = x => x - Math.floor(x);
export const TAU = Math.PI * 2;

export const ease = {
  in2: t => t * t,
  out2: t => 1 - (1 - t) * (1 - t),
  inOut2: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  in3: t => t * t * t,
  out3: t => 1 - Math.pow(1 - t, 3),
  inOut3: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  outElastic: t => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
};

// Progress 0..1 of x through [a, b], eased.
export const span = (x, a, b, e = ease.inOut2) => e(invLerp(a, b, x));

// Deterministic PRNG (mulberry32) so every frame renders identically.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453123);

// 1D value noise, smooth, for camera drift and wobble.
export function noise1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u) * 2 - 1;
}

// Decaying envelope after the most recent cue at or before t.
export function hit(t, cues, decay = 6) {
  let last = -Infinity;
  for (const c of cues) if (c <= t) last = c; else break;
  return last === -Infinity ? 0 : Math.exp(-(t - last) * decay);
}
// Index of the most recent cue at or before t (-1 before the first).
export function cueIndex(t, cues) {
  let i = -1;
  for (let k = 0; k < cues.length; k++) if (cues[k] <= t) i = k; else break;
  return i;
}

// Piecewise-constant keys that glide from one value to the next over `dur` seconds after
// each key time. Continuous even when a new key arrives before the previous glide ends.
export function glide(t, keys, dur = 1, e = ease.inOut3) {
  let v = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [tk, vk] = keys[i];
    if (t <= tk) break;
    v = lerp(v, vk, e(clamp((t - tk) / dur)));
  }
  return v;
}
export const glide3 = (t, keys, dur, e) => [0, 1, 2].map(i => glide(t, keys.map(([tk, v]) => [tk, v[i]]), dur, e));

// A smooth kick that starts at 0, peaks at x = tau and dies away (no jump at x = 0).
export const bump = (x, tau = 0.25) => (x <= 0 ? 0 : (x / tau) * Math.exp(1 - x / tau));
