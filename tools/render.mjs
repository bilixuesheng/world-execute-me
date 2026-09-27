// Renders the video in headless Chrome and encodes it with ffmpeg.
//
//   node tools/render.mjs --sheet=20,35,60 [--cols=3] [--w=640] [--out=out/sheet.jpg]    contact sheet
//   node tools/render.mjs --stills=20,161.5 [--out=out/stills]                             full-res PNG stills
//   node tools/render.mjs --frames=0:212.3 [--workers=4] [--fps=30]                        JPEG frames → out/frames (resumable)
//   node tools/render.mjs --encode --audio=song.mp3 [--out=out/world.execute(me).mp4]      frames + song → MP4
//   node tools/render.mjs --clip=150:165 --audio=song.mp3 [--out=out/clip.mp4]             short clip, single worker
//
// Common options:
//   --audio=<file>   the song; drives the audio-reactive parts and is muxed into the MP4
//   --lrc=<file>     optional lyrics, typed on screen
//   --w=1920 --h=1080  output size          --nohud  hide the timecode overlay
//   --chrome=<path>  Chrome/Chromium binary --gpu    use the real GPU instead of SwiftShader
import puppeteer from 'puppeteer-core';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, readdirSync, readFileSync, createReadStream } from 'node:fs';
import { dirname, resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.length ? v.join('=') : true]; }));
const fps = +(args.fps || 30), W = +(args.w || 1920), H = +(args.h || Math.round(W * 9 / 16));
const FRAMES = args.dir || 'out/frames';
const DUR = 212.3;

function findChrome() {
  if (args.chrome) return args.chrome;
  const cands = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ];
  try { for (const d of readdirSync('/opt/pw-browsers')) if (d.startsWith('chromium-')) cands.push(`/opt/pw-browsers/${d}/chrome-linux/chrome`); } catch {}
  const hit = cands.find(c => c && existsSync(c));
  if (!hit) throw new Error('Chrome not found — pass --chrome=<path>');
  return hit;
}
const FFMPEG = args.ffmpeg || process.env.FFMPEG || 'ffmpeg';
const run = (cmd, a) => new Promise((ok, bad) => { const p = spawn(cmd, a, { stdio: 'inherit' }); p.on('close', c => (c ? bad(new Error(`${cmd} exited ${c}`)) : ok())); });

if (!existsSync('dist/index.html') || args.build) execFileSync(process.execPath, ['tools/build.mjs'], { stdio: 'inherit' });

