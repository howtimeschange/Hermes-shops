#!/usr/bin/env python3
"""Build a private Node + browser runtime bundle for Hermes-shops.

This downloads a portable Node.js runtime for the current platform, installs
``agent-browser`` into that private runtime, and pre-fetches Chromium so the
desktop app can use browser automation without asking the user to install
anything manually.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / "desktop" / "dist" / "node-runtime"
DEFAULT_NODE_VERSION = os.getenv("HERMES_DESKTOP_NODE_VERSION", "20.19.0")


def _run(cmd: list[str], *, cwd: Path | None = None, env: dict[str, str] | None = None) -> None:
    print("→", " ".join(cmd))
    subprocess.run(cmd, cwd=cwd or ROOT, env=env, check=True)


def _read_root_browser_version() -> str:
    package_json = ROOT / "package.json"
    data = json.loads(package_json.read_text(encoding="utf-8"))
    version = data.get("dependencies", {}).get("agent-browser")
    if not version:
        raise SystemExit("package.json does not declare an agent-browser dependency.")
    return version


def _detect_node_target() -> tuple[str, str, str]:
    system = platform.system().lower()
    machine = platform.machine().lower()

    if system == "darwin":
        target_os = "darwin"
        archive_ext = "tar.gz"
        if machine in {"arm64", "aarch64"}:
            target_arch = "arm64"
        elif machine in {"x86_64", "amd64"}:
            target_arch = "x64"
        else:
            raise SystemExit(f"Unsupported macOS architecture: {machine}")
        return target_os, target_arch, archive_ext

    if system == "windows":
        target_os = "win"
        archive_ext = "zip"
        if machine in {"amd64", "x86_64"}:
            target_arch = "x64"
        elif machine in {"arm64", "aarch64"}:
            target_arch = "arm64"
        else:
            raise SystemExit(f"Unsupported Windows architecture: {machine}")
        return target_os, target_arch, archive_ext

    raise SystemExit(f"Hermes-shops desktop builds are only supported on macOS and Windows, not {system!r}.")


def _download_node_archive(version: str, *, download_dir: Path) -> tuple[Path, str]:
    target_os, target_arch, archive_ext = _detect_node_target()
    archive_name = f"node-v{version}-{target_os}-{target_arch}"
    url = f"https://nodejs.org/dist/v{version}/{archive_name}.{archive_ext}"
    archive_path = download_dir / f"{archive_name}.{archive_ext}"
    print(f"↓ Downloading {url}")
    urllib.request.urlretrieve(url, archive_path)
    return archive_path, archive_name


def _extract_archive(archive_path: Path, archive_name: str, *, output_dir: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="hermes-node-extract-") as tmp:
        tmp_path = Path(tmp)
        if archive_path.suffix == ".zip":
            with zipfile.ZipFile(archive_path) as zf:
                zf.extractall(tmp_path)
        else:
            with tarfile.open(archive_path, mode="r:*") as tf:
                tf.extractall(tmp_path)

        extracted_root = tmp_path / archive_name
        if not extracted_root.exists():
            candidates = [p for p in tmp_path.iterdir() if p.is_dir()]
            if len(candidates) != 1:
                raise SystemExit(f"Could not locate extracted Node runtime in {tmp_path}")
            extracted_root = candidates[0]

        for child in extracted_root.iterdir():
            destination = output_dir / child.name
            if destination.exists():
                if destination.is_dir():
                    shutil.rmtree(destination)
                else:
                    destination.unlink()
            shutil.move(str(child), str(destination))


def _node_executables(output_dir: Path) -> tuple[Path, Path, Path]:
    if os.name == "nt":
        return (
            output_dir / "node.exe",
            output_dir / "npm.cmd",
            output_dir / "npx.cmd",
        )

    return (
        output_dir / "bin" / "node",
        output_dir / "bin" / "npm",
        output_dir / "bin" / "npx",
    )


def _agent_browser_cli(output_dir: Path) -> Path:
    if os.name == "nt":
        return output_dir / "node_modules" / ".bin" / "agent-browser.cmd"
    return output_dir / "node_modules" / ".bin" / "agent-browser"


def build_node_runtime_bundle(output_dir: Path, *, clean: bool, node_version: str) -> Path:
    if clean and output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="hermes-node-download-") as tmp:
        archive_path, archive_name = _download_node_archive(node_version, download_dir=Path(tmp))
        _extract_archive(archive_path, archive_name, output_dir=output_dir)

    node_exe, npm_exe, npx_exe = _node_executables(output_dir)
    missing = [str(path) for path in (node_exe, npm_exe, npx_exe) if not path.exists()]
    if missing:
        raise SystemExit(f"Node runtime bundle is incomplete, missing: {', '.join(missing)}")

    agent_browser_version = _read_root_browser_version()
    package_json = output_dir / "package.json"
    package_json.write_text(
        json.dumps(
            {
                "name": "hermes-shops-browser-runtime",
                "private": True,
                "version": "1.0.0",
                "description": "Bundled browser runtime for Hermes-shops",
                "dependencies": {
                    "agent-browser": agent_browser_version,
                },
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    env = os.environ.copy()
    env["PLAYWRIGHT_BROWSERS_PATH"] = str(output_dir / "ms-playwright")
    env.setdefault("npm_config_fund", "false")
    env.setdefault("npm_config_audit", "false")

    _run([str(npm_exe), "install", "--omit=dev"], cwd=output_dir, env=env)
    _run([str(_agent_browser_cli(output_dir)), "install"], cwd=output_dir, env=env)

    manifest = output_dir / "manifest.txt"
    manifest.write_text(
        "\n".join(
            [
                "product=Hermes-shops",
                f"node={node_exe}",
                f"npm={npm_exe}",
                f"agent_browser={agent_browser_version}",
                f"playwright_browsers={env['PLAYWRIGHT_BROWSERS_PATH']}",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"✓ Browser runtime bundle ready at {output_dir}")
    return output_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the Hermes-shops browser runtime bundle")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--node-version", default=DEFAULT_NODE_VERSION)
    parser.add_argument("--no-clean", action="store_true")
    args = parser.parse_args()
    build_node_runtime_bundle(args.output, clean=not args.no_clean, node_version=args.node_version)


if __name__ == "__main__":
    main()
