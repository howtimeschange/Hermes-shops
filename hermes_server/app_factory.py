from __future__ import annotations

import asyncio
import logging
import secrets
import sys
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from hermes_cli import __version__
from hermes_cli.web_server import app as web_app
from hermes_state import SessionDB
from hermes_server.desktop_state import get_desktop_state_store
from hermes_server.run_manager import (
    RunManager,
    _default_model_name,
    _provider_is_configured,
    save_onboarding_config,
)

logger = logging.getLogger(__name__)


def _get_sidecar_token(app: FastAPI) -> str:
    token = getattr(app.state, "desktop_session_token", "")
    if not token:
        token = secrets.token_urlsafe(32)
        app.state.desktop_session_token = token
    return token


def _get_run_manager(app: FastAPI) -> RunManager:
    manager = getattr(app.state, "desktop_run_manager", None)
    if manager is None:
        manager = RunManager()
        app.state.desktop_run_manager = manager
    return manager


def _merge_desktop_session_meta(session: dict[str, Any]) -> dict[str, Any]:
    model_cfg = session.get("model_config")
    if isinstance(model_cfg, str):
        try:
            import json
            parsed = json.loads(model_cfg)
            if isinstance(parsed, dict) and parsed.get("cwd") and not session.get("cwd"):
                session["cwd"] = parsed.get("cwd")
        except Exception:
            pass
    store = get_desktop_state_store()
    meta = store.get_session_meta(session.get("id", ""))
    if meta.get("cwd") and not session.get("cwd"):
        session["cwd"] = meta.get("cwd")
    return session


def _move_spa_fallback_to_end(app: FastAPI) -> None:
    fallback_routes = [
        route for route in app.router.routes
        if getattr(route, "path", None) == "/{full_path:path}"
    ]
    if not fallback_routes:
        return
    app.router.routes[:] = [
        route for route in app.router.routes
        if getattr(route, "path", None) != "/{full_path:path}"
    ] + fallback_routes