if (args.encode) {
  const out = args.out || 'out/world.execute(me).mp4';
  const n = readdirSync(FRAMES).filter(f => f.endsWith('.jpg')).length;
  console.log(`encoding ${n} frames → ${out}`);
  // Skip any silence the analyser found before the song starts (recorded while rendering frames).
  let lead = +(args.leadin || 0);
  try { lead = args.leadin ? lead : JSON.parse(readFileSync(`${FRAMES}/info.json`, 'utf8')).leadIn || 0; } catch {}
  const audio = args.audio ? ['-ss', String(lead), '-i', args.audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest'] : [];
  await run(FFMPEG, ['-y', '-loglevel', 'error', '-stats', '-framerate', String(fps), '-i', `${FRAMES}/f%05d.jpg`, ...audio,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
  console.log('wrote ' + out);
  process.exit(0);
}

// Tiny static server: the bundled page plus the user's song / lyrics.
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const file = url.pathname === '/__audio' ? args.audio : url.pathname === '/__lrc' ? args.lrc : 'dist/index.html';
  if (!file || !existsSync(file)) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Length', statSync(file).size);
  createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const page_url = `http://127.0.0.1:${port}/?render&w=${W}&h=${H}` + (args.audio ? '&audio=/__audio' : '') + (args.lrc ? '&lrc=/__lrc' : '') +
  (args.nohud ? '&nohud' : '') + (args.offset ? `&offset=${args.offset}` : '') + (args.query ? '&' + args.query : '');

const gpuFlags = args.gpu ? ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await puppeteer.launch({
  executablePath: findChrome(), headless: true, protocolTimeout: 0,
  args: [...gpuFlags, `--window-size=${W},${H}`, '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
async function openPage(tag = '') {
  const page = await browser.newPage();
  page.on('console', m => { if (['error', 'warn', 'warning'].includes(m.type())) console.log(`[page${tag}]`, m.text()); });
  page.on('pageerror', e => console.log(`[page error${tag}]`, e.message));
  await page.goto(page_url, { waitUntil: 'load' });
  await page.waitForFunction('window.ready === true', { timeout: 180000 });
  return page;
}
const grab = async (page, t, type = 'image/jpeg', q = 0.93) => {
  const url = await page.evaluate((t, type, q) => window.renderAt(t, type, q), t, type, q);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
};
const times = s => String(s).split(',').map(Number);

if (args.sheet) {
  const page = await openPage(), out = args.out || 'out/sheet.jpg', cols = +(args.cols || 3);
  mkdirSync(dirname(out), { recursive: true });
  const t0 = Date.now();
  const url = await page.evaluate((ts, cols, W, H) => {
    const c = document.createElement('canvas'), rows = Math.ceil(ts.length / cols);
    c.width = cols * W; c.height = rows * (H + 22); const g = c.getContext('2d');
    g.fillStyle = '#222'; g.fillRect(0, 0, c.width, c.height); g.font = '15px monospace'; g.fillStyle = '#fff';
    return (async () => {
      for (let i = 0; i < ts.length; i++) {
        const img = new Image(); img.src = window.renderAt(ts[i], 'image/jpeg', 0.9); await img.decode();
        const x = (i % cols) * W, y = Math.floor(i / cols) * (H + 22);
        g.drawImage(img, x, y + 22); g.fillStyle = '#fff'; g.fillText(`t=${ts[i]}`, x + 6, y + 16);
      }
      return c.toDataURL('image/jpeg', 0.88);
    })();
  }, times(args.sheet), cols, W, H);
  writeFileSync(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  console.log(`${out}  (${((Date.now() - t0) / times(args.sheet).length).toFixed(0)} ms/frame)`);
} else if (args.stills) {
  const page = await openPage(), out = args.out || 'out/stills'; mkdirSync(out, { recursive: true });
  for (const s of times(args.stills)) {
    const t0 = Date.now(), f = `${out}/t${s.toFixed(2).replace('.', '_')}.png`;
    writeFileSync(f, await grab(page, s, 'image/png'));
    console.log(`${f}  ${Date.now() - t0} ms`);
  }
} else if (args.frames) {
  const [a, b] = String(args.frames).split(':').map(Number), workers = +(args.workers || 4);
  mkdirSync(FRAMES, { recursive: true });
  const first = Math.round(a * fps), last = Math.min(Math.ceil(DUR * fps) - 1, Math.round(b * fps) - 1);
  const todo = [];
  for (let i = first; i <= last; i++) { const f = `${FRAMES}/f${String(i).padStart(5, '0')}.jpg`; if (!existsSync(f) || statSync(f).size < 1000) todo.push(i); }
  console.log(`${todo.length} frames to render (${last - first + 1 - todo.length} already done), ${workers} workers, ${W}x${H}@${fps}`);
  let next = 0, done = 0; const start = Date.now();
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const page = await openPage('#' + w);
    if (w === 0) writeFileSync(`${FRAMES}/info.json`, JSON.stringify(await page.evaluate(() => window.songInfo())));
    while (next < todo.length) {
      const i = todo[next++], f = `${FRAMES}/f${String(i).padStart(5, '0')}.jpg`;
      const buf = await grab(page, i / fps, 'image/jpeg', 0.94);
      writeFileSync(f + '.tmp', buf); renameSync(f + '.tmp', f);
      if (++done % 30 === 0 || done === todo.length) {
        const el = (Date.now() - start) / 1000;
        console.log(`frame ${done}/${todo.length}  ${(el / done * 1000).toFixed(0)} ms/frame  eta ${((todo.length - done) * el / done / 60).toFixed(1)} min`);
      }
    }
  }));
} else if (args.clip) {
  const page = await openPage();
  const [a, b] = String(args.clip).split(':').map(Number);
  const out = args.out || 'out/clip.mp4'; mkdirSync(dirname(out), { recursive: true });
  const info = await page.evaluate(() => window.songInfo());
  const audio = args.audio ? ['-ss', String(a + info.leadIn), '-t', String(b - a), '-i', args.audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest'] : [];
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', ...audio,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n = Math.round((b - a) * fps), start = Date.now();
  for (let i = 0; i < n; i++) {
    const buf = await grab(page, a + i / fps, 'image/jpeg', 0.93);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 30 === 0 || i === n - 1) console.log(`frame ${i + 1}/${n}  ${((Date.now() - start) / (i + 1)).toFixed(0)} ms/frame`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log('wrote ' + out);
}
await browser.close();
server.close();
