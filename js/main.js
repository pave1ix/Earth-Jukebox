/* global Tone */
// Wires the page together: tracks, play/pause, explore mode, keyboard, meters, dot Earth, tuning.
import { TRACKS, TUNE_SPEC } from './tracks.js';
import { Analyzer, GX, GY } from './analyzer.js';
import { SoundEngine } from './sound.js';
import { describeCell } from './explore.js';
import { DotEarth } from './dotearth.js';
import { describeMoment } from './describe.js';

const $ = (id) => document.getElementById(id);
const video = $('video');
const stage = $('stage');
const playBtn = $('play');
const exploreBtn = $('explore');
const freezeBtn = $('freeze');
const volume = $('volume');
const playhead = $('playhead');
const cursor = $('cursor');
const statusEl = $('status');
const readout = $('readout');
const describeBtn = $('describe');
const keyBtn = $('hearkey');
const speakBtn = $('speak');
const TUNING = new URLSearchParams(location.search).has('tune');

const analyzer = new Analyzer(document.createElement('canvas'));
const sound = new SoundEngine();
const dots = new DotEarth($('dots'), video);

let current = 0;
let playing = false;
let exploring = false;
let busy = false;
let loopId = null;
let last = 0;
let tickCount = 0;
let meterRefs = {};
let lastFrame = null;
let cell = { r: 7, c: 7 };
let announceTimer = null;
let speakOn = false;    // read descriptions aloud with the browser's own voice
let keyToken = 0;       // cancels a running listening key
let keyRunning = false;
const keyHeard = new Set(); // tracks whose key has been played once
let userPaused = false; // true after the listener presses Pause
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Every note lights up the dot Earth at the place on the map it came from.
sound.onNote = (loc, vel) => dots.ping(loc.u, loc.v, 0.45 + vel * 0.5);

// ---------- setup ----------
function buildTrackButtons() {
  const wrap = $('tracks');
  TRACKS.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'track';
    b.type = 'button';
    b.setAttribute('aria-current', 'false');
    b.innerHTML = `<span class="track-code" aria-hidden="true">${t.code}</span>
      <span class="track-title">${t.title}</span>
      <span class="track-line">${t.line}</span>`;
    b.addEventListener('click', () => selectTrack(i));
    wrap.appendChild(b);
  });
}

function loadTrack(i) {
  current = (i + TRACKS.length) % TRACKS.length;
  const t = TRACKS[current];
  const v = t.view;

  // Show only the track's view of the NASA frame.
  stage.style.aspectRatio = String(t.aspect);
  stage.style.backgroundImage = `url("${t.poster}")`;
  video.style.width = `${100 / v.w}%`;
  video.style.height = `${100 / v.h}%`;
  video.style.left = `${(-v.x / v.w) * 100}%`;
  video.style.top = `${(-v.y / v.h) * 100}%`;
  video.loop = !t.segment;
  video.src = t.file;
  video.load();
  startPreview();

  analyzer.reset();
  lastFrame = null;
  dots.setTrack(t);
  document.body.dataset.track = t.id;
  document.documentElement.style.setProperty('--accent', t.accent);

  $('now-title').textContent = t.title;
  $('now-desc').textContent = t.description;
  $('now-credit').textContent = t.credit;
  const src = $('now-source');
  src.href = t.source;
  src.textContent = t.source.replace('https://', '');
  document.querySelectorAll('.track').forEach((b, j) => b.setAttribute('aria-current', String(j === current)));

  $('key').innerHTML = t.key.map((k) => {
    const sw = k.swatch === 'line' ? '<span class="swatch swatch-line"></span>'
      : k.swatch ? `<span class="swatch" style="background:${k.swatch}"></span>`
        : '<span class="swatch swatch-none"></span>';
    return `<div class="key-row"><dt>${sw}${k.what}</dt><dd>${k.hear}</dd></div>`;
  }).join('');

  const meters = $('meters');
  meters.innerHTML = '';
  meterRefs = {};
  for (const m of t.meters) {
    const row = document.createElement('div');
    row.className = 'meter';
    row.innerHTML = `<span class="meter-label">${m.label}</span>
      <div class="meter-bar" role="meter" aria-label="${m.label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
      <span class="meter-val" aria-hidden="true">–</span>`;
    meters.appendChild(row);
    meterRefs[m.key] = { bar: row.querySelector('.meter-bar'), val: row.querySelector('.meter-val'), fmt: m.fmt };
  }
  $('method').innerHTML = (t.method || []).map((x) => `<li>${x}</li>`).join('');
  playhead.hidden = true;
  if (TUNING) buildTuning();
}

