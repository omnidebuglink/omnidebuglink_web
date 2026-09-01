/**
 * Built-in device tasks: screenshot, read_logs, get_state, get_perf, prefs.
 */

export function registerDevice(registry, logBuffer) {
  registry.register('screenshot', async (p) => {
    const fullPage = p?.fullPage === true;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const doc = document.documentElement;
    // 默认视口(所见即所得,坐标与 find_objects/tap_screen 同系);fullPage 才整个文档
    const cw = fullPage ? Math.max(doc.scrollWidth, doc.clientWidth) : w;
    const ch = fullPage ? Math.max(doc.scrollHeight, doc.clientHeight) : h;
    console.log(`[screenshot] start ${cw}x${ch}${fullPage ? ' fullPage' : ' viewport'} scrollY=${window.scrollY}`);

    // Try html2canvas first (handles DOM rendering correctly)
    if (typeof html2canvas === 'function') {
      try {
        console.log('[screenshot] using html2canvas');
        // html2canvas 不渲染 shadow DOM(cloneNode 不拷贝 shadowRoot);
        // 在 onclone 里把 live 文档的 shadow 内容展平进克隆文档(不动真实页面,支持嵌套)。
        // 内联样式的 shadow 内容可完整还原;<style>/constructed stylesheet 的作用域会泄漏,属近似。
        const flattenShadow = (clonedDoc) => {
          const walk = (liveNode, cloneNode) => {
            if (!liveNode || !cloneNode) return;
            if (liveNode.shadowRoot) {
              const sc = [...liveNode.shadowRoot.children];
              const appended = sc.map((c) => {
                const copy = c.cloneNode(true);
                cloneNode.appendChild(copy);
                return copy;
              });
              sc.forEach((c, i) => walk(c, appended[i]));
            }
            const lc = [...(liveNode.children || [])];
            const cc = [...(cloneNode.children || [])];
            for (let i = 0; i < lc.length; i++) walk(lc[i], cc[i]);
          };
          walk(document.documentElement, clonedDoc.documentElement);
        };
        const canvas = await html2canvas(doc, {
          backgroundColor: '#ffffff',
          scale: window.devicePixelRatio,
          logging: false,
          x: 0,
          y: fullPage ? 0 : window.scrollY,   // 捕获窗口在文档中的起点
          width: cw,
          height: ch,
          windowWidth: w,                      // 克隆布局视口不变(媒体查询/百分比布局不受截图影响)
          windowHeight: h,
          onclone: flattenShadow,
        });
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        console.log('[screenshot] html2canvas ok, base64 len=' + (base64?.length ?? 0));
        return {
          width: canvas.width,   // 真实物理像素(= cssWidth × devicePixelRatio)
          height: canvas.height,
          cssWidth: cw,
          cssHeight: ch,
          fullPage,
          bytes: base64.length,
          __odl_file: { mime: 'image/png', data: base64 },
        };
      } catch (e) {
        console.log('[screenshot] html2canvas failed:', e);
      }
    }

    // Fallback: SVG foreignObject(降级路径,质量差,尺寸同样遵循 viewport/fullPage)
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) { console.log('[screenshot] no ctx'); return { error: 'no canvas context' }; }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}">
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
        // drawWindow 只能画视口区域(fullPage 时也只覆盖顶部),降级路径的降级,可接受
        ctx.drawWindow(window, 0, 0, w, h, 'rgb(255,255,255)');
        success = !fullPage;
      } catch (e) {
        console.log('[screenshot] drawWindow failed:', e);
      }
    }

    if (!success) {
      console.log('[screenshot] fallback: drawing text placeholder');
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = '#333';
      ctx.font = '14px monospace';
      ctx.fillText(`Screenshot (${cw}x${ch})`, 10, 20);
    }

    try {
      console.log('[screenshot] calling toDataURL...');
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      console.log('[screenshot] toDataURL ok, base64 len=' + (base64?.length ?? 0));
      return {
        width: canvas.width,
        height: canvas.height,
        cssWidth: cw,
        cssHeight: ch,
        fullPage,
        bytes: base64.length,
        __odl_file: { mime: 'image/png', data: base64 },
      };
    } catch (e) {
      console.log('[screenshot] toDataURL ERROR:', e);
      return { error: 'toDataURL failed: ' + e.message };
    }
  },
    'Captures a PNG screenshot via __odl_file envelope. Default: current viewport ' +
    '(matches find_objects/tap_screen coordinates). fullPage:true captures the whole document. ' +
    'Returns real image dimensions.',
    JSON.stringify({
      type: 'object',
      properties: {
        fullPage: { type: 'boolean', default: false, description: 'capture the whole scrollable document' },
      },
    })
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
