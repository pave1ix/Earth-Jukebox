/* global Tone */
// Wires the page together: track buttons, play/pause, keyboard, meters, tuning panel.
import { TRACKS, TUNE_SPEC } from './tracks.js';
import { Analyzer } from './analyzer.js';
import { SoundEngine } from './sound.js';

const $ = (id) => document.getElementById(id);
const video = $('video');
const playBtn = $('play');
const volume = $('volume');
const playhead = $('playhead');
const statusEl = $('status');

const analyzer = new Analyzer($('sees'));
const sound = new SoundEngine();

let current = 0;
let playing = false;
let busy = false;
let loopId = null;
let last = 0;
let tickCount = 0;
let meterRefs = {};

// ---------- setup ----------
function buildTrackButtons() {
  const wrap = $('tracks');
  TRACKS.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'track';
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="track-title">${t.title}</span><span class="track-line">${t.line}</span>`;
    b.addEventListener('click', () => selectTrack(i));
    wrap.appendChild(b);
  });
}

function loadTrack(i) {
  current = (i + TRACKS.length) % TRACKS.length;
  const t = TRACKS[current];
  video.src = t.file;
  video.load();
  analyzer.reset();
  $('now-title').textContent = t.title;
  $('now-desc').textContent = t.description;
  $('now-credit').textContent = t.credit;
  const src = $('now-source');
  src.href = t.source;
  src.textContent = t.source.replace('https://', '');
  document.querySelectorAll('.track').forEach((b, j) => b.setAttribute('aria-pressed', String(j === current)));

  $('legend').innerHTML = t.legend.map((x) => `<li>${x}</li>`).join('');
  const meters = $('meters');
  meters.innerHTML = '';
  meterRefs = {};
  for (const m of t.meters) {
    const row = document.createElement('div');
    row.className = 'meter';
    row.innerHTML = `<span class="meter-label">${m.label}</span>
      <div class="meter-bar" role="meter" aria-label="${m.label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>`;
    meters.appendChild(row);
    meterRefs[m.key] = row.querySelector('.meter-bar');
  }
  playhead.hidden = true;
  buildTuning();
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
async function togglePlay() {
  if (busy) return;
  busy = true;
  try {
    if (!playing) {
      if (!sound.ready) {
        setStatus('Starting sound…');
        await Tone.start();
        await sound.init();
      }
      await video.play();
      sound.setVolume(Number(volume.value));
      sound.setTrack(TRACKS[current]);
      sound.fadeIn(1.2);
      playing = true;
      startLoop();
      setStatus('');
      announce(`Playing ${TRACKS[current].title}`);
    } else {
      playing = false;
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
    playBtn.textContent = playing ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-pressed', String(playing));
  }
}

async function selectTrack(i) {
  if (busy) return;
  busy = true;
  try {
    if (playing) {
      await sound.fadeOut(0.35);
      sound.stopAll();
    }
    loadTrack(i);
    if (playing) {
      await video.play();
      sound.setTrack(TRACKS[current]);
      sound.fadeIn(1.2);
    }
    announce(`${playing ? 'Playing' : 'Selected'} ${TRACKS[current].title}`);
  } catch (e) {
    console.error(e);
    setStatus(`Could not switch track: ${e.message}`);
  } finally {
    busy = false;
  }
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
  if (!playing || busy || document.hidden || video.paused || video.readyState < 2) return;
  const f = analyzer.sample(video, TRACKS[current]);
  if (!f) return;
  const out = sound.update(f, dt);
  renderMeters(out.meters);
  renderPlayhead(out.playhead);
}

function renderMeters(values) {
  tickCount++;
  for (const [key, el] of Object.entries(meterRefs)) {
    const v = Math.round(Math.max(0, Math.min(1, values[key] ?? 0)) * 100);
    el.firstElementChild.style.width = `${v}%`;
    if (tickCount % 12 === 0) el.setAttribute('aria-valuenow', String(v));
  }
}

function renderPlayhead(p) {
  if (!p) { playhead.hidden = true; return; }
  const crop = TRACKS[current].crop;
  playhead.hidden = false;
  playhead.className = `playhead axis-${p.axis}`;
  if (p.axis === 'x') {
    playhead.style.left = `${(crop.x + p.pos * crop.w) * 100}%`;
    playhead.style.top = '';
  } else {
    playhead.style.top = `${(crop.y + p.pos * crop.h) * 100}%`;
    playhead.style.left = '';
  }
}

// ---------- helpers ----------
function announce(msg) { $('live').textContent = msg; }
function setStatus(msg) { statusEl.textContent = msg; }

function changeVolume(delta) {
  volume.value = String(Math.max(0, Math.min(100, Number(volume.value) + delta)));
  volume.dispatchEvent(new Event('input'));
}

// ---------- events ----------
playBtn.addEventListener('click', togglePlay);

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
  if (inField) return;
  if (e.key === ' ' && !onControl) { e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); selectTrack(current + 1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); selectTrack(current - 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); changeVolume(5); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); changeVolume(-5); }
});

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

buildTrackButtons();
loadTrack(0);
