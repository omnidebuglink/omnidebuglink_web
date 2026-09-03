/**
 * OmniDebugLink Web Client SDK — main entry point.
 *
 * Usage:
 *   import { OmniDebugLink } from './omnidebuglink.js';
 *   OmniDebugLink.start('<clientToken>');
 */

const DEFAULT_WS_URL = 'wss://api.omnidebuglink.dev/ws';

/**
 * start() takes ONLY the bare device token — the relay URL is built in,
 * exactly like every other OmniDebugLink client SDK. A full ws URL is
 * rejected with a clear message instead of being silently misused (the #1
 * integration error coming from v0.1.x, where start() took a URL).
 */
function buildConnectUrl(token) {
  if (typeof token !== 'string' || token.trim() === '') {
    throw new Error('OmniDebugLink.start(token): a bare device token is required (get it from the device console / device_detail)');
  }
  const v = token.trim();
  if (/^wss?:\/\//i.test(v)) {
    throw new Error('OmniDebugLink.start(token): pass the bare device token (odl-dev-…), NOT a URL — the relay URL is built in since v0.2.0');
  }
  return `${DEFAULT_WS_URL}?token=${encodeURIComponent(v)}`;
}

import { LinkConnection } from './link-connection.js';
import { TaskRegistry }   from './task-registry.js';
import { LogBuffer }      from './log-buffer.js';
import { registerBasics } from './tasks-basics.js';
import { registerUi }     from './tasks-ui.js';
import { registerInput }  from './tasks-input.js';
import { registerDevice } from './tasks-device.js';

import { LIB_VERSION } from './version.js';

export { LIB_VERSION };

export class OmniDebugLink {
  static actionsEnabled = true;
  static state = 'stopped';
  static tasks = new TaskRegistry();
  static _logBuffer = new LogBuffer();
  static LIB_VERSION = LIB_VERSION; // exported for sample page display

  static _conn  = null;
  static _started = false;

  /**
   * @param {string} token  bare device token from the console; the relay URL
   *                        is baked in (aligned with all other client SDKs)
   */
  static start(token) {
    if (OmniDebugLink._started) return;
    OmniDebugLink._started = true;

    OmniDebugLink._logBuffer.install();

    const ensureActions = () => {
      if (!OmniDebugLink.actionsEnabled)
        throw new Error('write actions disabled (set OmniDebugLink.actionsEnabled = true)');
    };

    registerBasics(OmniDebugLink.tasks, () => OmniDebugLink.actionsEnabled, OmniDebugLink._logBuffer);
    registerUi(OmniDebugLink.tasks, ensureActions);
    registerInput(OmniDebugLink.tasks, ensureActions);
    registerDevice(OmniDebugLink.tasks, OmniDebugLink._logBuffer);

    const buildHello = () => ({
      v: 1,
      type: 'hello',
      client: {
        platform: 'web',
        version: `${window.location.host} (${navigator.userAgent.split(')').pop()})`,
        libVersion: LIB_VERSION,
        actionsEnabled: OmniDebugLink.actionsEnabled,
      },
      tasks: OmniDebugLink.tasks.snapshot(),
    });

    const onTask = async (requestId, type, payload) => {
      const result = await OmniDebugLink.tasks.run(requestId, type, payload);
      if (result.ok) {
        OmniDebugLink._conn?.sendResultOk(requestId, result.result);
      } else {
        OmniDebugLink._conn?.sendResultError(requestId, result.error.code, result.error.message);
      }
    };

    const onState = (connected) => {
      OmniDebugLink.state = connected ? 'connected' : 'connecting';
      console.log(`[omnidebuglink] ${connected ? 'connected' : 'disconnected'}`);
    };

    const conn = new LinkConnection(
      buildConnectUrl(token),
      buildHello,
      onTask,
      onState,
    );
    OmniDebugLink._conn = conn;
    conn.onLog = (msg) => console.log(`[omnidebuglink] ${msg}`);
    conn.start();
  }

  static stop() {
    OmniDebugLink._conn?.stop();
    OmniDebugLink._conn = null;
    OmniDebugLink.state = 'stopped';
    OmniDebugLink._started = false;
  }
}
