#!/usr/bin/env python3
"""Build a private Python runtime bundle for Hermes-shops.

This creates ``desktop/dist/sidecar/venv`` and installs Hermes with the
desktop-facing extras so Electron can spawn the sidecar without relying on a
system Python.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / "desktop" / "dist" / "sidecar"
DESKTOP_EXTRAS = "web,cron,pty,mcp,acp,honcho"


def _run(cmd: list[str], *, cwd: Path | None = None, env: dict[str, str] | None = None) -> None:
    print("[run]", " ".join(cmd))
    subprocess.run(cmd, cwd=cwd or ROOT, env=env, check=True)


def _venv_python(venv_dir: Path) -> Path:
    if os.name == "nt":
        return venv_dir / "Scripts" / "python.exe"
    for candidate in (venv_dir / "bin" / "python3", venv_dir / "bin" / "python"):
        if candidate.exists():
            return candidate
    return venv_dir / "bin" / "python3"


def build_sidecar_bundle(output_dir: Path, *, clean: bool) -> Path:
    if clean and output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    web_dist = ROOT / "hermes_cli" / "web_dist" / "index.html"
    if not web_dist.exists():
        raise SystemExit(
            "web_dist is missing. Run `npm --prefix web run build` before building the desktop sidecar bundle."
        )

    venv_dir = output_dir / "venv"
    if not venv_dir.exists():
        _run([sys.executable, "-m", "venv", str(venv_dir)])

    python = _venv_python(venv_dir)
    _run([str(python), "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"])
    _run([str(python), "-m", "pip", "install", f"{ROOT}[{DESKTOP_EXTRAS}]"])

    manifest = output_dir / "manifest.txt"
    manifest.write_text(
        "\n".join(
            [
                "product=Hermes-shops",
                f"python={python}",
                f"extras={DESKTOP_EXTRAS}",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"[ok] Sidecar bundle ready at {output_dir}")
    return output_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the Hermes-shops sidecar bundle")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--no-clean", action="store_true")
    args = parser.parse_args()
    build_sidecar_bundle(args.output, clean=not args.no_clean)


if __name__ == "__main__":
    main()
