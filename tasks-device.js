/**
 * Built-in device tasks: screenshot, read_logs, get_state, get_perf, prefs.
 */

export function registerDevice(registry, logBuffer) {
  registry.register('screenshot', async () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    console.log('[screenshot] start w=' + w + ' h=' + h);

    // Try html2canvas first (handles DOM rendering correctly)
    if (typeof html2canvas === 'function') {
      try {
        console.log('[screenshot] using html2canvas');
        const canvas = await html2canvas(document.documentElement, {
          backgroundColor: '#ffffff',
          scale: window.devicePixelRatio,
          logging: false,
        });
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        console.log('[screenshot] html2canvas ok, base64 len=' + (base64?.length ?? 0));
        return {
          width: w,
          height: h,
          bytes: base64.length,
          __odl_file: { mime: 'image/png', data: base64 },
        };
      } catch (e) {
        console.log('[screenshot] html2canvas failed:', e);
      }
    }

    // Fallback: SVG foreignObject
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { console.log('[screenshot] no ctx'); return { error: 'no canvas context' }; }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">${document.documentElement.outerHTML}</div>
      </foreignObject>
    </svg>`;
    let success = false;
    try {
      console.log('[screenshot] trying SVG foreignObject');
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = () => { console.log('[screenshot] SVG onload ok'); resolve(); };
        img.onerror = (e) => { console.log('[screenshot] SVG onerror:', e); reject(e); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      });
      ctx.drawImage(img, 0, 0);
      success = true;
    } catch (e) {
      console.log('[screenshot] SVG failed:', e);
    }

    if (!success && typeof ctx.drawWindow === 'function') {
      try {
        console.log('[screenshot] trying drawWindow');
        ctx.drawWindow(window, 0, 0, w, h, 'rgb(255,255,255)');
        success = true;
      } catch (e) {
        console.log('[screenshot] drawWindow failed:', e);
      }
    }

    if (!success) {
      console.log('[screenshot] fallback: drawing text placeholder');
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#333';
      ctx.font = '14px monospace';
      ctx.fillText(`Screenshot (${w}x${h})`, 10, 20);
    }

    try {
      console.log('[screenshot] calling toDataURL...');
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      console.log('[screenshot] toDataURL ok, base64 len=' + (base64?.length ?? 0));
      return {
        width: w,
        height: h,
        bytes: base64.length,
        __odl_file: { mime: 'image/png', data: base64 },
      };
    } catch (e) {
      console.log('[screenshot] toDataURL ERROR:', e);
      return { error: 'toDataURL failed: ' + e.message };
    }
  },
    'Captures the current viewport as PNG via __odl_file envelope. ' +
    'Uses SVG foreignObject; falls back to text info if unavailable.',
    JSON.stringify({ type: 'object', properties: {} })
  );

  registry.register('read_logs', async (p) => {
    const { level, contains, limit = 200, sinceMs = 0 } = p;
    return { logs: logBuffer.getEntries({ level, contains, limit, sinceMs }) };
  },
    'Returns captured console logs from the circular buffer (500 entries). ' +
    'Logs are only captured after SDK start (no history). Filter by level/contains/limit/sinceMs.',
    JSON.stringify({
      type: 'object',
      properties: {
        level:    { type: 'string', enum: ['log','error','warn','info'] },
        contains: { type: 'string' },
        limit:    { type: 'number', default: 200 },
        sinceMs:  { type: 'number', default: 0 },
      },
    })
  );

  registry.register('get_state', async () => {
    return {
      url: location.href,
      title: document.title,
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      language: navigator.language,
      languages: navigator.languages,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      performance: {
        navigation: performance.getEntriesByType?.('navigation')?.[0] ?? null,
        memory: typeof performance.memory ? {
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          usedJSHeapSize: performance.memory.usedJSHeapSize,
        } : null,
      },
    };
  },
    'Returns browser/device state: URL, viewport size, navigator info, performance timing.'
  );

  registry.register('get_perf', async () => {
    const nav = performance.getEntriesByType?.('navigation')?.[0];
    const marks = performance.getEntriesByType?.('mark');
    return {
      navigation: nav ? {
        domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
        loadComplete: nav.loadEventEnd - nav.startTime,
        redirectCount: nav.redirectCount,
        type: nav.type,
      } : null,
      marks: marks?.slice(-20).map(m => ({ name: m.name, startTime: m.startTime, duration: m.duration })),
      resourceCount: performance.getEntriesByType?.('resource')?.length ?? 0,
    };
  },
    'Returns performance metrics: navigation timing, named performance marks, resource count.'
  );

  registry.register('prefs', async (p) => {
    const { action, key, value, valueType } = p;
    const v = value === undefined ? undefined
      : valueType === 'int' ? parseInt(value, 10)
      : valueType === 'float' ? parseFloat(value)
      : valueType === 'bool' ? String(value) === 'true'
      : value;

    switch (action) {
      case 'get': {
        const raw = localStorage.getItem(key);
        return { key, value: raw ?? null };
      }
      case 'set': {
        localStorage.setItem(key, String(v));
        return { stored: key, value: v };
      }
      case 'delete': {
        localStorage.removeItem(key);
        return { deleted: key };
      }
      case 'list': {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          keys.push(localStorage.key(i));
          if (keys.length >= 200) break;
        }
        return { keys };
      }
      default:
        return { error: `unknown prefs action: ${action}` };
    }
  },
    'Reads/writes localStorage items. Actions: get/set/delete/list. Supports valueType int/float/bool for set.',
    JSON.stringify({
      type: 'object',
      properties: {
        action:  { type: 'string', enum: ['get', 'set', 'delete', 'list'] },
        key:     { type: 'string' },
        value:   { type: 'string' },
        valueType: { type: 'string', enum: ['int', 'float', 'bool'] },
      },
    })
  );
}
