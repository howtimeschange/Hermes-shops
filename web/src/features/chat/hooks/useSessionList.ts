import { useCallback, useEffect, useState } from "react";
import { api, type SessionInfo } from "@/lib/api";
import type { SessionSummary } from "@/features/chat/types";

function mapSession(session: SessionInfo): SessionSummary {
  return {
    id: session.id,
    title: session.title,
    cwd: session.cwd ?? null,
    source: session.source,
    model: session.model,
    startedAt: session.started_at,
    lastActive: session.last_active,
    endedAt: session.ended_at,
    isActive: session.is_active,
    messageCount: session.message_count,
    toolCallCount: session.tool_call_count,
    preview: session.preview,
  };
}

interface UseSessionListOptions {
  initialWorkspace: string | null;
}

export function useSessionList({ initialWorkspace }: UseSessionListOptions) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSessions = useCallback(async () => {
    const next = (await api.getSessions()).map(mapSession);
    setSessions(next);
    setActiveSessionId((current) => {
      if (current && next.some((session) => session.id === current)) {
        return current;
      }
      return next[0]?.id ?? null;
    });
    return next;
  }, []);

  const createNewSession = useCallback(
    async (cwd = initialWorkspace) => {
      const response = await api.createSession({
        cwd,
        title: "New Chat",
        source: "desktop",
      });
      await refreshSessions();
      setActiveSessionId(response.sessionId);
      return response.sessionId;
    },
    [initialWorkspace, refreshSessions]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const next = await refreshSessions();
        if (!cancelled && next.length === 0) {
          await createNewSession(initialWorkspace);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [createNewSession, initialWorkspace, refreshSessions]);

  return {
    sessions,
    activeSessionId,
    setActiveSessionId,
    refreshSessions,
    createNewSession,
    isLoading,
  };
}
