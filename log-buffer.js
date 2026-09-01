/**
 * LogBuffer — captures console.* calls into a circular buffer (500 entries).
 * Used by read_logs task.
 */

const MAX = 500;

export class LogBuffer {
  /** @type {Array<{ts: number, level: string, message: string}>} */
  _buf = [];
  _idx = 0;

  install() {
    const wrap = (level) => {
      const orig = console[level];
      console[level] = (...args) => {
        const msg = args.map(a => {
          if (a == null) return String(a);
          if (typeof a === 'string') return a;
          try { return JSON.stringify(a); }
          catch { return String(a); }
        }).join(' ');
        this._buf[this._idx % MAX] = { ts: Date.now(), level, message: msg };
        this._idx++;
        return orig.apply(console, args);
      };
    };
    wrap('log'); wrap('error'); wrap('warn'); wrap('info');
  }

  getEntries(opts = {}) {
    const { level = null, contains = null, limit = 200, sinceMs = 0 } = opts;
    const start = (this._idx - limit) % MAX;
    const results = [];
    for (let i = 0; i < MAX && results.length < limit; i++) {
      const slot = (start + i) % MAX;
      const entry = this._buf[slot];
      if (!entry) continue;
      if (entry.ts < sinceMs) continue;
      if (level && entry.level !== level) continue;
      if (contains && !entry.message.includes(contains)) continue;
      results.push(entry);
    }
    return results;
  }
}
