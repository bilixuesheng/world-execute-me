// Offline audio analysis. The whole song is decoded once and turned into
// per-frame envelopes, so every frame's "loudness" is a pure function of time
// (the headless renderer and the live player see identical values).
// Without a song loaded, the envelopes are synthesised from the beat grid.

import { SYNC, CHAPTERS, beat } from '../timeline.js';
import { clamp } from './util.js';

const FPS = 100; // envelope resolution

// Rough loudness of each chapter, used only when no song is loaded.
const DEMO_LEVEL = {
  boot: 0.25, genesis: 0.55, geometry: 0.6, current: 0.65, sim: 0.8, objects: 0.62, switch: 0.68,
  vibe: 0.82, erase: 0.6, warp: 0.85, execution: 1, cosmos: 1, love: 0.75, singularity: 0.8, end: 0.3,
};

export class AudioAnalysis {
  constructor() { this.env = null; this.duration = 0; this.leadIn = 0; }

  get loaded() { return !!this.env; }

  async analyse(arrayBuffer) {
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new Ctx(1, 2, 44100);
    const buf = await ctx.decodeAudioData(arrayBuffer);
    const sr = buf.sampleRate, n = buf.length;
    const mono = new Float32Array(n);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) mono[i] += d[i] / buf.numberOfChannels;
    }
    this.duration = buf.duration;

    // Three bands from one-pole filters: low (<~150 Hz), high (>~3.5 kHz), full.
    const hop = Math.round(sr / FPS), frames = Math.ceil(n / hop);
    const low = new Float32Array(frames), high = new Float32Array(frames), full = new Float32Array(frames);
    const aL = Math.exp(-2 * Math.PI * 150 / sr), aH = Math.exp(-2 * Math.PI * 3500 / sr);
    let lp = 0, lpH = 0;
    for (let f = 0; f < frames; f++) {
      let sL = 0, sH = 0, sF = 0; const end = Math.min(n, (f + 1) * hop);
      for (let i = f * hop; i < end; i++) {
        const x = mono[i];
        lp = (1 - aL) * x + aL * lp;
        lpH = (1 - aH) * x + aH * lpH;
        const hp = x - lpH;
        sL += lp * lp; sH += hp * hp; sF += x * x;
      }
      const k = 1 / Math.max(1, end - f * hop);
      low[f] = Math.sqrt(sL * k); high[f] = Math.sqrt(sH * k); full[f] = Math.sqrt(sF * k);
    }
    const norm = a => {
      const s = Float32Array.from(a).sort(), p = s[Math.floor(s.length * 0.97)] || 1;
      for (let i = 0; i < a.length; i++) a[i] = clamp(a[i] / p, 0, 1.5);
    };
    norm(low); norm(high); norm(full);

    // Onsets: positive flux of the low band, normalised.
    const kick = new Float32Array(frames);
    for (let f = 1; f < frames; f++) kick[f] = Math.max(0, low[f] - low[f - 1] * 1.05);
    norm(kick);

    // Smooth envelopes (fast attack, slow release) for "level" style values.
    const smooth = (a, att, rel) => { const o = new Float32Array(a.length); let v = 0; for (let i = 0; i < a.length; i++) { const x = a[i]; v += (x - v) * (x > v ? att : rel); o[i] = v; } return o; };
    const level = smooth(full, 0.5, 0.04), bass = smooth(low, 0.6, 0.12), treble = smooth(high, 0.6, 0.15);
    // A decaying kick envelope.
    const hitEnv = new Float32Array(frames); let hv = 0;
    for (let f = 0; f < frames; f++) { hv = Math.max(hv * 0.86, kick[f] > 0.35 ? kick[f] : 0); hitEnv[f] = hv; }

    // Lead-in: some rips have silence before the first sound. The song itself starts at ~0.03 s.
    let first = 0; while (first < frames && full[first] < 0.02) first++;
    this.leadIn = first / FPS > 0.35 ? first / FPS - 0.03 : 0;

    this.env = { level, bass, treble, hit: hitEnv, kick, frames };
    this.refinePhase();
    return this;
  }

  // Nudge the beat-grid anchor so beats line up with the detected kicks (±110 ms).
  refinePhase() {
    const { kick, frames } = this.env;
    const period = 60 / SYNC.bpm, base = SYNC.baseAnchor;
    let best = 0, bestScore = -1;
    for (let d = -0.11; d <= 0.11; d += 0.005) {
      let s = 0;
      for (let tb = base + d + period; tb < this.duration - 1; tb += period) {
        const f = Math.round((tb + this.leadIn) * FPS);
        if (f > 0 && f < frames - 1) s += Math.max(kick[f - 1], kick[f], kick[f + 1]);
      }
      if (s > bestScore) { bestScore = s; best = d; }
    }
    SYNC.anchor = base + best;
    this.phaseShift = best;
  }

  // Envelope values at song time t.
  at(t) {
    if (!this.env) return this.demo(t);
    const e = this.env, x = (t + this.leadIn) * FPS, i = Math.floor(x), f = x - i;
    const g = a => { const i0 = clamp(i, 0, e.frames - 1), i1 = clamp(i + 1, 0, e.frames - 1); return a[i0] * (1 - f) + a[i1] * f; };
    return { level: g(e.level), bass: g(e.bass), treble: g(e.treble), hit: g(e.hit), real: true };
  }

  demo(t) {
    let ch = CHAPTERS[0];
    for (const c of CHAPTERS) if (t >= c.start) ch = c;
    const L = DEMO_LEVEL[ch.id] ?? 0.6, q = beat(t);
    const k = Math.exp(-q.frac * 0.46 * 9), onK = t > 16 && ch.id !== 'end' ? 1 : 0.2;
    return { level: L * (0.85 + 0.15 * k), bass: L * (0.4 + 0.6 * k * onK), treble: L * 0.6 * (0.6 + 0.4 * Math.exp(-((q.frac * 2) % 1) * 3)), hit: k * onK * L, real: false };
  }
}
