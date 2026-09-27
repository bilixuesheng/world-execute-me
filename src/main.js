// world.execute(me); — music video player and frame renderer.
import * as THREE from 'three';
import { loadFonts, glyphAtlas } from './engine/text.js';
import { Post, POST_DEFAULTS } from './engine/post.js';
import { AudioAnalysis } from './engine/audio.js';
import { CHAPTERS, SONG, SYNC, chapterAt } from './timeline.js';
import { Hud } from './hud.js';
import { Lyrics } from './lyrics.js';
import { SCENES } from './scenes/index.js';
import { clamp, ease } from './engine/util.js';

const qs = new URLSearchParams(location.search);
const RENDER = qs.has('render');
const $ = s => document.querySelector(s);

const canvas = $('#gl'), hudCanvas = $('#hud');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: RENDER, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.autoClear = true;

const analysis = new AudioAnalysis();
const lyrics = new Lyrics();
const hud = new Hud(hudCanvas);
let post, scenes = {}, W = 1920, H = 1080;

function applySize(w, h) {
  W = w; H = h;
  renderer.setSize(w, h, false);
  post.setSize(w, h);
  hud.resize(w, h);
  for (const s of Object.values(scenes)) {
    s.scene.traverse(o => {
      const m = o.material; if (!m) return;
      if (m.uniforms?.uPx) m.uniforms.uPx.value = h;
      if (m.isLineMaterial) m.resolution.set(w, h);
    });
  }
}

function fitWindow() {
  const ww = window.innerWidth, wh = window.innerHeight;
  let cw = ww, ch = ww * 9 / 16;
  if (ch > wh) { ch = wh; cw = wh * 16 / 9; }
  for (const c of [canvas, hudCanvas]) { c.style.width = cw + 'px'; c.style.height = ch + 'px'; }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pw = Math.min(Math.round(cw * dpr), +(qs.get('maxw') || 1920));
  applySize(pw, Math.round(pw * 9 / 16));
}

// ---------------------------------------------------------------------------
// One frame at song time t.

const NUM_KEYS = Object.keys(POST_DEFAULTS).filter(k => typeof POST_DEFAULTS[k] === 'number');

function transitionState(t) {
  const ch = chapterAt(t), next = CHAPTERS[ch.index + 1];
  const st = { a: ch, b: null, mix: 0, type: 0, flash: 0 };
  for (const c of [ch, next]) {
    if (!c?.tin) continue;
    const { type, dur } = c.tin, d = t - c.start;
    if (type === 'dissolve' || type === 'glitch') {
      if (d > -dur / 2 && d < dur / 2) { st.a = CHAPTERS[c.index - 1]; st.b = c; st.mix = (d + dur / 2) / dur; st.type = type === 'glitch' ? 1 : 0; }
    } else if (type === 'flash') {
      if (d >= 0 && d < dur * 2) st.flash = Math.max(st.flash, 0.9 * Math.exp(-d / dur * 3.5));
      if (d < 0 && d > -0.08) st.flash = Math.max(st.flash, (d + 0.08) / 0.08 * 0.4);
    } else if (type === 'white') {
      const pre = dur * 0.3;
      if (d > -pre && d < 0) st.flash = Math.max(st.flash, ease.in2((d + pre) / pre));
      if (d >= 0 && d < dur) st.flash = Math.max(st.flash, 1 - ease.out2(d / dur));
    }
  }
  return st;
}

function renderFrame(t) {
  const a = analysis.at(t);
  const st = transitionState(t);
  const ch = chapterAt(t);
  const sa = scenes[st.a.id];
  const pa = { ...POST_DEFAULTS, ...(sa.update(t, st.a, a) || {}) };
  let p = pa;
  if (st.b) {
    const pb = { ...POST_DEFAULTS, ...(scenes[st.b.id].update(t, st.b, a) || {}) };
    p = { ...pa };
    for (const k of NUM_KEYS) p[k] = pa[k] + (pb[k] - pa[k]) * st.mix;
    p.tint = pa.tint.map((v, i) => v + (pb.tint[i] - v) * st.mix);
  }
  p.flash = Math.max(p.flash, st.flash);
  if (st.b && st.type === 1) p.glitch = Math.max(p.glitch, Math.sin(st.mix * Math.PI) * 0.6);
  if (!p.glitchSeed) p.glitchSeed = Math.floor(t * 24) % 97;
  if (qs.has('bloom')) p.bloom *= +qs.get('bloom');
  if (qs.has('exposure')) p.exposure *= +qs.get('exposure');
  post.render(t, sa, st.b ? scenes[st.b.id] : null, st.b ? st.mix : 0, st.type, p);
  hud.draw(t, ch, a, lyrics.loaded ? lyrics.at(t) : null);
}

