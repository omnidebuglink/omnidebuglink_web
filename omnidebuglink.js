/**
 * OmniDebugLink Web Client SDK — main entry point.
 *
 * Usage:
 *   import { OmniDebugLink } from './omnidebuglink.js';
 *   OmniDebugLink.start('wss://api.omnidebuglink.dev/ws?token=<clientToken>');
 */

import { LinkConnection } from './link-connection.js';
import { TaskRegistry }   from './task-registry.js';
import { LogBuffer }      from './log-buffer.js';
import { registerBasics } from './tasks-basics.js';
import { registerUi }     from './tasks-ui.js';
import { registerInput }  from './tasks-input.js';
import { registerDevice } from './tasks-device.js';

export const LIB_VERSION = '0.1.1';

export class OmniDebugLink {
  static actionsEnabled = true;
  static state = 'stopped';
  static tasks = new TaskRegistry();
  static _logBuffer = new LogBuffer();
  static LIB_VERSION = LIB_VERSION; // exported for sample page display

  static _conn  = null;
  static _started = false;

  /**
   * @param {string} url  e.g. "wss://api.omnidebuglink.dev/ws?token=<clientToken>"
   */
  static start(url) {
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

    const conn = new LinkConnection(url, buildHello, onTask, onState);
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
