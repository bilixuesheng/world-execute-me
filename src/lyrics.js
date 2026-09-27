// Parses a user-supplied .lrc file. Lyrics are never bundled with the video;
// load your own file in the player (or pass --lrc to the renderer).

export class Lyrics {
  constructor() { this.lines = []; }
  get loaded() { return this.lines.length > 0; }

  parse(text) {
    const out = [];
    for (const raw of text.split(/\r?\n/)) {
      const tags = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
      if (!tags.length) continue;
      const body = raw.replace(/\[[^\]]*\]/g, '').trim();
      for (const m of tags) out.push({ t: +m[1] * 60 + +m[2], text: body });
    }
    out.sort((a, b) => a.t - b.t);
    out.forEach((l, i) => { l.end = i + 1 < out.length ? out[i + 1].t : l.t + 6; });
    this.lines = out;
    return this;
  }

  at(t) {
    let cur = null;
    for (const l of this.lines) { if (l.t <= t) cur = l; else break; }
    if (!cur || !cur.text || t > cur.end + 0.2) return null;
    return { text: cur.text, start: cur.t, end: cur.end };
  }
}
