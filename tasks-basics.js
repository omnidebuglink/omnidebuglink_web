/**
 * Built-in basic tasks: echo, ping, get_stats.
 */

import { LIB_VERSION } from './version.js';

export function registerBasics(registry, actionsEnabled, logBuffer) {
  registry.register('echo', (p) => ({ echo: p.text ?? 'pong' }),
    'Echoes back the provided text. Payload: { text: string } (default "pong").');

  registry.register('ping', () => ({ ts: Date.now() }),
    'Pings the device, returns server timestamp. Used for latency checks.');

  registry.register('get_stats', () => ({
    libVersion: LIB_VERSION,
    actionsEnabled,
    connected: true,
    platform: navigator.userAgent,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
  }),
    'Returns basic connection stats (lib version, platform, online status).');
}
