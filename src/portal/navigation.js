// Pure keyboard-navigation reducer for the portal home page.
//
// Kept DOM-free so the focus order and activation rules are unit-testable
// under node:test. The portal view binds these results to real focus() and
// activation calls; nothing here touches the document.

export const NAV_KEYS = Object.freeze({
  ArrowRight: 'next',
  ArrowDown: 'next',
  ArrowLeft: 'prev',
  ArrowUp: 'prev',
  Home: 'first',
  End: 'last',
  Enter: 'activate',
  Space: 'activate',
});

export function nextIndex(index, count) {
  if (count <= 0) return -1;
  if (index < 0) return 0;
  return (index + 1) % count;
}

export function prevIndex(index, count) {
  if (count <= 0) return -1;
  if (index < 0) return count - 1;
  return (index - 1 + count) % count;
}

// Resolves a keyboard event code against the current focus position into a
// movement or activation intent, or null when the key is not a navigation key.
export function resolveKey(code, index, count) {
  const action = NAV_KEYS[code];
  if (!action || count <= 0) return null;

  switch (action) {
    case 'next':
      return { type: 'move', index: nextIndex(index, count) };
    case 'prev':
      return { type: 'move', index: prevIndex(index, count) };
    case 'first':
      return { type: 'move', index: 0 };
    case 'last':
      return { type: 'move', index: count - 1 };
    case 'activate':
      return { type: 'activate', index: index < 0 ? 0 : index };
    default:
      return null;
  }
}
