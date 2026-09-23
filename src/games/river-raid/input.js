// Keyboard input mapping for the River Raid jet.
//
// The browser layer translates physical keys into the plain input object the
// pure step() function consumes. Nothing here is imported by the simulation or
// the headless driver, so Node never touches the DOM.

const KEY_ACTIONS = Object.freeze({
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'throttle',
  KeyW: 'throttle',
  Space: 'fire',
  KeyJ: 'fire',
  Enter: 'restart',
  KeyR: 'restart',
});

export function createInputState() {
  return { left: false, right: false, throttle: false, fire: false, restart: false };
}

export function mapKey(code) {
  return KEY_ACTIONS[code] ?? null;
}

export function attachKeyboard(target, state = createInputState()) {
  if (!target || typeof target.addEventListener !== 'function') {
    return { state, dispose() {} };
  }

  const onKeyDown = (event) => {
    const action = mapKey(event.code);
    if (!action) return;
    state[action] = true;
    if (typeof event.preventDefault === 'function') event.preventDefault();
  };

  const onKeyUp = (event) => {
    const action = mapKey(event.code);
    if (!action) return;
    state[action] = false;
    if (typeof event.preventDefault === 'function') event.preventDefault();
  };

  const onBlur = () => {
    state.left = false;
    state.right = false;
    state.throttle = false;
    state.fire = false;
    state.restart = false;
  };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  return {
    state,
    dispose() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', onBlur);
    },
  };
}
