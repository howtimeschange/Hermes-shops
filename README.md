# Hermes-shops

Hermes-shops is a desktop-first distribution of the Hermes agent stack. It packages:

- the Hermes Python sidecar
- the web chat frontend
- a private Node + browser runtime for browser automation
- Electron installers for macOS and Windows

The goal is simple: clone the repo, build, and ship a working desktop app without asking end users to install Python, Node, Playwright, or Chromium themselves.

## What Ships

- `desktop/` contains the Electron shell and packaging config.
- `hermes_server/` exposes the local desktop sidecar API used by the app.
- `web/` provides the desktop chat and onboarding UI.
- `desktop/scripts/build_sidecar_bundle.py` builds the bundled Python runtime.
- `desktop/scripts/build_node_runtime_bundle.py` builds the bundled Node/browser runtime.
- `.github/workflows/hermes-shops-desktop.yml` builds installers and drafts releases for `hermes-shops-v*` tags.

## Local Development

Python:

```bash
source .venv/bin/activate
python -m pytest tests -q
```

Frontend and desktop dependencies:

```bash
npm ci
npm --prefix web ci
npm --prefix desktop ci
```

Run the desktop shell in development:

```bash
npm --prefix desktop run dev
```

Build local installers:

```bash
npm --prefix desktop run dist
```

## Release Flow

1. Push the `main` branch to `howtimeschange/Hermes-shops`.
2. Create a release tag such as `hermes-shops-vX.Y.Z`.
3. Push the tag.
4. GitHub Actions builds the desktop artifacts and opens a draft release.

Example:

```bash
git push origin main
git tag hermes-shops-vX.Y.Z
git push origin hermes-shops-vX.Y.Z
```

## Notes

- The underlying Hermes agent core remains in this repository so the desktop app can ship a self-contained sidecar.
- Browser automation depends on the bundled runtime under `desktop/dist/node-runtime`, not on a system-wide Node install.
- Release artifacts are intentionally excluded from git; rebuild them locally or via CI.