// ---------------------------------------------------------------------------
// Boot

async function init() {
  await loadFonts();
  const atlas = glyphAtlas();
  const ctx = { renderer, atlas };
  post = new Post(renderer, W, H);
  for (const ch of CHAPTERS) {
    if (!scenes[ch.id]) scenes[ch.id] = SCENES[ch.id](ctx);
  }
  if (RENDER) applySize(+(qs.get('w') || 1920), +(qs.get('h') || 1080));
  else { fitWindow(); window.addEventListener('resize', fitWindow); }
  for (const s of Object.values(scenes)) renderer.compile(s.scene, s.camera);
}

// Headless rendering API (used by tools/render.mjs).
async function initRender() {
  const au = qs.get('audio'), lrc = qs.get('lrc');
  if (au) { try { await analysis.analyse(await (await fetch(au)).arrayBuffer()); } catch (e) { console.warn('audio analysis failed: ' + e.message); } }
  if (lrc) { try { lyrics.parse(await (await fetch(lrc)).text()); } catch (e) { console.warn('lrc failed: ' + e.message); } }
  else if (window.__LRC) lyrics.parse(window.__LRC);
  if (qs.has('nohud')) hud.showHud = false;
  if (qs.has('offset')) SYNC.offset = +qs.get('offset');
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const og = out.getContext('2d');
  window.renderAt = (t, type = 'image/jpeg', q = 0.92) => {
    renderFrame(t + SYNC.offset);
    og.drawImage(canvas, 0, 0); og.drawImage(hudCanvas, 0, 0);
    return out.toDataURL(type, q);
  };
  window.songInfo = () => ({ leadIn: analysis.leadIn, duration: SONG.duration, phaseShift: analysis.phaseShift ?? 0, anchor: SYNC.anchor });
  window.ready = true;
}

// ---------------------------------------------------------------------------
// Interactive player

