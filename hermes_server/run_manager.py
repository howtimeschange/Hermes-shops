from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from agent.display import build_tool_preview
from hermes_state import SessionDB
from hermes_cli.config import load_config, save_config, save_env_value
from hermes_cli.auth import PROVIDER_REGISTRY
from hermes_cli.runtime_provider import resolve_runtime_provider
from tools import terminal_tool as _terminal_tool
from tools.terminal_tool import register_task_env_overrides
from toolsets import TOOLSETS

logger = logging.getLogger(__name__)


def _extract_model_config() -> Dict[str, Any]:
    config = load_config()
    model_cfg = config.get("model")
    if isinstance(model_cfg, dict):
        cfg = dict(model_cfg)
        if not cfg.get("default") and cfg.get("model"):
            cfg["default"] = cfg.get("model")
        return cfg
    if isinstance(model_cfg, str) and model_cfg.strip():
        return {"default": model_cfg.strip()}
    return {}


def _default_model_name() -> str:
    cfg = _extract_model_config()
    return str(cfg.get("default") or "").strip()


def _provider_is_configured() -> bool:
    try:
        runtime = resolve_runtime_provider()
        provider = str(runtime.get("provider") or "").strip()
        api_key = str(runtime.get("api_key") or "").strip()
        return bool(provider and api_key)
    except Exception:
        return False


def _tool_result_is_error(result: str) -> bool:
    if not result:
        return False
    if isinstance(result, str) and result.startswith("Error"):
        return True
    try:
        payload = json.loads(result)
        if isinstance(payload, dict) and payload.get("error"):
            return True
    except Exception:
        pass
    return False


@dataclass
class PendingApproval:
    request_id: str
    command: str
    description: str
    cwd: str
    event: threading.Event = field(default_factory=threading.Event)
    decision: Optional[str] = None


@dataclass
class PendingClarify:
    request_id: str
    question: str
    choices: list[str]
    event: threading.Event = field(default_factory=threading.Event)
    answer: Optional[str] = None


@dataclass
class DesktopRun:
    run_id: str
    session_id: str
    cwd: Optional[str]
    model: str
    queue: "asyncio.Queue[Optional[Dict[str, Any]]]"
    loop: asyncio.AbstractEventLoop
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    status: str = "starting"
    last_seq: int = 0
    task: Optional[asyncio.Task] = None
    agent: Any = None
    finished_at: Optional[float] = None
    cancel_requested: bool = False
    pending_approval_id: Optional[str] = None
    pending_clarify_id: Optional[str] = None
    approvals: Dict[str, PendingApproval] = field(default_factory=dict)
    clarifies: Dict[str, PendingClarify] = field(default_factory=dict)
    tool_start_times: Dict[str, float] = field(default_factory=dict)
    tool_names: Dict[str, str] = field(default_factory=dict)


