/**
 * Built-in input tasks: swipe, long_press, input_text, send_key.
 */

function ensureActions(actionsEnabled) {
  if (!actionsEnabled) throw new Error('write actions disabled (actionsEnabled = false)');
}

// 合成 PointerEvent/KeyboardEvent 是 untrusted 的,浏览器不会因此执行原生滚动、
// 滑块拖拽、光标移动——需要在 task 里自己做等效补偿。
function findScrollableAncestor(el) {
  let n = el?.parentElement;
  while (n && n !== document.body) {
    const s = getComputedStyle(n);
    if (/(auto|scroll|overlay)/.test(`${s.overflow} ${s.overflowY}`) && n.scrollHeight > n.clientHeight) return n;
    n = n.parentElement;
  }
  const de = document.scrollingElement;
  return de && de.scrollHeight > de.clientHeight ? de : null;
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

    // 原生行为补偿:滑块按 x 坐标换算 value;其他元素把位移同步到最近可滚祖先(方向取触摸语义)
    const isRange  = el.tagName === 'INPUT' && el.type === 'range';
    const scroller = isRange ? null : findScrollableAncestor(el);
    const rangeStep = (cx) => {
      const r = el.getBoundingClientRect();
      const min = parseFloat(el.min || '0'), max = parseFloat(el.max || '100');
      const t = Math.min(1, Math.max(0, (cx - r.left) / (r.width || 1)));
      el.value = String(Math.round(min + t * (max - min)));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const steps = 20;
    const stepTime = durationMs / steps;
    let lastX = startX, lastY = startY;

    el.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, view: window,
      pointerId: 1, pointerType: 'touch',
      clientX: startX, clientY: startY,
    }));

    // 时间戳驱动 + 追帧:后台 tab 的 setTimeout 被钳到 ~1 次/分钟,固定间隔循环会拖成分钟级
    // "卡死"(对远程调试是常态——用户盯着 AI 工具,页面在后台)。醒来按 performance.now()
    // 一次性补齐欠的步数,总时长 ≈ durationMs + 至多一个节流周期。
    const t0 = performance.now();
    let i = 1;
    while (i <= steps) {
      const due = Math.min(steps, Math.floor((performance.now() - t0) / stepTime));
      while (i <= due) {
        const t = i / steps;
        const cx = Math.round(startX + (endX - startX) * t);
        const cy = Math.round(startY + (endY - startY) * t);
        el.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true, cancelable: true, view: window,
          pointerId: 1, pointerType: 'touch',
          clientX: cx, clientY: cy,
          deltaX: cx - lastX, deltaY: cy - lastY,
        }));
        if (isRange) rangeStep(cx);
        else if (scroller) scroller.scrollBy(lastX - cx, lastY - cy);
        lastX = cx; lastY = cy;
        i++;
      }
      if (i > steps) break;
      await new Promise(r => setTimeout(r, Math.max(4, i * stepTime - (performance.now() - t0))));
    }

    el.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, view: window,
      pointerId: 1, pointerType: 'touch',
      clientX: endX, clientY: endY,
    }));
    if (isRange) el.dispatchEvent(new Event('change', { bubbles: true }));

    const after = isRange
      ? { sliderValue: el.value }
      : (scroller ? { scrollTop: Math.round(scroller.scrollTop) } : {});
    return { swiped: true, startX, startY, endX, endY, ...after };
  },
    'Swipes from (x1,y1) to (x2,y2) over durationMs (0-1 normalized, top-left). ' +
    'PointerEvents + native compensation: scrolls nearest scrollable ancestor, drags range sliders by x position.',
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
    if (el.isContentEditable) {
      el.textContent = text;
    } else {
      // 必须用原型上的原生 setter 直写:在实例上定义 own value(如 defineProperty)
      // 会遮蔽原型 setter,浏览器内部值不更新,界面仍显示占位符。
      const proto = el.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement?.prototype
        : window.HTMLInputElement?.prototype;
      const setter = proto && Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(el, text);
      else el.value = text;
      // React 受控组件:tracker 记着旧值,不重置则 onChange 可能不触发
      if (el._valueTracker) el._valueTracker.setValue('');
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    const applied = el.isContentEditable ? el.textContent : el.value;
    return { inputted: true, length: applied?.length ?? 0, value: String(applied ?? '') };
  },
    'Types text into an input/textarea or contenteditable element. Sets native value and fires input/change; returns applied value.',
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
    // 合成键盘不触发原生滚动,滚动键做等效补偿;方向键在表单内不代劳(别劫持光标移动),
    // PageUp/PageDown/Home/End 即使焦点在输入框也照补(与 Chrome 原生行为一致:单行输入框内这些键滚页面)
    const ae = document.activeElement;
    const inForm = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' ||
      ae.tagName === 'SELECT' || ae.isContentEditable);
    const de = document.scrollingElement || document.documentElement;
    const k = key?.toLowerCase();
    if (!(inForm && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k))) {
      if (k === 'pagedown')       de.scrollBy(0, window.innerHeight * 0.9);
      else if (k === 'pageup')    de.scrollBy(0, -window.innerHeight * 0.9);
      else if (k === 'arrowdown') de.scrollBy(0, 80);
      else if (k === 'arrowup')   de.scrollBy(0, -80);
      else if (k === 'home')      de.scrollTo(0, 0);
      else if (k === 'end')       de.scrollTo(0, de.scrollHeight);
    }
    return { sent: true, key: mapped, scrollY: Math.round(window.scrollY) };
  },
    'Sends a keyboard event (keydown/keypress/keyup) to the focused element; scroll keys also scroll the page.',
    JSON.stringify({
      type: 'object',
      properties: {
        key: { type: 'string', enum: ['enter','tab','escape','backspace','delete','arrowup','arrowdown','arrowleft','arrowright','home','end','space'] },
      },
    })
  );
}
