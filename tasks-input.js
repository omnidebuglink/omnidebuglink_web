/**
 * Built-in input tasks: swipe, long_press, input_text, send_key.
 */

function ensureActions(actionsEnabled) {
  if (!actionsEnabled) throw new Error('write actions disabled (actionsEnabled = false)');
}

export function registerInput(registry, ensureActions) {
  registry.register('swipe', async (p) => {
    ensureActions();
    const { x1, y1, x2, y2, durationMs = 300 } = p;
    const startX = Math.round(x1 * window.innerWidth);
    const startY = Math.round(y1 * window.innerHeight);
    const endX   = Math.round(x2 * window.innerWidth);
    const endY   = Math.round(y2 * window.innerHeight);

    const el = document.elementFromPoint(startX, startY);
    if (!el) return { swiped: false, error: 'start point not on any element' };

    // Pointer events for touch-like swipe
    const steps = 20;
    const stepTime = durationMs / steps;

    el.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, view: window,
      pointerId: 1, pointerType: 'touch',
      clientX: startX, clientY: startY,
    }));

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const cx = Math.round(startX + (endX - startX) * t);
      const cy = Math.round(startY + (endY - startY) * t);
      el.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, cancelable: true, view: window,
        pointerId: 1, pointerType: 'touch',
        clientX: cx, clientY: cy,
        deltaX: cx - (i === 1 ? startX : Math.round(startX + (endX - startX) * (i - 1) / steps)),
        deltaY: cy - (i === 1 ? startY : Math.round(startY + (endY - startY) * (i - 1) / steps)),
      }));
      await new Promise(r => setTimeout(r, stepTime));
    }

    el.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, view: window,
      pointerId: 1, pointerType: 'touch',
      clientX: endX, clientY: endY,
    }));

    return { swiped: true, startX, startY, endX, endY };
  },
    'Swipes from (x1,y1) to (x2,y2) over durationMs ms using PointerEvents. Coordinates are 0-1 normalized, origin top-left.',
    JSON.stringify({
      type: 'object',
      properties: {
        x1: { type: 'number', minimum: 0, maximum: 1 },
        y1: { type: 'number', minimum: 0, maximum: 1 },
        x2: { type: 'number', minimum: 0, maximum: 1 },
        y2: { type: 'number', minimum: 0, maximum: 1 },
        durationMs: { type: 'number', default: 300 },
      },
    })
  );

  registry.register('long_press', async (p) => {
    ensureActions();
    const { x, y, holdMs = 1000 } = p;
    const px = Math.round(x * window.innerWidth);
    const py = Math.round(y * window.innerHeight);
    const el = document.elementFromPoint(px, py);
    if (!el) return { pressed: false };

    el.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, view: window,
      pointerId: 2, pointerType: 'touch', clientX: px, clientY: py,
    }));
    await new Promise(r => setTimeout(r, holdMs));
    el.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, view: window,
      pointerId: 2, pointerType: 'touch', clientX: px, clientY: py,
    }));
    return { pressed: true };
  },
    'Long-presses at normalized coords (0-1, top-left) for holdMs (default 1000). Uses PointerEvents.',
    JSON.stringify({
      type: 'object',
      properties: {
        x:      { type: 'number', minimum: 0, maximum: 1 },
        y:      { type: 'number', minimum: 0, maximum: 1 },
        holdMs: { type: 'number', default: 1000 },
      },
    })
  );

  registry.register('input_text', async (p) => {
    ensureActions();
    const { text, selector } = p;
    let el;
    if (selector) el = document.querySelector(selector);
    if (!el) return { inputted: false, error: 'element not found' };
    if (!el.isContentEditable && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
      return { inputted: false, error: 'element not editable' };
    }
    el.focus();
    // Set value and fire events
    Object.defineProperty(el, 'value', { writable: true });
    el.value = text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    // React/ Vue often need these too
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', bubbles: true }));
    return { inputted: true, length: text.length };
  },
    'Types text into an input/textarea or contenteditable element. Fires input/change/keydown/keyup events.',
    JSON.stringify({
      type: 'object',
      properties: {
        text:     { type: 'string' },
        selector: { type: 'string' },
      },
    })
  );

  registry.register('send_key', async (p) => {
    ensureActions();
    const { key } = p;
    const keyMap = {
      enter: 'Enter', tab: 'Tab', escape: 'Escape', backspace: 'Backspace',
      delete: 'Delete', arrowup: 'ArrowUp', arrowdown: 'ArrowDown',
      arrowleft: 'ArrowLeft', arrowright: 'ArrowRight', home: 'Home', end: 'End',
      pageup: 'PageUp', pagedown: 'PageDown', space: ' ',
    };
    const mapped = keyMap[key?.toLowerCase()] ?? key;
    if (!mapped) return { sent: false, error: `unknown key: ${key}` };
    const el = document.activeElement;
    el?.dispatchEvent(new KeyboardEvent('keydown', { key: mapped, bubbles: true }));
    el?.dispatchEvent(new KeyboardEvent('keypress', { key: mapped, bubbles: true }));
    el?.dispatchEvent(new KeyboardEvent('keyup',   { key: mapped, bubbles: true }));
    return { sent: true, key: mapped };
  },
    'Sends a keyboard event (keydown/keypress/keyup) to the currently focused element.',
    JSON.stringify({
      type: 'object',
      properties: {
        key: { type: 'string', enum: ['enter','tab','escape','backspace','delete','arrowup','arrowdown','arrowleft','arrowright','home','end','space'] },
      },
    })
  );
}
