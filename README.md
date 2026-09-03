# omnidebuglink (Web)

OmniDebugLink client SDK for the web: connect any web page to the
OmniDebugLink relay so AI coding tools (via MCP) can debug and automate it
directly — DOM traversal (including shadow DOM), synthetic clicks/swipes,
viewport screenshots, console log reading, preference read/write and more.

Pure ES module, zero dependencies. html2canvas 1.4.1 is bundled into the
release builds.

## Install

CDN (IIFE, exposes a global `OmniDebugLink`):

```html
<!-- no @version = always serves the latest release -->
<script src="https://cdn.jsdelivr.net/gh/omnidebuglink/omnidebuglink_web/dist/omnidebuglink.min.js"></script>
<script>OmniDebugLink.start('<clientToken>')</script>
```

ESM import:

```js
import { OmniDebugLink } from 'https://cdn.jsdelivr.net/gh/omnidebuglink/omnidebuglink_web/dist/omnidebuglink.esm.min.js';
```

To lock a specific release (reproducible builds), add the tag: `…@v0.2.4/dist/…`.

Source module (no bundling):

```html
<script type="module">
  import { OmniDebugLink } from './omnidebuglink.js';
  OmniDebugLink.start('<clientToken>');
</script>
```

API: `OmniDebugLink.start(token)` — the relay URL is baked in / `stop()` / `actionsEnabled` (read-only
observation mode when false, announced with hello) /
`tasks.register(type, handler, description, payloadSchema)`.

**One token pair per device seat** — on close code 4000 (replaced by a
newer connection with the same token) the SDK stops reconnecting
permanently.

## Built-in tasks (17)

Read: `ui_traverse` (DOM + shadow DOM snapshot, flat list, 3000-node cap) /
`find_objects` (tag/id/className/data-testid/text substring, center 0-1) /
`view_component` / `wait_for` / `screenshot` (viewport by default —
coordinates stay in the same system as find_objects/tap_screen;
`fullPage:true` captures the whole document) / `read_logs` (console ring
buffer with level/contains/limit/sinceMs filters) / `get_state` / `get_perf` /
`prefs` (localStorage)
Write: `ui_click` / `tap_screen` / `swipe` (PointerEvent + native-behavior
compensation: scrolls the nearest scrollable ancestor, resolves range
sliders by x) / `long_press` / `input_text` (prototype-setter write, React
controlled components supported) / `send_key`
Basics: `echo` / `ping` / `get_stats`

Coordinates: normalized 0-1, **top-left origin** (same as
Android/Flutter/iOS; Unity is bottom-left).

## Samples

- `Sample/web/` — plain HTML page (source mode + dist mode)
- `Sample/react/` — Vite + React + Capacitor Android example

## Known limitations

- Synthetic events are untrusted: native side effects are compensated where
  practical (scroll, range sliders, paging keys); the rest needs page-level
  handling
- Cross-origin iframes cannot be captured or traversed (SecurityError)
- Background-tab throttling clamps timers to ~1/min in Chrome; multi-step
  gestures are timestamp-driven and catch up on wake
- html2canvas drops CSS rules that fail to parse; for pixel-exact checks
  prefer ui_traverse

## License

Released under the [MIT License](LICENSE).
