import asyncio

import pytest

from hermes_server.app_factory import create_app
from hermes_server.run_manager import DesktopRun, PendingApproval, PendingClarify


@pytest.fixture
def client():
    try:
        from starlette.testclient import TestClient
    except ImportError:
        pytest.skip("fastapi/starlette not installed")

    app = create_app(port=8765)
    manager = app.state.desktop_run_manager
    manager._runs.clear()
    with TestClient(app) as test_client:
        yield test_client


def test_desktop_bootstrap_is_served_before_spa_fallback(client):
    response = client.get("/desktop/bootstrap")

    assert response.status_code == 200
    payload = response.json()
    assert payload["app"]["name"] == "Hermes-shops"
    assert payload["sidecar"]["healthy"] is True


def test_desktop_session_routes_round_trip(client):
    create_response = client.post(
        "/api/sessions",
        json={"title": "Desktop Test", "cwd": "/tmp/workspace", "source": "desktop"},
    )

    assert create_response.status_code == 200
    session_id = create_response.json()["sessionId"]

    list_response = client.get("/api/sessions")
    assert list_response.status_code == 200
    assert any(session["id"] == session_id for session in list_response.json())

    messages_response = client.get(f"/api/sessions/{session_id}/messages")
    assert messages_response.status_code == 200
    assert messages_response.json()["session_id"] == session_id


def test_run_routes_support_stream_approval_clarify_and_cancel(client):
    app = client.app
    manager = app.state.desktop_run_manager

    async def fake_start_run(*, session_id, user_input, cwd, model, toolset_name, instructions):
        loop = asyncio.get_running_loop()
        run = DesktopRun(
            run_id="run_test123",
            session_id=session_id,
            cwd=cwd,
            model=model or "test-model",
            queue=asyncio.Queue(),
            loop=loop,
        )
        run.status = "streaming"
        manager._runs[run.run_id] = run
        await run.queue.put(
            {
                "event": "run.started",
                "runId": run.run_id,
                "sessionId": session_id,
                "seq": 1,
                "timestamp": 1.0,
                "model": run.model,
                "cwd": cwd,
            }
        )
        await run.queue.put(
            {
                "event": "message.delta",
                "runId": run.run_id,
                "sessionId": session_id,
                "seq": 2,
                "timestamp": 2.0,
                "delta": "hello",
            }
        )
        await run.queue.put(None)
        return run

    manager.start_run = fake_start_run

    create_session = client.post("/api/sessions", json={"title": "Run Test", "cwd": "/tmp/workspace", "source": "desktop"})
    session_id = create_session.json()["sessionId"]

    start_response = client.post(
        "/v1/runs",
        json={"sessionId": session_id, "input": "test run", "cwd": "/tmp/workspace", "model": "test-model"},
    )
    assert start_response.status_code == 200
    run_id = start_response.json()["runId"]

    get_response = client.get(f"/v1/runs/{run_id}")
    assert get_response.status_code == 200
    assert get_response.json()["status"] == "streaming"

    with client.stream("GET", f"/v1/runs/{run_id}/events") as stream_response:
        body = "".join(stream_response.iter_text())
    assert stream_response.status_code == 200
    assert '"event": "run.started"' in body
    assert '"event": "message.delta"' in body

    run = manager._runs[run_id]
    approval = PendingApproval(
        request_id="apr_1",
        command="rm -rf /tmp/example",
        description="danger",
        cwd="/tmp/workspace",
    )
    run.approvals["apr_1"] = approval
    run.pending_approval_id = "apr_1"

    approval_response = client.post(
        f"/v1/runs/{run_id}/approval",
        json={"requestId": "apr_1", "decision": "allow_once"},
    )
    assert approval_response.status_code == 200
    assert approval.event.is_set()
    assert approval.decision == "allow_once"

    clarify = PendingClarify(
        request_id="clr_1",
        question="Which file?",
        choices=["a", "b"],
    )
    run.clarifies["clr_1"] = clarify
    run.pending_clarify_id = "clr_1"

    clarify_response = client.post(
        f"/v1/runs/{run_id}/clarify",
        json={"requestId": "clr_1", "answer": "a"},
    )
    assert clarify_response.status_code == 200
    assert clarify.event.is_set()
    assert clarify.answer == "a"

    cancel_response = client.post(
        f"/v1/runs/{run_id}/cancel",
        json={"reason": "user_cancelled"},
    )
    assert cancel_response.status_code == 200
    assert run.cancel_requested is True
