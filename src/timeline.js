// The song map. Times are seconds into Mili's "world.execute(me);" (album cut, 3:32).
// Only timings live here — the lyrics are not part of this repository.
// If your copy of the song is offset, fix it with SYNC.offset (or the [ ] keys in the player).

export const SONG = { duration: 212.3, bpm: 130 };

export const SYNC = {
  bpm: 130,
  anchor: 29.28, // a downbeat: the first sung line of verse 1 (nudged by the audio analysis)
  baseAnchor: 29.28,
  offset: 0,     // added to the audio clock before anything reads it
};

export const BEAT = 60 / SYNC.bpm;

// Beat position of time t on the 130 BPM grid.
export function beat(t) {
  const b = (t - SYNC.anchor) / (60 / SYNC.bpm);
  const n = Math.floor(b);
  return { b, n, frac: b - n, bar: Math.floor(b / 4), inBar: ((n % 4) + 4) % 4 };
}
// Pulse envelope: a 25 ms rise (so nothing snaps on in a single frame), then an exponential decay.
const env = (x, decay) => (1 - Math.exp(-x / 0.025)) * Math.exp(-x * decay);
// Pulse on every beat (peaks just after the beat, decaying).
export const beatPulse = (t, decay = 7) => env(beat(t).frac * (60 / SYNC.bpm), decay);
// Pulse on beats 1 and 3 only (kick-ish), and on every bar downbeat.
export const halfPulse = (t, decay = 5) => { const q = beat(t); return q.n % 2 === 0 ? env(q.frac * (60 / SYNC.bpm), decay) : 0; };
export const barPulse = (t, decay = 3) => { const q = beat(t); return q.inBar === 0 ? env(q.frac * (60 / SYNC.bpm), decay) : 0; };

// Chapters. `tin` is the transition that brings the chapter in.
export const CHAPTERS = [
  { id: 'boot',        start: 0,      label: 'BOOT' },
  { id: 'genesis',     start: 16.04,  label: 'GENESIS',        tin: { type: 'dissolve', dur: 0.9 } },
  { id: 'geometry',    start: 29.28,  label: 'GEOMETRY',       tin: { type: 'dissolve', dur: 0.6 } },
  { id: 'current',     start: 44.04,  label: 'CURRENT',        tin: { type: 'glitch', dur: 0.45 } },
  { id: 'sim',         start: 58.65,  label: 'SIMULATION',     tin: { type: 'dissolve', dur: 1.0 } },
  { id: 'objects',     start: 73.53,  label: 'NEW OBJECT()',   tin: { type: 'glitch', dur: 0.4 } },
  { id: 'switch',      start: 88.34,  label: 'SWITCH',         tin: { type: 'dissolve', dur: 0.9 } },
  { id: 'vibe',        start: 102.93, label: 'VIBRATION',      tin: { type: 'dissolve', dur: 0.8 } },
  { id: 'erase',       start: 117.95, label: 'ERASE',          tin: { type: 'glitch', dur: 0.5 } },
  { id: 'warp',        start: 134.38, label: 'OVERFLOW',       tin: { type: 'flash', dur: 0.35 } },
  { id: 'execution',   start: 147.48, label: 'EXECUTION',      tin: { type: 'flash', dur: 0.5 } },
  { id: 'cosmos',      start: 161.31, label: 'UNIVERSE',       tin: { type: 'white', dur: 1.6 } },
  { id: 'love',        start: 176.96, label: 'LOVE',           tin: { type: 'dissolve', dur: 1.0 } },
  { id: 'singularity', start: 193.46, label: 'SINGULARITY',    tin: { type: 'dissolve', dur: 1.4 } },
  { id: 'end',         start: 205.56, label: 'EXIT',           tin: { type: 'white', dur: 1.2 } },
];
CHAPTERS.forEach((c, i) => { c.end = i + 1 < CHAPTERS.length ? CHAPTERS[i + 1].start : SONG.duration + 1; c.index = i; });

// Vocal cues inside each chapter (start times of sung phrases), used to choreograph hits.
export const CUES = {
  boot: [0.03, 1.33, 3.58, 5.16, 7.19, 9.75, 10.90, 12.47],
  geometry: [29.28, 33.01, 36.77, 40.36],
  geometryB: [30.89, 34.54, 38.27, 41.92],
  current: [44.04, 45.52, 47.27, 49.11, 50.95, 52.99, 54.74, 56.79],
  sim: [58.65, 60.57, 62.41, 64.29, 66.17, 67.99, 70.02, 71.20],
  objects: [73.53, 77.16, 80.93, 84.60],
  objectsB: [75.29, 78.93, 82.56, 86.21],
  switch: [88.34, 89.91, 91.44, 93.52, 95.28, 97.32, 98.93, 100.93],
  vibe: [102.93, 104.92, 106.74, 108.69],
  left: [110.30, 111.98, 112.89, 113.75, 114.65, 115.60],
  erase: [117.95, 119.81, 121.80, 123.55, 125.33, 128.42, 130.74],
  execution: [147.48, 148.31, 149.14, 150.16, 151.19, 152.07, 152.94, 153.89, 154.84, 155.77, 156.69, 157.74],
  countdown: [158.79, 159.22, 159.66, 160.05, 160.45, 160.88],
  bang: 161.31,
  cosmos: [162.23, 164.07, 166.05, 167.75, 169.61, 171.77, 173.11, 174.80],
  love: [176.96, 178.79, 180.78, 182.43, 184.33, 187.97, 189.26, 190.24],
  final: 205.56,
};

export function chapterAt(t) {
  let c = CHAPTERS[0];
  for (const ch of CHAPTERS) if (t >= ch.start) c = ch;
  return c;
}
