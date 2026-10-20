// Pípnutí, vibrace a držení rozsvíceného displeje během tréninku.
import { getState } from './store.js';

let audio = null;

// Zvuk smí začít jen po dotyku uživatele — volat z obsluhy kliknutí (Začít / Pokračovat).
export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
  } catch {
    audio = null;
  }
}

function tone(freq, ms, at = 0) {
  if (!audio) return;
  const t = audio.currentTime + at;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

function vibrate(pattern) {
  if (getState().settings.vibration) navigator.vibrate?.(pattern);
}

function sound(fn) {
  if (getState().settings.sound) fn();
}

// 5 s před koncem pauzy
export function signalSoon() {
  sound(() => tone(660, 120));
  vibrate(80);
}

// konec pauzy — teď se cvičí
export function signalGo() {
  sound(() => {
    tone(880, 160);
    tone(880, 160, 0.22);
    tone(1175, 320, 0.44);
  });
  vibrate([200, 100, 200]);
}

// konec přechodu mezi cviky
export function signalNext() {
  sound(() => tone(988, 200));
  vibrate(120);
}

let lock = null;
let wanted = false;

async function acquire() {
  try {
    lock = await navigator.wakeLock?.request('screen');
  } catch {
    lock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (wanted && document.visibilityState === 'visible') acquire();
});

export function keepScreenOn(on) {
  wanted = on;
  if (on) acquire();
  else {
    lock?.release();
    lock = null;
  }
}
