// The on-screen "debugger" layer: timecode, chapter, beat meter and (optional) lyrics.
import { MONO } from './engine/text.js';
import { CHAPTERS, beat } from './timeline.js';
import { clamp } from './engine/util.js';

const pad = (n, w = 2) => String(n).padStart(w, '0');
const tc = t => { t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60; return `${pad(m)}:${pad(Math.floor(s))}.${pad(Math.floor((s % 1) * 100))}`; };

export class Hud {
  constructor(canvas) { this.canvas = canvas; this.g = canvas.getContext('2d'); this.showHud = true; this.showLyrics = true; }

  resize(w, h) { this.canvas.width = w; this.canvas.height = h; }

  draw(t, ch, a, lyric) {
    const { g, canvas } = this, W = canvas.width, H = canvas.height, k = H / 1080;
    g.clearRect(0, 0, W, H);
    const inIntro = t < 16.0, inEnd = ch.id === 'end';
    const hudA = this.showHud ? clamp((t - 16.2) / 1.5) * (inEnd ? clamp(1 - (t - 205.56) / 0.5) : 1) : 0;

    if (hudA > 0 && !inIntro) {
      g.globalAlpha = hudA * 0.62;
      g.fillStyle = '#dfe8ff'; g.strokeStyle = '#dfe8ff'; g.lineWidth = Math.max(1, 1.5 * k);
      g.font = `400 ${Math.round(17 * k)}px ${MONO}`; g.textBaseline = 'top';
      const m = 38 * k;
      // corner brackets
      const L = 26 * k;
      for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
        g.beginPath(); g.moveTo(x, y + sy * L); g.lineTo(x, y); g.lineTo(x + sx * L, y); g.stroke();
      }
      g.textAlign = 'left';
      g.fillText('world.execute(me);', m + 14 * k, m + 10 * k);
      g.fillStyle = '#ff5577'; g.fillText(`[${pad(ch.index)}] ${ch.label}`, m + 14 * k, H - m - 30 * k);
      g.fillStyle = '#dfe8ff'; g.textAlign = 'right';
      const q = beat(t);
      g.fillText(`T+${tc(t)}`, W - m - 14 * k, m + 10 * k);
      g.fillText(`130 BPM  ${pad(q.bar + 16, 3)}:${q.inBar + 1}`, W - m - 14 * k, m + 34 * k);
      // beat meter
      const bw = 10 * k, bx = W - m - 14 * k - 4 * (bw + 5 * k);
      for (let i = 0; i < 4; i++) {
        g.globalAlpha = hudA * (i === q.inBar ? 0.9 : 0.25);
        g.fillRect(bx + i * (bw + 5 * k), m + 60 * k, bw, 4 * k);
      }
      // level meter
      g.globalAlpha = hudA * 0.5;
      const lw = 140 * k;
      g.fillRect(W - m - 14 * k - lw, H - m - 22 * k, lw * clamp(a.level), 3 * k);
      g.fillRect(W - m - 14 * k - lw, H - m - 14 * k, lw * clamp(a.bass), 3 * k);
      g.textAlign = 'left';
      g.globalAlpha = hudA * 0.45;
      const prog = t / CHAPTERS[CHAPTERS.length - 1].end;
      g.fillRect(m + 14 * k, H - m - 8 * k, 240 * k * clamp(prog), 2 * k);
    }

    if (lyric && this.showLyrics) {
      const n = Math.floor((t - lyric.start) * 45);
      const shown = lyric.text.slice(0, Math.max(0, n));
      const cursor = n < lyric.text.length || Math.floor(t * 3) % 2 === 0 ? '▍' : ' ';
      const out = clamp((lyric.end - t) / 0.25);
      g.globalAlpha = 0.95 * out;
      g.font = `400 ${Math.round(34 * k)}px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const text = `> ${shown}${cursor}`;
      const w = g.measureText(`> ${lyric.text}▍`).width;
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(W / 2 - w / 2 - 18 * k, H * 0.86 - 28 * k, w + 36 * k, 56 * k);
      g.fillStyle = '#f2f5ff';
      g.textAlign = 'left';
      g.shadowColor = 'rgba(255,60,100,0.8)'; g.shadowBlur = 12 * k;
      g.fillText(text, W / 2 - w / 2, H * 0.86);
      g.shadowBlur = 0;
    }
    g.globalAlpha = 1;
  }
}
