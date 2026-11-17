// Keyboard and pointer input. Held keys give a movement vector; one-shot presses
// (confirm, pause, mute, upgrade picks) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost and never counted twice.
// The pointer is reported in the game's logical 1280x720 coordinates.

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_PICK1 = 8;
export const ACTION_PICK2 = 16;
export const ACTION_PICK3 = 32;

const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const PICKS = new Map([['Digit1', ACTION_PICK1], ['Digit2', ACTION_PICK2], ['Digit3', ACTION_PICK3]]);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let firing = false;
  let dashQueued = false;
  const pointer = { x: FIELD.width / 2, y: FIELD.height / 2 - 120, inside: false };

  /** Convert a client (CSS pixel) point into logical field coordinates. */
  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const ox = (rect.width - FIELD.width * scale) / 2;
    const oy = (rect.height - FIELD.height * scale) / 2;
    pointer.x = (clientX - rect.left - ox) / scale;
    pointer.y = (clientY - rect.top - oy) / scale;
    pointer.inside = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= FIELD.width && pointer.y <= FIELD.height;
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
      if (!event.repeat) { actions |= ACTION_CONFIRM; dashQueued = true; }
      event.preventDefault();
      return;
    }
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (PICKS.has(event.code)) {
      if (!event.repeat) actions |= PICKS.get(event.code);
    } else {
      held.add(event.code);
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => { held.clear(); firing = false; });

  canvas.addEventListener('pointermove', (event) => toField(event.clientX, event.clientY));
  canvas.addEventListener('pointerdown', (event) => {
    toField(event.clientX, event.clientY);
    firing = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { firing = false; });
  canvas.addEventListener('pointerleave', () => { pointer.inside = false; });

  return {
    /** Movement direction from WASD/arrows, normalised so diagonals are not faster. */
    moveVector() {
      let x = 0;
      let y = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) y -= 1;
      if (held.has('KeyS') || held.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    },
    /** True while Shift is held (the second dash key). */
    shiftHeld() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    get firing() { return firing; },
    get pointer() { return pointer; },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Whether dash was pressed since the last call (consumes the press). */
    takeDash() {
      const taken = dashQueued;
      dashQueued = false;
      return taken;
    },
  };
}
