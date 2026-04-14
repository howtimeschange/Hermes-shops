import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ApprovalDecision,
  ApprovalRequiredEvent,
  ClarifyRequiredEvent,
  RunEvent,
  RunStatus,
} from "@/lib/runs";
import { api } from "@/lib/api";
import { MOCK_RUN_EVENTS } from "@/lib/mocks/run-events";

export interface TimelineEntry {
  id: string;
  type: "thinking" | "tool" | "approval" | "clarify" | "system";
  status: "pending" | "active" | "success" | "error" | "blocked";
  title: string;
  description?: string;
  duration?: number;
  timestamp: number;
}

const USE_MOCK_RUNS = import.meta.env.VITE_USE_MOCK_RUNS === "1";

export function useRunStream() {
  const [runId, setRunId] = useState<string | null>(null);
  const [runState, setRunState] = useState<RunStatus>("completed");
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequiredEvent | null>(null);
  const [pendingClarify, setPendingClarify] = useState<ClarifyRequiredEvent | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  const clearStreamingText = useCallback(() => {
    setStreamingText("");
  }, []);

  const reset = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setRunId(null);
    setRunState("completed");
    setTimeline([]);
    setStreamingText("");
    setPendingApproval(null);
    setPendingClarify(null);
  }, []);

  const handleEvent = useCallback((event: RunEvent) => {
    switch (event.event) {
      case "run.started":
        setRunState("streaming");
        setTimeline((previous) => [
          ...previous,
          {
            id: `start-${event.seq}`,
            type: "system",
            status: "success",
            title: "Run Started",
            description: `Model: ${event.model}`,
            timestamp: event.timestamp,
          },
        ]);
        break;
      case "message.delta":
        setStreamingText((previous) => previous + event.delta);
        break;
      case "reasoning.available":
        setTimeline((previous) => [
          ...previous,
          {
            id: `reason-${event.seq}`,
            type: "thinking",
            status: "success",
            title: "Reasoning Available",
            description: event.text,
            timestamp: event.timestamp,
          },
        ]);
        break;
      case "tool.started":
        setTimeline((previous) => [
          ...previous,
          {
            id: `tool-${event.callId}`,
            type: "tool",
            status: "active",
            title: `Tool: ${event.tool}`,
            description: event.preview,
            timestamp: event.timestamp,
          },
        ]);
        break;
      case "tool.completed":
        setTimeline((previous) =>
          previous.map((item) =>
            item.id === `tool-${event.callId}`
              ? {
                  ...item,
                  status: event.error ? "error" : "success",
                  duration: event.duration,
                }
              : item
          )
        );
        break;
      case "approval.required":
        setRunState("waiting_for_approval");
        setPendingApproval(event);
        setTimeline((previous) => [
          ...previous,
          {
            id: `approval-${event.requestId}`,
            type: "approval",
            status: "blocked",
            title: "Approval Required",
            description: event.title,
            timestamp: event.timestamp,
          },
        ]);
        break;
      case "approval.resolved":
        setRunState("streaming");
        setPendingApproval(null);
        setTimeline((previous) =>
          previous.map((item) =>
            item.id === `approval-${event.requestId}`
              ? {
                  ...item,
                  status: event.decision === "deny" ? "error" : "success",
                  description: `Decision: ${event.decision}`,
                }
              : item
          )
        );
        break;
      case "clarify.required":
        setRunState("waiting_for_clarify");
        setPendingClarify(event);
        setTimeline((previous) => [
          ...previous,
          {
            id: `clarify-${event.requestId}`,
            type: "clarify",
            status: "blocked",
            title: "Clarification Needed",
            description: event.question,
            timestamp: event.timestamp,
          },
        ]);
        break;
      case "clarify.resolved":
        setRunState("streaming");
        setPendingClarify(null);
        setTimeline((previous) =>
          previous.map((item) =>
            item.id === `clarify-${event.requestId}`
              ? {
                  ...item,
                  status: "success",
                  description: "Clarification received",
                }
              : item
          )
        );
        break;
      case "run.completed":
        setRunState("completed");
        if (event.output && !streamingText) {
          setStreamingText(event.output);
        }
        setTimeline((previous) => [
          ...previous,
          {
            id: `completed-${event.seq}`,
            type: "system",
            status: "success",
            title: "Run Completed",
            description: event.usage
              ? `${event.usage.totalTokens} total tokens`
              : undefined,
            timestamp: event.timestamp,
          },
        ]);
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
        break;
      case "run.failed":
        setRunState("failed");
        setTimeline((previous) => [
          ...previous,
          {
            id: `failed-${event.seq}`,
            type: "system",
            status: "error",
            title: "Run Failed",
            description: event.reason,
            timestamp: event.timestamp,
          },
        ]);
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
        break;
      case "run.cancelled":
        setRunState("cancelled");
        setTimeline((previous) => [
          ...previous,
          {
            id: `cancelled-${event.seq}`,
            type: "system",
            status: "error",
            title: "Run Cancelled",
            description: event.reason,
            timestamp: event.timestamp,
          },
        ]);
        eventSourceRef.current?.close();
        eventSourceRef.current = null;
        break;
    }
  }, [streamingText]);

  const startRun = useCallback(
    async (payload: {
      sessionId: string;
      input: string;
      cwd: string | null;
      model: string;
      toolset?: string;
      instructions?: string | null;
    }) => {
      eventSourceRef.current?.close();
      setRunState("starting");
      setTimeline([]);
      setStreamingText("");
      setPendingApproval(null);
      setPendingClarify(null);

      if (USE_MOCK_RUNS) {
        setRunId("mock-run");
        let delay = 0;
        for (const event of MOCK_RUN_EVENTS) {
          delay += 500;
          window.setTimeout(() => handleEvent(event), delay);
        }
        return;
      }

      const response = await api.startRun(payload);
      setRunId(response.runId);
      const eventSource = new EventSource(`/v1/runs/${encodeURIComponent(response.runId)}/events`);
      eventSource.onmessage = (message) => {
        if (!message.data) {
          return;
        }
        const nextEvent = JSON.parse(message.data) as RunEvent;
        handleEvent(nextEvent);
      };
      eventSource.onerror = () => {
        eventSource.close();
        eventSourceRef.current = null;
        setRunState((current) => (current === "completed" ? current : "failed"));
      };
      eventSourceRef.current = eventSource;
    },
    [handleEvent]
  );

  const cancelRun = useCallback(async () => {
    if (runId) {
      await api.cancelRun(runId);
    }
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setPendingApproval(null);
    setPendingClarify(null);
    setRunState("cancelled");
  }, [runId]);

  const submitApproval = useCallback(
    async (decision: ApprovalDecision) => {
      if (!runId || !pendingApproval) {
        return;
      }
      if (USE_MOCK_RUNS) {
        handleEvent({
          event: "approval.resolved",
          requestId: pendingApproval.requestId,
          decision,
          runId,
          sessionId: pendingApproval.sessionId,
          seq: Date.now(),
          timestamp: Date.now(),
        });
        return;
      }
      await api.resolveApproval(runId, pendingApproval.requestId, decision);
    },
    [handleEvent, pendingApproval, runId]
  );

  const submitClarify = useCallback(
    async (answer: string) => {
      if (!runId || !pendingClarify) {
        return;
      }
      if (USE_MOCK_RUNS) {
        handleEvent({
          event: "clarify.resolved",
          requestId: pendingClarify.requestId,
          answer,
          runId,
          sessionId: pendingClarify.sessionId,
          seq: Date.now(),
          timestamp: Date.now(),
        });
        return;
      }
      await api.resolveClarify(runId, pendingClarify.requestId, answer);
    },
    [handleEvent, pendingClarify, runId]
  );

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  return {
    runId,
    runState,
    timeline,
    streamingText,
    pendingApproval,
    pendingClarify,
    startRun,
    cancelRun,
    submitApproval,
    submitClarify,
    clearStreamingText,
    reset,
  };
}
