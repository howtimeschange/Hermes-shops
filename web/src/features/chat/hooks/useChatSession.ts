import { useEffect, useMemo, useState } from "react";
import { api, type SessionMessage as ApiSessionMessage } from "@/lib/api";
import type { SessionMessage } from "@/features/chat/types";
import { useRunStream } from "./useRunStream";

function mapMessage(message: ApiSessionMessage): SessionMessage {
  return {
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
    toolCalls: message.tool_calls,
    toolName: message.tool_name,
    toolCallId: message.tool_call_id,
  };
}

interface UseChatSessionOptions {
  sessionId: string | null;
  cwd: string | null;
  model: string;
}

export function useChatSession({ sessionId, cwd, model }: UseChatSessionOptions) {
  const [history, setHistory] = useState<SessionMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const stream = useRunStream();
  const { clearStreamingText, reset, runState, startRun } = stream;

  useEffect(() => {
    reset();
  }, [reset, sessionId]);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      if (!sessionId) {
        setHistory([]);
        return;
      }
      setIsLoadingHistory(true);
      try {
        const response = await api.getSessionMessages(sessionId);
        if (!cancelled) {
          setHistory(response.messages.map(mapMessage));
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    }

    void loadMessages();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    const currentSessionId = sessionId;
    if (!["completed", "failed", "cancelled"].includes(runState)) {
      return;
    }

    let cancelled = false;

    async function refreshHistory() {
      try {
        const response = await api.getSessionMessages(currentSessionId);
        if (!cancelled) {
          setHistory(response.messages.map(mapMessage));
          clearStreamingText();
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      }
    }

    void refreshHistory();
    return () => {
      cancelled = true;
    };
  }, [clearStreamingText, runState, sessionId]);

  const messages = useMemo(() => {
    const next = [...history];
    const isStreaming = ["starting", "streaming", "waiting_for_approval", "waiting_for_clarify"].includes(
      runState
    );
    if (stream.streamingText && isStreaming) {
      next.push({
        role: "assistant",
        content: stream.streamingText,
      });
    }
    return next;
  }, [history, runState, stream.streamingText]);

  const sendMessage = async (content: string) => {
    if (!sessionId) {
      return;
    }
    setHistory((previous) => [...previous, { role: "user", content }]);
    await startRun({
      sessionId,
      input: content,
      cwd,
      model,
    });
  };

  return {
    messages,
    sendMessage,
    stream,
    isLoadingHistory,
  };
}
