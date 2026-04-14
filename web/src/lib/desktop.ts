export type ApprovalMode = "ask" | "auto_safe" | "deny_dangerous";

export interface BootstrapResponse {
  app: {
    name: string;
    version: string;
    platform: "darwin" | "win32";
    buildChannel: "stable" | "beta";
  };
  auth: {
    token: string;
  };
  sidecar: {
    healthy: boolean;
    port: number;
    profile: string;
  };
  onboarding: {
    completed: boolean;
    providerConfigured: boolean;
    defaultModel: string;
    workspace: string | null;
    approvalMode: ApprovalMode;
  };
  runtime: {
    pythonReady: boolean;
    nodeReady: boolean;
    browserRuntimeReady: boolean;
  };
}