// Start each clip at the right moment and speed.
video.addEventListener('loadedmetadata', () => {
  const t = TRACKS[current];
  video.playbackRate = t.rate || 1;
  if (t.segment) video.currentTime = t.segment[0];
});
video.addEventListener('loadeddata', () => { dots.dirty = true; });
video.addEventListener('play', () => dots.setLive(true));
video.addEventListener('pause', () => dots.setLive(false));
video.addEventListener('timeupdate', () => keepInSegment());

// Silent preview: the muted NASA clip runs before any sound starts, so the page shows the planet moving.
function startPreview() {
  if (REDUCED || userPaused) return;
  const p = video.play();
  if (p && p.catch) p.catch(() => {});
}
video.addEventListener('seeked', () => { dots.dirty = true; });

function keepInSegment() {
  const seg = TRACKS[current].segment;
  if (!seg) return;
  if (video.currentTime >= seg[1] || video.currentTime < seg[0] - 0.5) video.currentTime = seg[0];
}

function buildTuning() {
  const t = TRACKS[current];
  const box = $('tuning');
  box.innerHTML = `<p class="tune-note">Tuning for: <strong>${t.title}</strong></p>`;
  for (const key of t.tuneKeys) {
    const spec = TUNE_SPEC[key];
    const id = `tune-${key}`;
    const row = document.createElement('div');
    row.className = 'tune-row';
    row.innerHTML = `<label for="${id}">${spec.label}</label>
      <input id="${id}" type="range" min="${spec.min}" max="${spec.max}" step="${spec.step}" value="${t.tune[key]}">
      <output for="${id}">${t.tune[key]}</output>`;
    const input = row.querySelector('input');
    const out = row.querySelector('output');
    input.addEventListener('input', () => {
      t.tune[key] = Number(input.value);
      out.textContent = input.value;
      sound.applyTune(t.tune);
    });
    box.appendChild(row);
  }
}

// ---------- playback ----------
async function startPlayback() {
  if (!sound.ready) {
    setStatus('Starting sound…');
    await Tone.start();
    await sound.init();
  }
  await video.play();
  video.playbackRate = TRACKS[current].rate || 1;
  sound.setVolume(Number(volume.value));
  sound.setTrack(TRACKS[current]);
  sound.fadeIn(1.2);
  playing = true;
  userPaused = false;
  startLoop();
  setStatus('');
}

async function togglePlay() {
  if (busy) return;
  busy = true;
  let started = false;
  try {
    if (!playing) {
      await startPlayback();
      started = true;
      announce(`Playing ${TRACKS[current].title}.`);
    } else {
      if (exploring) setExplore(false);
      playing = false;
      userPaused = true;
      video.pause();
      stopLoop();
      await sound.fadeOut(0.4);
      sound.stopAll();
      announce('Paused');
    }
  } catch (e) {
    console.error(e);
    setStatus(`Could not start: ${e.message}`);
  } finally {
    busy = false;
    updateButtons();
  }
  if (started && !keyHeard.has(TRACKS[current].id)) playKey(true);
}

async function selectTrack(i) {
  if (busy) return;
  busy = true;
  try {
    if (playing) {
      await sound.fadeOut(0.35);
      sound.stopAll();
    }
    if (keyRunning) { keyToken++; keyRunning = false; if (!exploring) sound.setExplore(false); }
    loadTrack(i);
    if (exploring) placeCursor();
    else readout.hidden = true;
    if (playing) {
      await video.play();
      video.playbackRate = TRACKS[current].rate || 1;
      sound.setTrack(TRACKS[current]);
      sound.fadeIn(1.2);
    }
    announce(`${playing ? 'Playing' : 'Selected'} ${TRACKS[current].title}. ${TRACKS[current].description}`);
  } catch (e) {
    console.error(e);
    setStatus(`Could not switch track: ${e.message}`);
  } finally {
    busy = false;
    updateButtons();
  }
  // The first time a track plays, explain its sounds before the music.
  if (playing && !exploring && !keyHeard.has(TRACKS[current].id)) {
    setTimeout(() => { if (playing && !keyRunning && !keyHeard.has(TRACKS[current].id)) playKey(true); }, 2500);
  }
}

// ---------- explore mode ----------
async function toggleExplore() {
  if (busy) return;
  if (!playing) {
    busy = true;
    try { await startPlayback(); } catch (e) { setStatus(`Could not start: ${e.message}`); busy = false; return; }
    busy = false;
  }
  setExplore(!exploring);
}

