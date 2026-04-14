## 1.0.5 - 2026-04-14

### Fixes
- Limit desktop release uploads to the actual installable artifacts and updater metadata so tagged Hermes-shops releases produce a clean draft release instead of uploading exploded runtime internals.

## 1.0.4 - 2026-04-14

### Fixes
- Grant `contents: write` to the desktop release publish job so tagged Hermes-shops releases can create draft GitHub releases without manual intervention.

## 1.0.3 - 2026-04-14

### Fixes
- Install bundled browser runtime dependencies under `node-runtime/app/` so Windows desktop builds keep portable Node's bundled npm intact while still exposing `agent-browser` on PATH.

## 1.0.2 - 2026-04-14

### Fixes
- Isolate desktop app-factory session DB state in tests so Windows GitHub Actions workers do not contend on a shared SQLite path during xdist runs.

## 1.0.1 - 2026-04-14

### Fixes
- Replace non-ASCII desktop bundler status glyphs with ASCII output so Windows GitHub Actions runners can build the sidecar bundle successfully.

## 1.0.0 - 2026-04-14

### Features
- Initial Hermes-shops repository bootstrap for the desktop distribution.
- Bundle the Hermes Python sidecar into desktop builds.
- Bundle a private Node + browser runtime with preinstalled `agent-browser` and Playwright assets.
- Add Electron packaging and GitHub Actions release automation for macOS and Windows.

### Fixes
- Stabilize desktop-facing runtime detection, shutdown, browser tooling, approval flow, and session handling for a clean full-test run.
