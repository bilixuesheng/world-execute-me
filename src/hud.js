// The on-screen "debugger" layer: timecode, chapter, beat meter and (optional) lyrics.
import { MONO } from './engine/text.js';
import { CHAPTERS, beat } from './timeline.js';
import { clamp } from './engine/util.js';

const CJK = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", "WenQuanYi Zen Hei", sans-serif';

const pad = (n, w = 2) => String(n).padStart(w, '0');
const ease3 = x => 1 - Math.pow(1 - x, 3);
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

    if (lyric && this.showLyrics) this.drawLyric(t, lyric, a, W, H, k);
    g.globalAlpha = 1;
  }

  // Lyrics as a terminal line. With per-word timing the words appear exactly as they are
  // sung: upcoming words wait as dim ghosts, the word being sung types itself in red with a
  // small pop, sung words settle to white, and the translation fills in underneath.
  drawLyric(t, lyric, a, W, H, k) {
    const { g } = this;
    const out = clamp((lyric.end - t) / 0.25), enter = ease3(clamp((t - lyric.start + 0.08) / 0.22));
    const mainPx = Math.round(34 * k), mainFont = `400 ${mainPx}px ${MONO}`, subFont = `400 ${Math.round(26 * k)}px ${CJK}`;
    const words = lyric.words ?? [{ t: lyric.start, w: lyric.text, typed: 45 }];
    g.textBaseline = 'middle'; g.textAlign = 'left';
    g.font = mainFont;
    const space = g.measureText(' ').width, prompt = g.measureText('> ').width;
    const widths = words.map(w => g.measureText(w.w).width);
    const w1 = prompt + widths.reduce((s, w) => s + w, 0) + space * (words.length - 1) + g.measureText('▍').width;
    g.font = subFont;
    const w2 = lyric.sub ? g.measureText(lyric.sub).width : 0;
    const w = Math.max(w1, w2), y = H * (lyric.sub ? 0.845 : 0.86) + (1 - enter) * 14 * k, boxH = lyric.sub ? 96 * k : 56 * k;
    const x0 = W / 2 - w1 / 2;

    // how far through the line the singer is (0..1), for the translation fill
    let sung = 0;
    words.forEach((wd, i) => { const nt = words[i + 1]?.t ?? wd.t + 0.4; sung += clamp((t - wd.t) / Math.max(0.08, nt - wd.t)); });
    const prog = sung / words.length;

    g.globalAlpha = 0.9 * out * enter;
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(W / 2 - w / 2 - 18 * k, y - 28 * k, w + 36 * k, boxH);
    // a thin progress rail along the top of the box, pulsing with the kick
    g.fillStyle = `rgba(255,60,100,${0.5 + 0.5 * clamp(a.hit)})`;
    g.fillRect(W / 2 - w / 2 - 18 * k, y - 28 * k, (w + 36 * k) * prog, 2 * k);

    g.font = mainFont;
    g.fillStyle = '#7c86a6'; g.fillText('>', x0, y);
    let x = x0 + prompt, cursorX = x, cursorOn = false;
    words.forEach((wd, i) => {
      const nt = words[i + 1]?.t ?? wd.t + 0.45;
      const since = t - wd.t;
      const typeDur = wd.typed ? wd.w.length / wd.typed : Math.min(0.32, Math.max(0.1, (nt - wd.t) * 0.8));
      const nChars = since < 0 ? 0 : Math.min(wd.w.length, Math.ceil((since / typeDur) * wd.w.length));
      const current = since >= 0 && t < nt;
      // ghost of the word still to come
      g.globalAlpha = 0.2 * out * enter; g.fillStyle = '#dfe8ff'; g.shadowBlur = 0;
      if (nChars < wd.w.length) g.fillText(wd.w, x, y);
      if (nChars > 0) {
        const pop = current ? Math.exp(-since * 9) : 0;
        g.save();
        g.translate(x, y - pop * 7 * k); g.scale(1 + pop * 0.12, 1 + pop * 0.12);
        g.globalAlpha = out;
        g.fillStyle = current ? '#ff4d73' : '#f2f5ff';
        g.shadowColor = current ? 'rgba(255,50,100,0.95)' : 'rgba(255,60,100,0.55)'; g.shadowBlur = (current ? 18 : 8) * k;
        g.fillText(wd.w.slice(0, nChars), 0, 0);
        g.restore();
      }
      if (since >= 0) { cursorX = x + g.measureText(wd.w.slice(0, nChars)).width; cursorOn = nChars < wd.w.length || current; }
      x += widths[i] + space;
    });
    g.shadowBlur = 0;
    const lineDone = t >= words[words.length - 1].t + 0.3;
    if (t >= words[0].t && (cursorOn || !lineDone || Math.floor(t * 3) % 2 === 0)) {
      g.globalAlpha = out; g.fillStyle = '#ff4d73';
      g.fillRect(cursorX + 2 * k, y - mainPx * 0.45, mainPx * 0.45, mainPx * 0.9);
    }

    if (lyric.sub) {
      // translation: dim underneath, filling left-to-right as the line is sung
      const sy = y + 42 * k, sx = W / 2 - w2 / 2;
      g.font = subFont;
      g.globalAlpha = 0.45 * out * enter; g.fillStyle = '#9aa6cc';
      g.fillText(lyric.sub, sx, sy);
      g.save();
      g.beginPath(); g.rect(sx - 2, sy - 20 * k, (w2 + 4) * prog, 40 * k); g.clip();
      g.globalAlpha = 0.95 * out * enter; g.fillStyle = '#e8ecff';
      g.fillText(lyric.sub, sx, sy);
      g.restore();
    }
  }
}
