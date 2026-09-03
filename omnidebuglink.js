/**
 * OmniDebugLink Web Client SDK — main entry point.
 *
 * Usage:
 *   import { OmniDebugLink } from './omnidebuglink.js';
 *   OmniDebugLink.start('<clientToken>');
 */

const DEFAULT_WS_URL = 'wss://api.omnidebuglink.dev/ws';

/**
 * start() accepts either a bare device token (built against the default
 * relay) or a full ws URL — v0.1.x call sites passed the complete URL, and a
 * full URL doubles as the self-hosted-relay override. Passing a URL by
 * mistake is the #1 integration error since v0.2.0 (it used to be mandatory),
 * so both forms work and the unusual one logs a hint.
 */
function buildConnectUrl(tokenOrUrl) {
  if (typeof tokenOrUrl !== 'string' || tokenOrUrl.trim() === '') {
    throw new Error('OmniDebugLink.start(token): token is required (get it from the device console / device_detail)');
  }
  const v = tokenOrUrl.trim();
  if (/^wss?:\/\//i.test(v)) {
    console.warn('[omnidebuglink] start() got a full URL — pass the bare device token instead (the relay URL is built in)');
    return v;
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
   * @param {string} token  device token from the console. A full ws URL
   *                        (ws:// / wss://, v0.1.x style or a self-hosted
   *                        relay) is also accepted and used as-is.
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
