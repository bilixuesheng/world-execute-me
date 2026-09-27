// Parses a user-supplied .lrc file. Lyrics are never bundled with the video;
// load your own file in the player (or pass --lrc to the renderer).
// Bilingual files are supported the usual way: lines that share a timestamp are
// grouped, the first is the lyric and the rest are shown underneath as its translation.
// Enhanced LRC word tags ([00:01.33]<00:01.33>Remember <00:01.40>to …) drive karaoke timing.

export class Lyrics {
  constructor() { this.lines = []; }
  get loaded() { return this.lines.length > 0; }

  parse(text) {
    const raw = [];
    for (const line of text.split(/\r?\n/)) {
      const tags = [...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
      if (!tags.length) continue;
      const body = line.replace(/\[[^\]]*\]/g, '').trim();
      const words = [...body.matchAll(/<(\d+):(\d+(?:\.\d+)?)>\s*([^<]*)/g)].map(w => ({ t: +w[1] * 60 + +w[2], w: w[3].trim() })).filter(w => w.w);
      const text = words.length ? words.map(w => w.w).join(' ') : body;
      for (const m of tags) raw.push({ t: +m[1] * 60 + +m[2], text, words: words.length ? words : null });
    }
    // stable sort keeps file order for lines with the same timestamp
    raw.sort((a, b) => a.t - b.t);
    const out = [];
    for (const l of raw) {
      const prev = out[out.length - 1];
      if (prev && Math.abs(prev.t - l.t) < 0.005) { if (l.text) prev.sub = prev.sub ? `${prev.sub} ${l.text}` : l.text; }
      else out.push({ t: l.t, text: l.text, sub: '', words: l.words });
    }
    out.forEach((l, i) => { l.end = i + 1 < out.length ? out[i + 1].t : l.t + 6; });
    this.lines = out;
    return this;
  }

  at(t) {
    let cur = null;
    for (const l of this.lines) { if (l.t <= t) cur = l; else break; }
    if (!cur || !cur.text || t > cur.end + 0.2) return null;
    return { text: cur.text, sub: cur.sub, words: cur.words, start: cur.t, end: cur.end };
  }
}
