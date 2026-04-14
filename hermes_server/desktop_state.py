from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any, Dict, Optional

from hermes_cli.config import get_hermes_home


def _default_state() -> Dict[str, Any]:
    return {
        "onboarding": {
            "completed": False,
            "workspace": None,
            "approval_mode": "ask",
        },
        "sessions": {},
    }


class DesktopStateStore:
    """Tiny JSON-backed store for desktop-only state.

    Keeps first-run onboarding state and desktop session metadata (for now just
    per-session cwd).  This avoids invasive SessionDB schema changes while the
    desktop sidecar is still stabilizing.
    """

    def __init__(self, path: Optional[Path] = None):
        self.path = path or (get_hermes_home() / "desktop_state.json")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _read_unlocked(self) -> Dict[str, Any]:
        if not self.path.exists():
            return _default_state()
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                return _default_state()
            state = _default_state()
            state.update(data)
            if not isinstance(state.get("onboarding"), dict):
                state["onboarding"] = _default_state()["onboarding"]
            if not isinstance(state.get("sessions"), dict):
                state["sessions"] = {}
            return state
        except Exception:
            return _default_state()

    def _write_unlocked(self, state: Dict[str, Any]) -> None:
        tmp_path = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp_path.write_text(
            json.dumps(state, ensure_ascii=False, indent=2, sort_keys=True),
            encoding="utf-8",
        )
        tmp_path.replace(self.path)

    def get_state(self) -> Dict[str, Any]:
        with self._lock:
            return self._read_unlocked()

    def get_onboarding(self) -> Dict[str, Any]:
        with self._lock:
            return dict(self._read_unlocked().get("onboarding") or {})

    def update_onboarding(
        self,
        *,
        completed: Optional[bool] = None,
        workspace: Optional[str] = None,
        approval_mode: Optional[str] = None,
    ) -> Dict[str, Any]:
        with self._lock:
            state = self._read_unlocked()
            onboarding = state.setdefault("onboarding", {})
            if completed is not None:
                onboarding["completed"] = bool(completed)
            if workspace is not None:
                onboarding["workspace"] = workspace or None
            if approval_mode is not None:
                onboarding["approval_mode"] = approval_mode
            self._write_unlocked(state)
            return dict(onboarding)

    def get_session_meta(self, session_id: str) -> Dict[str, Any]:
        if not session_id:
            return {}
        with self._lock:
            state = self._read_unlocked()
            sessions = state.get("sessions") or {}
            meta = sessions.get(session_id)
            return dict(meta) if isinstance(meta, dict) else {}

    def all_session_meta(self) -> Dict[str, Dict[str, Any]]:
        with self._lock:
            state = self._read_unlocked()
            sessions = state.get("sessions") or {}
            return {
                sid: dict(meta)
                for sid, meta in sessions.items()
                if isinstance(meta, dict)
            }

    def update_session_meta(
        self,
        session_id: str,
        *,
        cwd: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not session_id:
            return {}
        with self._lock:
            state = self._read_unlocked()
            sessions = state.setdefault("sessions", {})
            meta = sessions.setdefault(session_id, {})
            if cwd is not None:
                meta["cwd"] = cwd or None
            self._write_unlocked(state)
            return dict(meta)


_STORE: Optional[DesktopStateStore] = None


def get_desktop_state_store() -> DesktopStateStore:
    global _STORE
    if _STORE is None:
        _STORE = DesktopStateStore()
    return _STORE
