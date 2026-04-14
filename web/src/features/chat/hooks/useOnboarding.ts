import { useState } from "react";
import { api } from "@/lib/api";
import type { BootstrapResponse } from "@/lib/desktop";

export type OnboardingStep = "provider" | "credentials" | "model" | "workspace";

interface UseOnboardingOptions {
  bootstrap: BootstrapResponse | null;
  onComplete: () => void;
}

export function useOnboarding({ bootstrap, onComplete }: UseOnboardingOptions) {
  const [step, setStep] = useState<OnboardingStep>("provider");
  
  const [provider, setProvider] = useState("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  
  const [model, setModel] = useState(
    bootstrap?.onboarding.defaultModel || "anthropic/claude-3-5-sonnet-20241022"
  );
  const [workspace, setWorkspace] = useState(bootstrap?.onboarding.workspace || "");
  const [approvalMode, setApprovalMode] = useState(bootstrap?.onboarding.approvalMode || "ask");

  const submitSetup = async () => {
    try {
      await api.completeOnboarding({
        provider,
        apiKey,
        baseUrl,
        model,
        workspace,
        approvalMode
      });
      onComplete();
    } catch (e) {
      console.error(e);
    }
  };

  return {
    step, setStep,
    provider, setProvider,
    apiKey, setApiKey,
    baseUrl, setBaseUrl,
    model, setModel,
    workspace, setWorkspace,
    approvalMode, setApprovalMode,
    submitSetup
  };
}