function setExplore(on) {
  exploring = on;
  sound.setExplore(on);
  document.body.classList.toggle('is-exploring', on);
  stage.setAttribute('tabindex', on ? '0' : '-1');
  // role application lets screen readers pass the arrow keys through to the map
  stage.setAttribute('role', on ? 'application' : 'group');
  stage.setAttribute('aria-label', on ? 'Map explorer. Arrow keys move one square. Enter repeats. Escape leaves.' : 'NASA visualization');
  cursor.hidden = !on;
  readout.hidden = !on;
  if (on) {
    playhead.hidden = true;
    readout.textContent = 'Move over the map to hear each place.';
    placeCursor();
    stage.focus({ preventScroll: true });
    announce('Explore mode on. Move the mouse or a finger over the map, or use the arrow keys. Press Escape to leave.');
  } else {
    if (video.paused && playing) video.play();
    announce('Explore mode off. Music resumed.');
  }
  updateButtons();
}

function placeCursor() {
  cursor.style.left = `${(cell.c / GX) * 100}%`;
  cursor.style.top = `${(cell.r / GY) * 100}%`;
  cursor.style.width = `${100 / GX}%`;
  cursor.style.height = `${100 / GY}%`;
}

function exploreAt(r, c, fromKeys) {
  r = Math.max(0, Math.min(GY - 1, r));
  c = Math.max(0, Math.min(GX - 1, c));
  const changed = r !== cell.r || c !== cell.c;
  cell = { r, c };
  placeCursor();
  if (!lastFrame || (!changed && !fromKeys)) return;
  const d = describeCell(TRACKS[current].id, lastFrame, r, c);
  sound.playExplore(d.sound, ((c / (GX - 1)) * 2 - 1) * 0.8, { u: (c + 0.5) / GX, v: (r + 0.5) / GY });
  readout.textContent = d.text;
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => { announce(d.text); speak(d.text); }, fromKeys ? 0 : 350); // pointer: speak after a short rest
}

stage.addEventListener('pointermove', (e) => {
  if (!exploring) return;
  const rect = stage.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  if (x < 0 || x >= 1 || y < 0 || y >= 1) return;
  exploreAt(Math.floor(y * GY), Math.floor(x * GX), false);
});

stage.addEventListener('keydown', (e) => {
  if (!exploring) return;
  const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (moves[e.key]) {
    e.preventDefault();
    e.stopPropagation();
    exploreAt(cell.r + moves[e.key][0], cell.c + moves[e.key][1], true);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    exploreAt(cell.r, cell.c, true);
  } else if (e.key === 'Escape') {
    e.stopPropagation();
    setExplore(false);
    exploreBtn.focus();
  }
});

function toggleFreeze() {
  if (!exploring) return;
  if (video.paused) { video.play(); announce('Video resumed'); } else { video.pause(); announce('Frame frozen'); }
  updateButtons();
}

