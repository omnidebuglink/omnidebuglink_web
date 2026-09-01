/**
 * OmniDebugLink Web Client SDK — WebSocket connection layer.
 *
 * Handles: hello after open, heartbeat (55s), watchdog (180s),
 * exponential backoff reconnect (1s→30s), permanent stop on close 4000.
 */

const HEARTBEAT_MS = 55000;
const WATCHDOG_MS  = 180000;
const BACKOFF_CAP  = 30000;

export class LinkConnection {
  constructor(url, buildHello, onTask, onState) {
    this.url = url;
    this._buildHello = buildHello;
    this._onTask = onTask;
    this.onState = onState;
    this.onLog = () => {};
  }

  _ws       = null;
  _stopped  = false;
  _replaced = false;
  _connected = false;
  _backoff  = 1000;
  _lastInbound = 0;
  _hbTimer  = null;

  get isConnected() { return this._connected; }

  start() {
    this._stopped = false;
    this._replaced = false;
    this._runLoop();
  }

  stop() {
    this._stopped = true;
    clearTimeout(this._hbTimer);
    this._ws?.close();
    this._ws = null;
    this._setConnected(false);
  }

  sendHello() { this._send(JSON.stringify(this._buildHello())); }

  sendResultOk(requestId, result) {
    const msg = { v: 1, type: 'result', requestId, ok: true, result };
    console.log('[sendResultOk] keys:', Object.keys(result || {}), 'msg len:', JSON.stringify(msg).length);
    this._send(JSON.stringify(msg));
  }

  sendResultError(requestId, code, message) {
    this._send(JSON.stringify({
      v: 1, type: 'result', requestId, ok: false,
      error: { code, message },
    }));
  }

  async _runLoop() {
    while (!this._stopped && !this._replaced) {
      this._ws = null;

      try {
        const ws = new WebSocket(this.url);

        // Track connection state for this iteration
        let opened = false;
        let closed = false;

        ws.onopen = () => {
          this.onLog('  → onopen');
          if (closed) return; // stale, ignore
          opened = true;
          this._ws = ws;
          this._lastInbound = this._now();
          this._setConnected(true);
          this.sendHello();
          this._startHeartbeat();
        };

        ws.onerror = () => {
          this.onLog('  → onerror');
          if (opened || closed) return; // stale
          // Pre-open failure: close will fire anyway, but guard against double-close
          try { ws.close(); } catch {}
        };

        ws.onclose = (e) => {
          this.onLog(`  → onclose code=${e.code} reason="${e.reason}" wasClean=${e.wasClean}`);
          if (closed) return; // already handled
          closed = true;
          // Clear ws ref so heartbeat and other checks know it's gone
          if (this._ws === ws) this._ws = null;
          if (e.code === 4000) {
            this._replaced = true;
            this.onLog('TOKEN REPLACED (close 4000) — stopping reconnects');
          }
          this._setConnected(false);
          clearTimeout(this._hbTimer);
        };

        ws.onmessage = (ev) => this._handleFrame(ev.data);

        // Wait for connection to close (onclose always fires, either from error or normal)
        await new Promise((resolve) => {
          const check = () => {
            if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
              resolve();
            } else {
              setTimeout(check, 200);
            }
          };
          check();
        });

        // onclose already handled cleanup above; just check if we should reconnect
        this.onLog(`  → loop check: _replaced=${this._replaced} _stopped=${this._stopped} _ws=${this._ws ? 'exists' : 'null'}`);
        if (this._stopped || this._replaced) break;

        // Only reconnect if we actually connected (onopen fired)
        // and the connection was closed normally (not replaced)
        if (opened && !this._replaced && !this._stopped) {
          this.onLog(`  → reconnecting in ${this._backoff}ms`);
          await this._delay(this._backoff);
          this._backoff = Math.min(this._backoff * 2, BACKOFF_CAP);
        }
      } catch (e) {
        this.onLog(`connection error: ${e.message}`);
        await this._delay(this._backoff);
        this._backoff = Math.min(this._backoff * 2, BACKOFF_CAP);
      }
    }
    this.onLog(`connection loop ended (stopped=${this._stopped} replaced=${this._replaced})`);
  }

  _startHeartbeat() {
    clearTimeout(this._hbTimer);
    this._hbTimer = setTimeout(() => this._tick(), HEARTBEAT_MS);
  }

  _tick() {
    if (this._stopped || !this._ws) return;
    if (this._now() - this._lastInbound > WATCHDOG_MS) {
      this.onLog(`watchdog: server silent >${WATCHDOG_MS}ms, dropping`);
      this._ws.close();
      return;
    }
    this._send('{"v":1,"type":"ping"}');
    this._startHeartbeat();
  }

  _handleFrame(data) {
    this._lastInbound = this._now();
    let msg;
    try { msg = typeof data === 'string' ? JSON.parse(data) : data; } catch { return; }
    if (msg?.v !== 1) return;
    if (msg.type === 'pong') return;
    if (msg.type === 'task') {
      const { requestId, task } = msg;
      if (typeof requestId !== 'string' || !task?.type) return;
      this._onTask(requestId, task.type, task.payload ?? {});
    }
  }

  _send(text) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      try { this._ws.send(text); }
      catch (e) { this.onLog(`send failed: ${e.message}`); }
    }
  }

  _setConnected(v) {
    if (this._connected === v) return;
    this._connected = v;
    this.onState?.(v);
  }

  _now() { return performance.now() + (Date.now() - this._bootTime); }
  _bootTime = Date.now() - performance.now();
  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}
