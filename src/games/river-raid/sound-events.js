// Pure sound-event queue for the River Raid render/audio layer (T-201).
//
// The simulation never touches the audio system. Instead, each step pushes
// small, plain-data events onto state.soundEvents and the browser audio adapter
// drains that queue once per display frame. The queue is deliberately excluded
// from hashState (see hash.js), so sound stays render-layer only: identical
// seeds and inputs keep producing identical state hashes whether or not anyone
// ever listens.
//
// This module is DOM-free and has no side effects, so both the headless driver
// and the browser can import it.

export const SOUND_EVENT = Object.freeze({
  SHOOT: 'shoot',
  DESTROY: 'destroy',
  REFUEL: 'refuel',
  ENGINE: 'engine',
});

// Upper bound on retained events. The browser drains the queue every frame, so
// in practice it holds a handful of entries; the cap keeps a headless run that
// never drains from growing without bound. Dropping the oldest entries cannot
// affect the state hash because the queue is not part of it.
export const MAX_SOUND_EVENTS = 64;

// Engine-hum events are emitted only when the scroll speed crosses a bucket
// boundary, so a steady speed does not flood the queue.
export const ENGINE_SPEED_QUANTUM = 10;

export function engineSpeedBucket(speed) {
  return Math.floor(Number(speed) / ENGINE_SPEED_QUANTUM);
}

export function emitSoundEvent(state, event) {
  const queue = state.soundEvents;
  if (!Array.isArray(queue)) return event;
  queue.push(event);
  const overflow = queue.length - MAX_SOUND_EVENTS;
  if (overflow > 0) queue.splice(0, overflow);
  return event;
}

// Removes and returns every queued event. The caller owns the returned array.
export function drainSoundEvents(state) {
  const queue = state.soundEvents;
  if (!Array.isArray(queue) || queue.length === 0) return [];
  return queue.splice(0, queue.length);
}
