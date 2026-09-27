// Parses a user-supplied .lrc file. Lyrics are never bundled with the video;
// load your own file in the player (or pass --lrc to the renderer).
// Bilingual files are supported the usual way: lines that share a timestamp are
// grouped, the first is the lyric and the rest are shown underneath as its translation.

export class Lyrics {
  constructor() { this.lines = []; }
  get loaded() { return this.lines.length > 0; }

  parse(text) {
    const raw = [];
    for (const line of text.split(/\r?\n/)) {
      const tags = [...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
      if (!tags.length) continue;
      const body = line.replace(/\[[^\]]*\]/g, '').trim();
      for (const m of tags) raw.push({ t: +m[1] * 60 + +m[2], text: body });
    }
    // stable sort keeps file order for lines with the same timestamp
    raw.sort((a, b) => a.t - b.t);
    const out = [];
    for (const l of raw) {
      const prev = out[out.length - 1];
      if (prev && Math.abs(prev.t - l.t) < 0.005) { if (l.text) prev.sub = prev.sub ? `${prev.sub} ${l.text}` : l.text; }
      else out.push({ t: l.t, text: l.text, sub: '' });
    }
    out.forEach((l, i) => { l.end = i + 1 < out.length ? out[i + 1].t : l.t + 6; });
    this.lines = out;
    return this;
  }

  at(t) {
    let cur = null;
    for (const l of this.lines) { if (l.t <= t) cur = l; else break; }
    if (!cur || !cur.text || t > cur.end + 0.2) return null;
    return { text: cur.text, sub: cur.sub, start: cur.t, end: cur.end };
  }
}
