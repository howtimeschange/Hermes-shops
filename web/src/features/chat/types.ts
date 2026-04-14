export interface SessionSummary {
  id: string;
  title: string | null;
  cwd: string | null;
  source: "desktop" | "cli" | "acp" | "gateway" | string | null;
  model: string | null;
  startedAt: number;
  lastActive: number;
  endedAt: number | null;
  isActive: boolean;
  messageCount: number;
  toolCallCount: number;
  preview: string | null;
}

export interface SessionMessage {
  id?: number;
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  timestamp?: number;
  toolName?: string;
  toolCallId?: string;
  toolCalls?: Array<{
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  reasoning?: string | null;
}