class RunManager:
    _RUN_TTL_SECONDS = 300
    _MAX_CONCURRENT_RUNS = 1

    def __init__(self):
        self._runs: Dict[str, DesktopRun] = {}
        self._lock = asyncio.Lock()
        self._sweeper_task: Optional[asyncio.Task] = None
        self._session_db: Optional[SessionDB] = None

    def _ensure_session_db(self) -> SessionDB:
        if self._session_db is None:
            self._session_db = SessionDB()
        return self._session_db

    def _push_event(self, run: DesktopRun, event_type: str, **payload: Any) -> None:
        run.last_seq += 1
        run.updated_at = time.time()
        event = {
            "event": event_type,
            "runId": run.run_id,
            "sessionId": run.session_id,
            "seq": run.last_seq,
            "timestamp": run.updated_at,
            **payload,
        }
        try:
            run.loop.call_soon_threadsafe(run.queue.put_nowait, event)
        except RuntimeError:
            logger.debug("Run loop closed while pushing event for %s", run.run_id)

    def _close_stream(self, run: DesktopRun) -> None:
        run.finished_at = run.finished_at or time.time()
        try:
            run.loop.call_soon_threadsafe(run.queue.put_nowait, None)
        except RuntimeError:
            logger.debug("Run loop closed while closing stream for %s", run.run_id)

    def _create_agent(
        self,
        *,
        run: DesktopRun,
        toolset_name: Optional[str],
        stream_delta_callback,
        tool_progress_callback,
        tool_start_callback,
        tool_complete_callback,
        clarify_callback,
    ):
        from run_agent import AIAgent

        model_cfg = _extract_model_config()
        config_provider = str(model_cfg.get("provider") or "").strip().lower()
        requested_model = run.model or str(model_cfg.get("default") or "").strip()

        kwargs: Dict[str, Any] = {
            "platform": "desktop",
            "quiet_mode": True,
            "session_id": run.session_id,
            "model": requested_model,
            "stream_delta_callback": stream_delta_callback,
            "tool_progress_callback": tool_progress_callback,
            "tool_start_callback": tool_start_callback,
            "tool_complete_callback": tool_complete_callback,
            "clarify_callback": clarify_callback,
            "session_db": self._ensure_session_db(),
        }

        resolved_toolset = toolset_name or "hermes-desktop"
        if resolved_toolset not in TOOLSETS:
            resolved_toolset = "hermes-api-server"
        kwargs["enabled_toolsets"] = [resolved_toolset]

        try:
            runtime = resolve_runtime_provider(requested=config_provider or None)
            kwargs.update(
                {
                    "provider": runtime.get("provider"),
                    "api_mode": runtime.get("api_mode"),
                    "base_url": runtime.get("base_url"),
                    "api_key": runtime.get("api_key"),
                    "command": runtime.get("command"),
                    "args": list(runtime.get("args") or []),
                }
            )
        except Exception:
            logger.debug("Desktop sidecar falling back to default provider resolution", exc_info=True)

        return AIAgent(**kwargs)

    async def start_run(
        self,
        *,
        session_id: str,
        user_input: str,
        cwd: Optional[str],
        model: Optional[str],
        toolset_name: Optional[str],
        instructions: Optional[str],
    ) -> DesktopRun:
        async with self._lock:
            active_runs = sum(
                1 for run in self._runs.values()
                if run.finished_at is None and not run.cancel_requested
            )
            if active_runs >= self._MAX_CONCURRENT_RUNS:
                raise RuntimeError("Too many concurrent runs")

            loop = asyncio.get_running_loop()
            run_id = f"run_{uuid.uuid4().hex}"
            resolved_model = (model or _default_model_name() or "").strip()
            run = DesktopRun(
                run_id=run_id,
                session_id=session_id,
                cwd=cwd,
                model=resolved_model,
                queue=asyncio.Queue(),
                loop=loop,
            )
            self._runs[run_id] = run

        db = self._ensure_session_db()
        db.create_session(
            session_id=session_id,
            source="desktop",
            model=resolved_model or None,
            model_config={"cwd": cwd} if cwd else None,
        )
        if cwd:
            register_task_env_overrides(session_id, {"cwd": cwd})

        self._push_event(
            run,
            "run.started",
            model=resolved_model,
            cwd=cwd,
        )

        text_buffer: list[str] = []

        def _text_cb(delta: Optional[str]) -> None:
            if delta is None or run.cancel_requested:
                return
            text_buffer.append(delta)
            self._push_event(run, "message.delta", delta=delta)

        def _progress_cb(event_type: str, tool_name: str = None, preview: str = None, args=None, **kwargs) -> None:
            if run.cancel_requested:
                return
            if event_type == "reasoning.available":
                self._push_event(run, "reasoning.available", text=preview or "")

        def _tool_start_cb(call_id: str, tool_name: str, args: Dict[str, Any]) -> None:
            if run.cancel_requested:
                return
            run.tool_start_times[call_id] = time.time()
            run.tool_names[call_id] = tool_name
            preview = build_tool_preview(tool_name, args) or tool_name
            self._push_event(
                run,
                "tool.started",
                tool=tool_name,
                callId=call_id,
                preview=preview,
            )

        def _tool_complete_cb(call_id: str, tool_name: str, args: Dict[str, Any], result: str) -> None:
            start = run.tool_start_times.get(call_id, time.time())
            duration = max(0.0, time.time() - start)
            self._push_event(
                run,
                "tool.completed",
                tool=tool_name,
                callId=call_id,
                duration=round(duration, 3),
                error=_tool_result_is_error(result),
            )

        def _approval_cb(command: str, description: str) -> str:
            request_id = f"apr_{uuid.uuid4().hex[:8]}"
            pending = PendingApproval(
                request_id=request_id,
                command=command,
                description=description,
                cwd=run.cwd or "",
            )
            run.approvals[request_id] = pending
            run.pending_approval_id = request_id
            run.status = "waiting_for_approval"
            self._push_event(
                run,
                "approval.required",
                requestId=request_id,
                tool="terminal",
                title="Dangerous command requires approval",
                description=description,
                riskLevel="high",
                command=command,
                cwd=run.cwd or "",
                options=["allow_once", "allow_session", "allow_workspace", "deny"],
            )
            if not pending.event.wait(timeout=60.0):
                pending.decision = "deny"
            decision = pending.decision or "deny"
            self._push_event(
                run,
                "approval.resolved",
                requestId=request_id,
                decision=decision,
            )
            run.pending_approval_id = None
            run.status = "streaming"
            run.approvals.pop(request_id, None)
            return {
                "allow_once": "once",
                "allow_session": "session",
                "allow_workspace": "always",
                "deny": "deny",
            }.get(decision, "deny")

        def _clarify_cb(question: str, choices: Optional[list[str]]) -> str:
            request_id = f"clr_{uuid.uuid4().hex[:8]}"
            pending = PendingClarify(
                request_id=request_id,
                question=question,
                choices=list(choices or []),
            )
            run.clarifies[request_id] = pending
            run.pending_clarify_id = request_id
            run.status = "waiting_for_clarify"
            self._push_event(
                run,
                "clarify.required",
                requestId=request_id,
                question=question,
                choices=[{"label": choice, "value": choice} for choice in pending.choices],
                allowFreeform=True,
            )
            if not pending.event.wait(timeout=300.0):
                pending.answer = pending.choices[0] if pending.choices else ""
            answer = pending.answer or ""
            self._push_event(
                run,
                "clarify.resolved",
                requestId=request_id,
                answer=answer,
            )
            run.pending_clarify_id = None
            run.status = "streaming"
            run.clarifies.pop(request_id, None)
            return answer

        async def _run_and_stream() -> None:
            previous_approval_cb = getattr(_terminal_tool, "_approval_callback", None)
            try:
                agent = self._create_agent(
                    run=run,
                    toolset_name=toolset_name,
                    stream_delta_callback=_text_cb,
                    tool_progress_callback=_progress_cb,
                    tool_start_callback=_tool_start_cb,
                    tool_complete_callback=_tool_complete_cb,
                    clarify_callback=_clarify_cb,
                )
                run.agent = agent
                run.status = "streaming"
                _terminal_tool.set_approval_callback(_approval_cb)

                def _run_sync():
                    return agent.run_conversation(
                        user_message=user_input,
                        conversation_history=self._ensure_session_db().get_messages_as_conversation(session_id),
                        system_message=instructions,
                        task_id=session_id,
                    )

                result = await asyncio.get_running_loop().run_in_executor(None, _run_sync)
                if run.cancel_requested:
                    run.status = "cancelled"
                    run.finished_at = time.time()
                    self._close_stream(run)
                    return
                run.status = "completed"
                usage = {
                    "inputTokens": getattr(agent, "session_prompt_tokens", 0) or 0,
                    "outputTokens": getattr(agent, "session_completion_tokens", 0) or 0,
                    "totalTokens": getattr(agent, "session_total_tokens", 0) or 0,
                }
                self._push_event(
                    run,
                    "run.completed",
                    output=(result.get("final_response", "") if isinstance(result, dict) else ""),
                    usage=usage,
                )
            except Exception as exc:
                logger.exception("Desktop run %s failed", run.run_id)
                if not run.cancel_requested:
                    run.status = "failed"
                    self._push_event(run, "run.failed", reason=str(exc), error=str(exc))
            finally:
                run.finished_at = time.time()
                try:
                    _terminal_tool.set_approval_callback(previous_approval_cb)
                except Exception:
                    logger.debug("Failed to restore approval callback", exc_info=True)
                self._close_stream(run)

        run.task = asyncio.create_task(_run_and_stream())
        return run

    def get_run(self, run_id: str) -> Optional[DesktopRun]:
        return self._runs.get(run_id)

    def resolve_approval(self, run_id: str, request_id: str, decision: str) -> bool:
        run = self._runs.get(run_id)
        if not run:
            return False
        pending = run.approvals.get(request_id)
        if not pending:
            return False
        pending.decision = decision
        pending.event.set()
        return True

    def resolve_clarify(self, run_id: str, request_id: str, answer: str) -> bool:
        run = self._runs.get(run_id)
        if not run:
            return False
        pending = run.clarifies.get(request_id)
        if not pending:
            return False
        pending.answer = answer
        pending.event.set()
        return True

    def cancel_run(self, run_id: str, reason: str = "user_cancelled") -> bool:
        run = self._runs.get(run_id)
        if not run:
            return False
        run.cancel_requested = True
        run.status = "cancelled"
        if run.pending_approval_id:
            pending = run.approvals.get(run.pending_approval_id)
            if pending:
                pending.decision = "deny"
                pending.event.set()
        if run.pending_clarify_id:
            pending = run.clarifies.get(run.pending_clarify_id)
            if pending:
                pending.answer = ""
                pending.event.set()
        try:
            if run.agent and hasattr(run.agent, "interrupt"):
                run.agent.interrupt()
        except Exception:
            logger.debug("Failed to interrupt run %s", run_id, exc_info=True)
        self._push_event(run, "run.cancelled", reason=reason)
        return True

    async def sweep_runs_forever(self) -> None:
        while True:
            await asyncio.sleep(60)
            cutoff = time.time() - self._RUN_TTL_SECONDS
            stale = [
                run_id for run_id, run in list(self._runs.items())
                if run.finished_at is not None and run.finished_at < cutoff
            ]
            for run_id in stale:
                self._runs.pop(run_id, None)


def save_onboarding_config(
    *,
    provider: str,
    model: str,
    base_url: Optional[str],
    api_key: Optional[str],
    approval_mode: str,
) -> None:
    config = load_config()
    model_cfg = config.get("model")
    if not isinstance(model_cfg, dict):
        model_cfg = {}
    model_cfg["default"] = model
    if provider:
        model_cfg["provider"] = provider
    if base_url:
        model_cfg["base_url"] = base_url
    config["model"] = model_cfg

    approvals = config.get("approvals")
    if not isinstance(approvals, dict):
        approvals = {}
    approvals["mode"] = {
        "ask": "manual",
        "auto_safe": "smart",
        "deny_dangerous": "manual",
    }.get(approval_mode, "manual")
    config["approvals"] = approvals
    save_config(config)

    if api_key and provider in PROVIDER_REGISTRY:
        provider_cfg = PROVIDER_REGISTRY[provider]
        if provider_cfg.api_key_env_vars:
            save_env_value(provider_cfg.api_key_env_vars[0], api_key)
        if base_url and provider_cfg.base_url_env_var:
            save_env_value(provider_cfg.base_url_env_var, base_url)
