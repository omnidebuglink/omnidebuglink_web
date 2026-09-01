/**
 * Built-in UI tasks: ui_traverse, find_objects, view_component, wait_for,
 * ui_click, tap_screen.
 */

const MAX_NODES = 3000;

function traverseNode(el, depth = 0) {
  if (depth >= MAX_NODES) return null;
  const node = {
    tag: el.tagName?.toLowerCase() ?? '#text',
    id: el.id ?? null,
    className: el.className?.toString() ?? '',
    text: el.nodeType === 3 ? el.textContent?.trim() : null,
    attrs: {},
    rect: null,
    children: [],
  };

  for (const attr of ['type', 'name', 'placeholder', 'aria-label',
    'data-testid', 'data-test', 'role', 'href', 'src']) {
    const val = el.getAttribute?.(attr);
    if (val) node.attrs[attr] = val;
  }

  // 表单控件当前值:property 与 attribute 是两回事,必须报 property 才反映真实输入状态
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
    const v = el.value;
    if (typeof v === 'string' && v !== '') node.attrs.value = v.slice(0, 100);
    if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio') && el.checked) {
      node.attrs.checked = 'true';
    }
  }

  if (el.nodeType !== 3 && el.textContent) {
    const t = el.textContent.trim();
    if (t) node.text = t.length > 100 ? t.slice(0, 100) + '…' : t;
  }

  try { node.rect = el.getBoundingClientRect?.(); } catch {}

  // Traverse children, recursing into shadow roots
  const childSources = [];
  if (el.shadowRoot) childSources.push(...el.shadowRoot.children);
  else if (el.children) childSources.push(...el.children);

  for (const child of childSources) {
    const sn = traverseNode(child, depth + 1);
    if (!sn) return node;
    node.children.push(sn);
  }

  return node;
}

function flattenTree(node, path = '0', results = []) {
  if (results.length >= MAX_NODES) return results;
  results.push({
    path,
    tag: node.tag,
    id: node.id,
    className: node.className,
    text: node.text,
    rect: node.rect,
    attrs: node.attrs,
  });
  for (let i = 0; i < node.children.length; i++) {
    flattenTree(node.children[i], `${path}/${i}`, results);
  }
  return results;
}

function qs(sel) { try { return document.querySelector(sel); } catch { return null; } }

