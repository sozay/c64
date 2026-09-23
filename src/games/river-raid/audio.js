// Browser-only WebAudio sound layer for River Raid (T-201).
//
// Imported by the browser entry point (src/game-dev.js) only. The headless
// simulation driver never imports this module, which enforces the
// "render-layer only" rule structurally: there is no code path from
// scripts/simulate.js that could instantiate an AudioContext.
//
// Autoplay guard: no AudioContext is created until a user gesture (key press or
// pointer press) unlocks the layer, and a layer that is currently muted never
// creates one. Nothing here is synthesized from audio asset files: every sound
// is generated with oscillators, gain envelopes and noise buffers.

import { CRUISE_SPEED, MAX_SPEED } from './constants.js';
import { SOUND_EVENT } from './sound-events.js';

export const MUTE_STORAGE_KEY = 'river-raid.audio.muted';

const MASTER_GAIN = 0.5;
const ENGINE_GAIN = 0.09;
const ENGINE_MIN_HZ = 55;
const ENGINE_MAX_HZ = 165;

function safeStorage(target) {
  try {
    return target?.localStorage ?? null;
  } catch {
    return null;
  }
}

function readMuted(storage) {
  try {
    return storage?.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function createAudio(options = {}) {
  const win = options.window ?? globalThis;
  const storage = options.storage ?? safeStorage(win);

  let muted = options.muted ?? readMuted(storage);
  let context = null;
  let master = null;
  let engineOscillator = null;
  let engineGain = null;
  let engineSpeed = CRUISE_SPEED;

  function AudioContextClass() {
    return win?.AudioContext ?? win?.webkitAudioContext ?? null;
  }

  function currentTime() {
    return context ? context.currentTime : 0;
  }

  function acquireContext() {
    if (context) return context;
    const AudioContextCtor = AudioContextClass();
    if (!AudioContextCtor) return null;
    context = new AudioContextCtor();
    master = context.createGain();
    master.gain.value = muted ? 0 : MASTER_GAIN;
    master.connect(context.destination);
    return context;
  }

  // Gesture entry point. Muted audio is never instantiated: unmuting goes
  // through setMuted() and only then creates the context.
  function unlock() {
    if (muted) return null;
    const ctx = acquireContext();
    if (ctx && typeof ctx.resume === 'function' && ctx.state === 'suspended') {
      ctx.resume();
    }
    return ctx;
  }

  function persistMuted() {
    try {
      storage?.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
    } catch {
      // A blocked/unavailable storage must not break audio; the in-memory
      // preference still applies to this session.
    }
  }

  function applyMute() {
    if (master) master.gain.value = muted ? 0 : MASTER_GAIN;
  }

  function setMuted(value) {
    muted = Boolean(value);
    persistMuted();
    if (!muted) unlock();
    applyMute();
    return muted;
  }

  function toggleMuted() {
    return setMuted(!muted);
  }

  // --- synthesis ------------------------------------------------------------

  function tone({ type = 'square', startFrequency, endFrequency, duration, gain }) {
    if (!context || !master || muted) return;
    const start = currentTime();
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, start);
    if (endFrequency !== undefined && endFrequency !== startFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(1, endFrequency),
        start + duration,
      );
    }
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(gain, start + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function noise({ duration, gain, from, to }) {
    if (!context || !master || muted) return;
    const start = currentTime();
    const frames = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(gain, start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(master);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  function playShoot() {
    tone({ type: 'square', startFrequency: 900, endFrequency: 220, duration: 0.08, gain: 0.16 });
  }

  function playExplosion() {
    noise({ duration: 0.3, gain: 0.45, from: 1800, to: 140 });
  }

  function playBridgeExplosion() {
    noise({ duration: 0.55, gain: 0.55, from: 1500, to: 70 });
    tone({ type: 'triangle', startFrequency: 180, endFrequency: 60, duration: 0.3, gain: 0.12 });
  }

  function playRefuel() {
    tone({ type: 'triangle', startFrequency: 520, endFrequency: 760, duration: 0.09, gain: 0.18 });
    tone({ type: 'triangle', startFrequency: 760, endFrequency: 1040, duration: 0.12, gain: 0.16 });
  }

  function ensureEngine() {
    if (!context || !master || engineOscillator) return;
    engineOscillator = context.createOscillator();
    engineOscillator.type = 'sawtooth';
    engineOscillator.frequency.value = ENGINE_MIN_HZ;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineOscillator.connect(engineGain);
    engineGain.connect(master);
    engineOscillator.start();
  }

  function engineFrequencyFor(speed) {
    const span = Math.max(1, MAX_SPEED - CRUISE_SPEED);
    const ratio = Math.max(0, Math.min(1, (speed - CRUISE_SPEED) / span));
    return ENGINE_MIN_HZ + ratio * (ENGINE_MAX_HZ - ENGINE_MIN_HZ);
  }

  function setEngineSpeed(speed) {
    engineSpeed = Number.isFinite(speed) ? speed : engineSpeed;
    if (!engineOscillator) return;
    engineOscillator.frequency.setTargetAtTime(
      engineFrequencyFor(engineSpeed),
      currentTime(),
      0.05,
    );
  }

  function setEngineActive(active) {
    if (!engineGain) return;
    const target = active && !muted ? ENGINE_GAIN : 0;
    engineGain.gain.setTargetAtTime(target, currentTime(), 0.05);
  }

  // Consumes the pure simulation's sound-event queue once per display frame.
  // `state` supplies the live scroll speed (engine hum) and the game-over flag.
  function handleEvents(events, state) {
    if (!context || muted) return;
    ensureEngine();
    if (state && Number.isFinite(state.speed)) setEngineSpeed(state.speed);
    for (const event of events ?? []) {
      switch (event?.type) {
        case SOUND_EVENT.SHOOT:
          playShoot();
          break;
        case SOUND_EVENT.DESTROY:
          if (event.kind === 'bridge') playBridgeExplosion();
          else playExplosion();
          break;
        case SOUND_EVENT.REFUEL:
          playRefuel();
          break;
        case SOUND_EVENT.ENGINE:
          setEngineSpeed(event.speed);
          break;
        default:
          break;
      }
    }
    setEngineActive(state ? !state.gameOver : true);
  }

  // Attaches the autoplay-guard gesture listeners and the M mute toggle.
  function attachControls(target = win) {
    if (!target || typeof target.addEventListener !== 'function') {
      return { dispose() {} };
    }

    const onPointerDown = () => {
      unlock();
    };
    const onKeyDown = (event) => {
      if (event.code === 'KeyM' && !event.repeat) {
        toggleMuted();
        return;
      }
      unlock();
    };

    target.addEventListener('pointerdown', onPointerDown);
    target.addEventListener('keydown', onKeyDown);

    return {
      dispose() {
        target.removeEventListener('pointerdown', onPointerDown);
        target.removeEventListener('keydown', onKeyDown);
      },
    };
  }

  function dispose() {
    if (engineOscillator) {
      try {
        engineOscillator.stop();
      } catch {
        // Already stopped; ignore.
      }
      engineOscillator.disconnect?.();
    }
    engineOscillator = null;
    engineGain = null;
    if (context && typeof context.close === 'function') context.close();
    context = null;
    master = null;
  }

  return {
    unlock,
    setMuted,
    toggleMuted,
    handleEvents,
    attachControls,
    dispose,
    isMuted: () => muted,
    isUnlocked: () => Boolean(context),
    getContext: () => context,
  };
}
