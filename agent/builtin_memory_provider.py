"""Builtin memory provider shim.

The built-in MEMORY.md / USER.md store does not currently expose extra tools
through the pluggable memory-provider surface, but tests and the manager expect
there to be a concrete provider object named ``builtin``.
"""

from __future__ import annotations

from typing import Any, Dict, List

from agent.memory_provider import MemoryProvider


class BuiltinMemoryProvider(MemoryProvider):
    """Minimal built-in provider used by MemoryManager orchestration."""

    @property
    def name(self) -> str:
        return "builtin"

    def is_available(self) -> bool:
        return True

    def initialize(self, session_id: str, **kwargs) -> None:
        return None

    def get_tool_schemas(self) -> List[Dict[str, Any]]:
        return []

