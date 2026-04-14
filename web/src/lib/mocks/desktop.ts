import type { SessionSummary, SessionMessage } from "@/features/chat/types";
import type { BootstrapResponse } from "@/lib/desktop";

export const MOCK_BOOTSTRAP: BootstrapResponse = {
  app: {
    name: "Hermes Desktop",
    version: "1.0.0",
    platform: "darwin",
    buildChannel: "stable",
  },
  auth: {
    token: "desktop_session_token_1234",
  },
  sidecar: {
    healthy: true,
    port: 51791,
    profile: "desktop-default",
  },
  onboarding: {
    completed: false, // Change to false to test Onboarding flow
    providerConfigured: false,
    defaultModel: "",
    workspace: null,
    approvalMode: "ask",
  },
  runtime: {
    pythonReady: true,
    nodeReady: true,
    browserRuntimeReady: true,
  },
};

export const MOCK_SESSIONS: SessionSummary[] = [
  {
    id: "desktop_3c69d2f1",
    title: "Fix browser runtime packaging",
    cwd: "/Users/alice/projects/hermes",
    source: "desktop",
    model: "anthropic/claude-3-5-sonnet-20241022",
    startedAt: Date.now() - 1000 * 60 * 60,
    lastActive: Date.now() - 1000 * 60 * 5,
    endedAt: null,
    isActive: true,
    messageCount: 16,
    toolCallCount: 5,
    preview: "I found the current runtime lookup path...",
  },
];

export const MOCK_MESSAGES: SessionMessage[] = [
  {
    role: "user",
    content: "帮我分析 browser 打包问题",
    timestamp: Date.now() - 1000 * 60 * 5,
  },
  {
    role: "assistant",
    content: "我先检查当前 runtime 的查找逻辑。",
    timestamp: Date.now() - 1000 * 60 * 4,
  },
];