def create_app(*, port: Optional[int] = None) -> FastAPI:
    app = web_app
    if getattr(app.state, "desktop_sidecar_configured", False):
        if port is not None:
            app.state.desktop_port = port
        return app

    app.state.desktop_sidecar_configured = True
    app.state.desktop_port = port or 0
    _get_sidecar_token(app)
    run_manager = _get_run_manager(app)
    state_store = get_desktop_state_store()

    router = APIRouter()

    @app.on_event("startup")
    async def _start_sidecar_tasks() -> None:
        if getattr(app.state, "desktop_sweeper_started", False):
            return
        app.state.desktop_sweeper_started = True
        app.state.desktop_sweeper_task = app.loop.create_task(run_manager.sweep_runs_forever()) if hasattr(app, "loop") else None
        if app.state.desktop_sweeper_task is None:
            import asyncio
            app.state.desktop_sweeper_task = asyncio.create_task(run_manager.sweep_runs_forever())

    @router.get("/desktop/bootstrap")
    async def desktop_bootstrap(request: Request):
        onboarding = state_store.get_onboarding()
        return {
            "app": {
                "name": "Hermes-shops",
                "version": __version__,
                "platform": sys.platform,
                "buildChannel": "stable",
            },
            "auth": {
                "token": _get_sidecar_token(request.app),
            },
            "sidecar": {
                "healthy": True,
                "port": getattr(request.app.state, "desktop_port", 0),
                "profile": "desktop-default",
            },
            "onboarding": {
                "completed": bool(onboarding.get("completed")),
                "providerConfigured": _provider_is_configured(),
                "defaultModel": _default_model_name(),
                "workspace": onboarding.get("workspace"),
                "approvalMode": onboarding.get("approval_mode", "ask"),
            },
            "runtime": {
                "pythonReady": True,
                "nodeReady": True,
                "browserRuntimeReady": True,
            },
        }

    @router.get("/health")
    async def health():
        return {
            "ok": True,
            "service": "hermes-shops-sidecar",
            "version": __version__,
        }

    @router.post("/desktop/onboarding/complete")
    async def complete_onboarding(body: dict[str, Any]):
        provider = str(body.get("provider") or "").strip().lower()
        model = str(body.get("model") or "").strip()
        if not provider or not model:
            raise HTTPException(status_code=422, detail="provider and model are required")
        save_onboarding_config(
            provider=provider,
            model=model,
            base_url=(str(body.get("baseUrl") or "").strip() or None),
            api_key=(str(body.get("apiKey") or "").strip() or None),
            approval_mode=str(body.get("approvalMode") or "ask"),
        )
        state_store.update_onboarding(
            completed=True,
            workspace=(str(body.get("workspace") or "").strip() or None),
            approval_mode=str(body.get("approvalMode") or "ask"),
        )
        return {"ok": True, "onboardingCompleted": True}

    @router.post("/api/sessions")
    async def create_session(body: dict[str, Any]):
        session_id = f"desktop_{secrets.token_hex(8)}"
        title = body.get("title") or "New Chat"
        cwd = body.get("cwd")
        source = body.get("source") or "desktop"
        db = SessionDB()
        try:
            db.create_session(
                session_id=session_id,
                source=source,
                model=_default_model_name() or None,
                model_config={"cwd": cwd} if cwd else None,
            )
            if title:
                try:
                    db.set_session_title(session_id, str(title))
                except Exception:
                    logger.debug("Failed to set title for %s", session_id, exc_info=True)
        finally:
            db.close()
        state_store.update_session_meta(session_id, cwd=(str(cwd).strip() or None) if cwd else None)
        return {"sessionId": session_id, "created": True}

    @router.patch("/api/sessions/{session_id}")
    async def update_session(session_id: str, body: dict[str, Any]):
        db = SessionDB()
        try:
            sid = db.resolve_session_id(session_id)
            if not sid:
                raise HTTPException(status_code=404, detail="Session not found")
            if "title" in body:
                db.set_session_title(sid, str(body.get("title") or ""))
        finally:
            db.close()
        if "cwd" in body:
            state_store.update_session_meta(session_id, cwd=(str(body.get("cwd") or "").strip() or None))
        return {"ok": True}

    @router.post("/v1/runs")
    async def start_run(body: dict[str, Any]):
        session_id = str(body.get("sessionId") or body.get("session_id") or "").strip()
        user_input = str(body.get("input") or "").strip()
        if not session_id:
            raise HTTPException(status_code=422, detail={"error": {"code": "validation_error", "message": "sessionId is required"}})
        if not user_input:
            raise HTTPException(status_code=422, detail={"error": {"code": "validation_error", "message": "input is required"}})
        cwd = str(body.get("cwd") or "").strip() or None
        model = str(body.get("model") or "").strip() or None
        toolset = str(body.get("toolset") or "").strip() or None
        instructions = body.get("instructions")
        if cwd:
            state_store.update_session_meta(session_id, cwd=cwd)
        try:
            run = await run_manager.start_run(
                session_id=session_id,
                user_input=user_input,
                cwd=cwd,
                model=model,
                toolset_name=toolset,
                instructions=str(instructions).strip() if isinstance(instructions, str) and instructions.strip() else None,
            )
        except RuntimeError as exc:
            raise HTTPException(status_code=429, detail={"error": {"code": "rate_limit_exceeded", "message": str(exc)}})
        return {"runId": run.run_id, "sessionId": run.session_id, "status": "started"}

    @router.get("/v1/runs/{run_id}")
    async def get_run(run_id: str):
        run = run_manager.get_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail={"error": {"code": "run_not_found", "message": f"Run not found: {run_id}"}})
        return {
            "runId": run.run_id,
            "sessionId": run.session_id,
            "status": run.status,
            "startedAt": run.created_at,
            "lastEventSeq": run.last_seq,
            "pendingApprovalId": run.pending_approval_id,
            "pendingClarifyId": run.pending_clarify_id,
        }

    @router.get("/v1/runs/{run_id}/events")
    async def run_events(run_id: str):
        run = run_manager.get_run(run_id)
        if not run:
            raise HTTPException(status_code=404, detail={"error": {"code": "run_not_found", "message": f"Run not found: {run_id}"}})

        async def _event_stream():
            while True:
                try:
                    event = await asyncio.wait_for(run.queue.get(), timeout=30.0)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    continue
                if event is None:
                    yield ": stream closed\n\n"
                    break
                import json
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

        return StreamingResponse(_event_stream(), media_type="text/event-stream")

    @router.post("/v1/runs/{run_id}/cancel")
    async def cancel_run(run_id: str, body: dict[str, Any]):
        if not run_manager.cancel_run(run_id, reason=str(body.get("reason") or "user_cancelled")):
            raise HTTPException(status_code=404, detail={"error": {"code": "run_not_found", "message": f"Run not found: {run_id}"}})
        return {"ok": True}

    @router.post("/v1/runs/{run_id}/approval")
    async def resolve_approval(run_id: str, body: dict[str, Any]):
        request_id = str(body.get("requestId") or "").strip()
        decision = str(body.get("decision") or "deny").strip()
        if not request_id:
            raise HTTPException(status_code=422, detail={"error": {"code": "validation_error", "message": "requestId is required"}})
        if not run_manager.resolve_approval(run_id, request_id, decision):
            raise HTTPException(status_code=404, detail={"error": {"code": "approval_not_found", "message": f"Approval request not found: {request_id}"}})
        return {"ok": True, "requestId": request_id}

    @router.post("/v1/runs/{run_id}/clarify")
    async def resolve_clarify(run_id: str, body: dict[str, Any]):
        request_id = str(body.get("requestId") or "").strip()
        answer = str(body.get("answer") or "")
        if not request_id:
            raise HTTPException(status_code=422, detail={"error": {"code": "validation_error", "message": "requestId is required"}})
        if not run_manager.resolve_clarify(run_id, request_id, answer):
            raise HTTPException(status_code=404, detail={"error": {"code": "clarify_not_found", "message": f"Clarify request not found: {request_id}"}})
        return {"ok": True, "requestId": request_id}

    app.include_router(router)
    _move_spa_fallback_to_end(app)
    return app