export function registerUi(registry, ensureActions) {
  registry.register('ui_traverse', async (p) => {
    const root = p.rootSelector ? qs(p.rootSelector) : document.body || document.documentElement;
    const flat = flattenTree(traverseNode(root, 0));
    return { nodes: flat, count: flat.length };
  },
    'Traverses the DOM tree (incl. shadow roots) from body or selector, returns flat list ' +
    'of nodes with path, tag, id, className, text, rect, attrs. Max 3000 nodes.',
    JSON.stringify({
      type: 'object',
      properties: {
        rootSelector: { type: 'string', description: 'CSS selector for root (default: body)' },
      },
    })
  );

  registry.register('find_objects', async (p) => {
    const { text, className, id, tag, dataTestId, rootSelector } = p;
    const root = rootSelector ? qs(rootSelector) : document.body;
    if (!root) return { objects: [] };

    const parts = [];
    if (tag)       parts.push(tag.toUpperCase());
    if (id)        parts.push(`#${cssEscape(id)}`);
    if (className) parts.push(`.${cssEscape(className).split(' ').join('.')}`);
    if (dataTestId) parts.push(`[data-testid="${cssEscape(dataTestId)}"]`);
    const selector = parts.join('');

    let matches = selector
      ? Array.from(root.querySelectorAll(selector))
      : Array.from(root.querySelectorAll('*'));

    const results = [];
    for (const el of matches) {
      // 文本匹配同时看 textContent 与表单控件当前 value(输入结果不是文本节点,textContent 看不见)
      const value = typeof el.value === 'string' && el.value !== '' ? el.value : null;
      if (text) {
        const hay = `${el.textContent ?? ''} ${value ?? ''}`.toLowerCase();
        if (!hay.includes(text.toLowerCase())) continue;
      }
      const rect = el.getBoundingClientRect?.();
      results.push({
        path: el.id || el.className?.split?.(' ')?.[0] || el.tagName.toLowerCase(),
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim()?.slice(0, 80),
        ...(value ? { value: value.slice(0, 80) } : {}),
        center: rect
          ? { x: (rect.left + rect.width / 2) / window.innerWidth,
              y: (rect.top + rect.height / 2) / window.innerHeight }
          : null,
      });
      if (results.length >= 50) break;
    }
    return { objects: results };
  },
    'Finds elements by tag/id/class/data-testid/text substring. Returns up to 50 matches with center coords.',
    JSON.stringify({
      type: 'object',
      properties: {
        tag:        { type: 'string' },
        id:         { type: 'string' },
        className:  { type: 'string' },
        dataTestId: { type: 'string' },
        text:       { type: 'string', description: 'substring match on textContent' },
        rootSelector: { type: 'string' },
      },
    })
  );

  registry.register('view_component', async (p) => {
    const { selector, id, tag } = p;
    let el;
    if (id)        el = document.getElementById(id);
    else if (selector) el = qs(selector);
    else if (tag)  el = qs(tag);
    if (!el) return { error: 'element not found' };

    const rect = el.getBoundingClientRect?.();
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id,
      className: el.className,
      text: el.textContent?.trim()?.slice(0, 200),
      value: typeof el.value === 'string' ? el.value.slice(0, 200) : undefined,
      checked: el.checked === true ? true : undefined,
      rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      visible: rect && rect.width > 0 && rect.height > 0 &&
               cs.visibility !== 'hidden' && cs.display !== 'none',
      computedStyle: {
        fontSize: cs.fontSize,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        fontFamily: cs.fontFamily,
      },
      attrs: Object.fromEntries([...el.attributes].map(a => [a.name, a.value])),
    };
  },
    'Returns detailed info about a single element: rect, computed styles, attributes.',
    JSON.stringify({
      type: 'object',
      properties: {
        selector: { type: 'string' },
        id:       { type: 'string' },
        tag:      { type: 'string' },
      },
    })
  );

  registry.register('wait_for', async (p) => {
    const { selector, text, timeoutMs = 5000 } = p;
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      if (selector) {
        if (qs(selector)) return { found: true, selector };
      }
      if (text) {
        for (const el of document.querySelectorAll('*')) {
          if ((el.textContent ?? '').includes(text)) return { found: true, text };
        }
      }
      return null;
    };
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const r = check();
        if (r) { clearInterval(interval); resolve(r); }
        else if (Date.now() >= deadline) { clearInterval(interval); resolve({ found: false }); }
      }, 200);
    });
  },
    'Polls every 200ms until selector appears or text is found. Returns { found: true/false } within timeoutMs.',
    JSON.stringify({
      type: 'object',
      properties: {
        selector: { type: 'string' },
        text:     { type: 'string' },
        timeoutMs:{ type: 'number', default: 5000 },
      },
    })
  );

  registry.register('ui_click', async (p) => {
    ensureActions();
    const { selector, index, text } = p;
    let el;
    if (selector) {
      el = qs(selector);
    } else if (text) {
      const all = [...document.querySelectorAll('*')];
      const matches = all.filter(e => (e.textContent ?? '').includes(text));
      el = matches[index ?? 0] ?? null;
    }
    if (!el) return { executed: false, error: 'element not found' };
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    el.focus?.();
    return { executed: true };
  },
    'Clicks an element by selector or text match via dispatchEvent MouseEvent. **Cannot open system-level pickers** (e.g. <select> native dropdown, file picker) — those require real touch sequence, not synthetic events. Use a custom DOM-based picker instead. Requires actionsEnabled.',
    JSON.stringify({
      type: 'object',
      properties: {
        selector: { type: 'string' },
        text:     { type: 'string' },
        index:    { type: 'number', description: '0-based index when matching by text' },
      },
    })
  );

  registry.register('tap_screen', async (p) => {
    ensureActions();
    const { x, y } = p;
    const px = Math.round(x * window.innerWidth);
    const py = Math.round(y * window.innerHeight);
    const el = document.elementFromPoint(px, py);
    el?.dispatchEvent(new MouseEvent('click', {
      bubbles: true, cancelable: true, view: window, clientX: px, clientY: py,
    }));
    return { tapped: true, x: px, y: py, element: el?.tagName?.toLowerCase() };
  },
    'Taps at normalized screen coordinates (0-1, origin top-left). Fires dispatchEvent MouseEvent (bubbles:true). **Cannot open system-level pickers** (e.g. <select> native dropdown, native file picker, <input type=file>) — Chrome triggers those on real touch sequence, not on untrusted synthetic events; use a custom DOM-based picker instead.',
    JSON.stringify({
      type: 'object',
      properties: {
        x: { type: 'number', minimum: 0, maximum: 1 },
        y: { type: 'number', minimum: 0, maximum: 1 },
      },
    })
  );
}

function cssEscape(s) {
  return s.replace(/[^\w-]/g, c => '\\' + c.charCodeAt(0).toString(16) + ' ');
}
