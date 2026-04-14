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
