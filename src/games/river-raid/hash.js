// Deterministic 32-bit FNV-1a hash used to fingerprint simulation state.
// Pure string -> hex; no dependencies and identical results in Node and the
// browser, so scripts/simulate.js and the tests share one canonical answer.

export function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function fixed(value) {
  return Number(value).toFixed(6);
}

// Canonical fingerprint of the fields that define a simulation state. The
// terrain stream is fully determined by the seed, but the generated segment
// count and leading segment are folded in so any divergence shows up. The fuel,
// lives, bullet, game-over and entity fields make the combat layer part of the
// determinism contract: same seed + same input must produce the same hash.
export function hashState(state) {
  const { player, terrain } = state;
  const last = terrain.segments[terrain.segments.length - 1];
  const parts = [
    `seed=${state.seed >>> 0}`,
    `frame=${state.frame}`,
    `time=${fixed(state.time)}`,
    `scrollY=${fixed(state.scrollY)}`,
    `speed=${fixed(state.speed)}`,
    `x=${fixed(player.x)}`,
    `collided=${player.collided ? 1 : 0}`,
    `segments=${terrain.segments.length}`,
    `leadCenter=${fixed(last.center)}`,
    `leadWidth=${fixed(last.width)}`,
    `fuel=${fixed(state.fuel)}`,
    `lives=${state.lives}`,
    `respawnGrace=${state.respawnGrace}`,
    `gameOver=${state.gameOver ? 1 : 0}`,
    `gameOverReason=${state.gameOverReason ?? 'none'}`,
    `bullet=${state.bullet ? `${fixed(state.bullet.x)},${fixed(state.bullet.worldY)}` : 'none'}`,
    `entities=${state.entities.length}`,
  ];

  for (const entity of state.entities) {
    parts.push(
      `entity=${entity.uid}:${entity.kind}:${entity.type}:${fixed(entity.worldY)}:${fixed(entity.x)}:${entity.dir}:${entity.used ? 1 : 0}`,
    );
  }

  return fnv1a(parts.join('|'));
}