// ---------- describe, listening key, read aloud ----------
function speak(text) {
  if (!speakOn || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05;
  window.speechSynthesis.speak(u);
}

function say(text) {
  readout.hidden = false;
  readout.textContent = text;
  announce(text);
  speak(text);
}

// Describe what is on screen right now, from the numbers read off the current frame.
function describeNow() {
  const f = video.readyState >= 2 ? analyzer.sample(video, TRACKS[current]) : lastFrame;
  if (f) lastFrame = f;
  say(describeMoment(TRACKS[current].id, lastFrame));
}

// Play each sound of the current track's key with a sentence that explains it.
// intro = played automatically before the music the first time a track is heard.
async function playKey(intro = false) {
  if (keyRunning) { stopKey(); return; }
  if (busy) return;
  const token = ++keyToken;
  if (!playing) {
    busy = true;
    try { await startPlayback(); } catch (e) { setStatus(`Could not start: ${e.message}`); busy = false; return; }
    busy = false;
  }
  const t = TRACKS[current];
  keyHeard.add(t.id);
  keyRunning = true;
  updateButtons();
  if (!exploring) sound.setExplore(true);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  if (intro) {
    say(`Before the music, here is what each sound means in ${t.title}. Press Escape to skip.`);
    await wait(4200);
  }
  for (const step of t.keySteps || []) {
    if (token !== keyToken) break;
    say(step.text);
    await wait(intro ? 2600 : 450);
    if (token !== keyToken) break;
    sound.playExplore(step.sound, 0, null);
    await wait(2600);
  }
  if (token === keyToken) {
    keyRunning = false;
    updateButtons();
    if (!exploring) {
      sound.setExplore(false);
      say(intro ? 'Now the music. Press Describe this moment at any time for a summary in words.' : 'That is the key. The music continues.');
    }
  }
}

function stopKey() {
  keyToken++;
  keyRunning = false;
  updateButtons();
  if (!exploring && playing) sound.setExplore(false);
  say('Key skipped. The music continues.');
}

function toggleSpeak() {
  speakOn = !speakOn;
  if (!speakOn && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  speakBtn.textContent = speakOn ? 'Read aloud: on' : 'Read aloud: off';
  announce(speakOn ? 'Descriptions will be read aloud.' : 'Read aloud off.');
}

// ---------- analysis loop ----------
function startLoop() {
  stopLoop();
  last = performance.now();
  loopId = setInterval(tick, 80);
}

function stopLoop() {
  if (loopId) clearInterval(loopId);
  loopId = null;
}

function tick() {
  const now = performance.now();
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (!playing || busy || document.hidden || video.readyState < 2) return;
  if (video.paused && !exploring) return;
  keepInSegment();
  const f = analyzer.sample(video, TRACKS[current]);
  if (!f) return;
  lastFrame = f;
  if (exploring) return;
  const out = sound.update(f, dt);
  renderMeters(out.meters);
  renderPlayhead(out.playhead);
}

function renderMeters(values) {
  tickCount++;
  for (const [key, ref] of Object.entries(meterRefs)) {
    const raw = Math.max(0, Math.min(1, values[key] ?? 0));
    const v = Math.round(raw * 100);
    ref.bar.firstElementChild.style.width = `${v}%`;
    if (tickCount % 4 === 0 && ref.fmt) ref.val.textContent = ref.fmt(raw);
    if (tickCount % 12 === 0) {
      ref.bar.setAttribute('aria-valuenow', String(v));
      if (ref.fmt) ref.bar.setAttribute('aria-valuetext', ref.fmt(raw));
    }
  }
}

function renderPlayhead(p) {
  if (!p) { playhead.hidden = true; return; }
  playhead.hidden = false;
  playhead.className = `playhead axis-${p.axis}`;
  if (p.axis === 'x') {
    playhead.style.left = `${p.pos * 100}%`;
    playhead.style.top = '';
  } else {
    playhead.style.top = `${p.pos * 100}%`;
    playhead.style.left = '';
  }
}

// ---------- helpers ----------
function announce(msg) { $('live').textContent = msg; }
function setStatus(msg) { statusEl.textContent = msg; }

function updateButtons() {
  playBtn.textContent = playing ? 'Pause' : 'Listen';
  playBtn.setAttribute('aria-pressed', String(playing));
  exploreBtn.textContent = exploring ? 'Back to listening' : 'Explore by touch';
  exploreBtn.setAttribute('aria-pressed', String(exploring));
  freezeBtn.hidden = !exploring;
  keyBtn.textContent = keyRunning ? 'Stop the key' : 'Hear the key';
  keyBtn.setAttribute('aria-pressed', String(keyRunning));
  freezeBtn.textContent = video.paused ? 'Resume video' : 'Freeze frame';
}

function changeVolume(delta) {
  volume.value = String(Math.max(0, Math.min(100, Number(volume.value) + delta)));
  volume.dispatchEvent(new Event('input'));
}

// ---------- events ----------
playBtn.addEventListener('click', togglePlay);
exploreBtn.addEventListener('click', toggleExplore);
freezeBtn.addEventListener('click', toggleFreeze);
describeBtn.addEventListener('click', describeNow);
keyBtn.addEventListener('click', () => playKey(false));
speakBtn.addEventListener('click', toggleSpeak);
if (!('speechSynthesis' in window)) speakBtn.hidden = true;

volume.addEventListener('input', () => {
  sound.setVolume(Number(volume.value));
  $('volume-out').textContent = `${volume.value}%`;
});

video.addEventListener('error', () => {
  setStatus(`The video for ${TRACKS[current].title} could not load. Check that ${TRACKS[current].file} exists.`);
});

document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  const onControl = tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY';
  if (inField || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape' && keyRunning) { stopKey(); return; }
  if (e.key === ' ' && !onControl) { e.preventDefault(); togglePlay(); }
  else if (e.key >= '1' && e.key <= String(TRACKS.length)) { selectTrack(Number(e.key) - 1); }
  else if (e.key === 'e' || e.key === 'E') { toggleExplore(); }
  else if (e.key === 'd' || e.key === 'D') { describeNow(); }
  else if (e.key === 'k' || e.key === 'K') { playKey(false); }
  else if (e.key === 'r' || e.key === 'R') { toggleSpeak(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); selectTrack(current + 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); selectTrack(current - 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); changeVolume(5); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); changeVolume(-5); }
});

if (TUNING) {
  $('tuning-box').hidden = false;
  $('copyTune').addEventListener('click', async () => {
    const json = JSON.stringify(Object.fromEntries(TRACKS.map((t) => [t.id, t.tune])), null, 2);
    const out = $('tuneOut');
    out.value = json;
    out.hidden = false;
    try {
      await navigator.clipboard.writeText(json);
      $('copyTune').textContent = 'Copied';
    } catch {
      out.select();
    }
    setTimeout(() => { $('copyTune').textContent = 'Copy settings'; }, 1500);
  });
}

buildTrackButtons();
loadTrack(0);
updateButtons();
