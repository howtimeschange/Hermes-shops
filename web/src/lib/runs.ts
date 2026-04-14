export type RunStatus =
  | "starting"
  | "streaming"
  | "waiting_for_approval"
  | "waiting_for_clarify"
  | "completed"
  | "failed"
  | "cancelled";

export type ApprovalDecision = "allow_once" | "allow_session" | "allow_workspace" | "deny";

export interface BaseRunEvent {
  event: string;
  runId: string;
  sessionId: string;
  seq: number;
  timestamp: number;
}

export interface RunStartedEvent extends BaseRunEvent {
  event: "run.started";
  model: string;
  cwd: string | null;
}

export interface MessageDeltaEvent extends BaseRunEvent {
  event: "message.delta";
  delta: string;
}

export interface ReasoningAvailableEvent extends BaseRunEvent {
  event: "reasoning.available";
  text: string;
}

export interface ToolStartedEvent extends BaseRunEvent {
  event: "tool.started";
  tool: string;
  callId: string;
  preview: string;
}

export interface ToolCompletedEvent extends BaseRunEvent {
  event: "tool.completed";
  tool: string;
  callId: string;
  duration: number;
  error: boolean;
}

export interface ApprovalRequiredEvent extends BaseRunEvent {
  event: "approval.required";
  requestId: string;
  tool: string;
  title: string;
  description: string;
  riskLevel: "high" | "medium" | "low";
  command: string;
  cwd: string;
  options: string[];
}

export interface ApprovalResolvedEvent extends BaseRunEvent {
  event: "approval.resolved";
  requestId: string;
  decision: ApprovalDecision;
}

export interface ClarifyRequiredEvent extends BaseRunEvent {
  event: "clarify.required";
  requestId: string;
  question: string;
  choices: Array<{ label: string; value: string }>;
  allowFreeform: boolean;
}

export interface ClarifyResolvedEvent extends BaseRunEvent {
  event: "clarify.resolved";
  requestId: string;
  answer: string;
}

export interface RunCompletedEvent extends BaseRunEvent {
  event: "run.completed";
  output: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface RunFailedEvent extends BaseRunEvent {
  event: "run.failed";
  reason: string;
}

export interface RunCancelledEvent extends BaseRunEvent {
  event: "run.cancelled";
  reason: string;
}

export type RunEvent =
  | RunStartedEvent
  | MessageDeltaEvent
  | ReasoningAvailableEvent
  | ToolStartedEvent
  | ToolCompletedEvent
  | ApprovalRequiredEvent
  | ApprovalResolvedEvent
  | ClarifyRequiredEvent
  | ClarifyResolvedEvent
  | RunCompletedEvent
  | RunFailedEvent
  | RunCancelledEvent;