function initPlayer() {
  const audio = new Audio();
  let demoStart = null, demoAt = 0, playing = false, started = false, lastUrl = null;
  const POSTER_T = qs.has('t') ? +qs.get('t') : 164.6; // frame shown behind the start card
  const clock = () => {
    if (analysis.loaded) return audio.currentTime - analysis.leadIn + SYNC.offset;
    return playing ? demoAt + (performance.now() - demoStart) / 1000 : demoAt;
  };
  const seek = t => {
    t = clamp(t, 0, SONG.duration);
    if (analysis.loaded) audio.currentTime = t + analysis.leadIn - SYNC.offset;
    else { demoAt = t; demoStart = performance.now(); }
  };
  const play = () => { playing = started = true; if (analysis.loaded) audio.play(); else demoStart = performance.now(); $('#start').classList.add('hidden'); };
  const pause = () => { if (analysis.loaded) audio.pause(); else demoAt = clock(); playing = false; };
  const toggle = () => (playing ? pause() : play());

  const status = s => { $('#status').textContent = s; };
  async function loadAudio(file) {
    status('decoding + analysing ' + file.name + ' …');
    const wasPlaying = playing, at = started ? clock() : 0;
    pause();
    const buf = await file.arrayBuffer();
    await analysis.analyse(buf.slice(0));
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    audio.src = lastUrl = URL.createObjectURL(file);
    const dur = analysis.duration.toFixed(1);
    const warn = Math.abs(analysis.duration - analysis.leadIn - SONG.duration) > 3 ? `  ⚠ expected ~${SONG.duration}s — a different cut? use [ ] to nudge sync` : '';
    status(`✓ ${file.name} (${dur}s, lead-in ${analysis.leadIn.toFixed(2)}s, beat phase ${(analysis.phaseShift * 1000).toFixed(0)} ms)${warn}`);
    $('#play').disabled = false; $('#play').textContent = '▶ PLAY';
    // dropped in while the demo was running: carry on from the same moment, now with sound
    if (wasPlaying) { seek(at); play(); }
  }
  async function loadLrc(file) {
    lyrics.parse(await file.text());
    $('#lrcstatus').textContent = lyrics.loaded ? `✓ ${lyrics.lines.length} lyric lines` : `✗ ${file.name}: no [mm:ss] timestamps found — is this an .lrc file?`;
  }
  // Decide by content, not by file name: phones often rename downloads or drop the .lrc extension.
  const looksLikeLrc = async f => f.size < 2e6 && /\[\d{1,3}:\d{1,2}(?:[.:]\d+)?\]/.test(await f.slice(0, 8192).text());
  const handleFiles = async (files, want) => {
    for (const f of files) {
      const lrc = await looksLikeLrc(f);
      if (lrc) await loadLrc(f);
      else if (want === 'lrc') $('#lrcstatus').textContent = `✗ ${f.name}: no [mm:ss] timestamps found — is this an .lrc file?`;
      else await loadAudio(f).catch(e => status(`✗ could not decode ${f.name} as audio (${e.message}). Use an mp3 / m4a / flac / wav file.`));
    }
  };

  $('#audiofile').addEventListener('change', e => handleFiles(e.target.files, 'audio'));
  $('#lrcfile').addEventListener('change', e => handleFiles(e.target.files, 'lrc'));
  $('#play').addEventListener('click', () => { seek(+(qs.get('t') || 0)); play(); });
  $('#demo').addEventListener('click', () => { seek(+(qs.get('t') || 0)); play(); });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => { e.preventDefault(); handleFiles(e.dataTransfer.files, 'any'); });
  audio.addEventListener('ended', () => { playing = false; });

  // scrubber with chapter ticks
  const bar = $('#bar'), fill = $('#fill');
  for (const c of CHAPTERS) {
    const tick = document.createElement('div'); tick.className = 'tick'; tick.style.left = (c.start / SONG.duration * 100) + '%'; tick.title = c.label; bar.appendChild(tick);
  }
  bar.addEventListener('click', e => { const r = bar.getBoundingClientRect(); seek((e.clientX - r.left) / r.width * SONG.duration); });
  let idle = 0;
  window.addEventListener('mousemove', () => { idle = performance.now(); document.body.classList.remove('idle'); });

  window.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    else if (e.code === 'ArrowRight') seek(clock() + 5);
    else if (e.code === 'ArrowLeft') seek(clock() - 5);
    else if (e.key === ']') { SYNC.offset += 0.05; status(`sync offset ${SYNC.offset.toFixed(2)} s`); }
    else if (e.key === '[') { SYNC.offset -= 0.05; status(`sync offset ${SYNC.offset.toFixed(2)} s`); }
    else if (e.key === 'h') hud.showHud = !hud.showHud;
    else if (e.key === 'l') hud.showLyrics = !hud.showLyrics;
    else if (e.key === 'f') (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {});
    else if (/^[0-9]$/.test(e.key)) seek(CHAPTERS[Math.min(CHAPTERS.length - 1, +e.key + (e.shiftKey ? 10 : 0))].start - 0.5);
  });

  const loop = () => {
    const t = started ? clock() : POSTER_T;
    renderFrame(Math.min(t, SONG.duration));
    fill.style.width = (clamp(t / SONG.duration) * 100) + '%';
    if (performance.now() - idle > 2500 && playing) document.body.classList.add('idle');
    requestAnimationFrame(loop);
  };
  seek(+(qs.get('t') || 0));
  requestAnimationFrame(loop);
  $('#loading').classList.add('hidden');
  $('#start').classList.remove('hidden');
  // A personal build (tools/build.mjs --lrc=…) carries its lyrics inside the page.
  if (window.__LRC && !lyrics.loaded) {
    lyrics.parse(window.__LRC);
    $('#lrcstatus').textContent = `✓ lyrics built in (${lyrics.lines.length} lines)`;
    const btn = $('#lrcfile')?.parentElement; if (btn?.firstChild) btn.firstChild.textContent = '≡ replace lyrics';
  }
  if (qs.has('autoplay')) play();
}

init().then(() => (RENDER ? initRender() : initPlayer())).catch(e => { console.error(e); const l = $('#loading'); if (l) l.textContent = 'error: ' + e.message; });
