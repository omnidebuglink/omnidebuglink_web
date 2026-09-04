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

Read tasks:

| Task | What it does |
|---|---|
| `ui_traverse` | DOM + shadow DOM snapshot as a flat list (3000-node cap) with depth/path — token-efficient structure inspection |
| `find_objects` | Search by tag / id / className / data-testid / **text substring**; matches ordered most-specific-first (the element that renders the text, not its ancestors) and include center 0-1 coords |
| `view_component` | One element in depth: rect, computed style, attributes, current form value (property, not attribute) |
| `wait_for` | Poll every 200 ms until a selector appears or text is found; timeout returns `found: false`, not an error |
| `screenshot` | Viewport capture (same coordinate system as find_objects/tap_screen); `fullPage: true` captures the whole document. html2canvas is bundled; SVG foreignObject fallback |
| `read_logs` | Console ring buffer (500 entries, no history before start): level / contains / limit / sinceMs filters |
| `get_state` | url / title / viewport / navigator / performance navigation timing |
| `get_perf` | Navigation timing, named marks, resource counts |
| `prefs` | Read localStorage (get / list) |

Write tasks (all gated by `actionsEnabled`):

| Task | What it does |
|---|---|
| `ui_click` | Delivered physically since v0.2.1: the element's center is hit-tested via `elementFromPoint` and the click fires on whatever actually sits there — overlays (guide masks) receive it like a real tap. Locates by selector or by text; `via`/`clicked` report what happened |
| `tap_screen` | Tap at normalized 0-1 coordinates (top-left origin) via `elementFromPoint` |
| `swipe` | PointerEvent gesture with native-behavior compensation: scrolls the nearest scrollable ancestor, resolves range sliders by x position |
| `long_press` | Pointer down, hold (holdMs), up |
| `input_text` | Writes through the prototype setter (browsers' internal value updates; React controlled components supported via `_valueTracker` reset) |
| `send_key` | Soft-dispatched KeyboardEvent: enter / tab / escape / backspace / arrows; scroll keys compensated when focus is outside forms |
| `prefs` | Write / delete localStorage |

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
