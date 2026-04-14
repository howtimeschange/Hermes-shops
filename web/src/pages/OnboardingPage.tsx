import { useOnboarding } from "@/features/chat/hooks/useOnboarding";
import type { ApprovalMode, BootstrapResponse } from "@/lib/desktop";
import { CheckCircle2, ChevronRight } from "lucide-react";

interface Props {
  bootstrap: BootstrapResponse | null;
  onComplete: () => void;
}

export default function OnboardingPage({ bootstrap, onComplete }: Props) {
  const {
    step, setStep,
    provider, setProvider,
    apiKey, setApiKey,
    baseUrl, setBaseUrl,
    model, setModel,
    workspace, setWorkspace,
    approvalMode, setApprovalMode,
    submitSetup
  } = useOnboarding({ bootstrap, onComplete });

  const steps = ["provider", "credentials", "model", "workspace"] as const;
  const currentIndex = steps.indexOf(step);

  return (
    <div className="flex h-[calc(100vh-10rem)] w-full flex-col items-center justify-center p-6 bg-background rounded-md border border-border shadow-xl relative z-10 w-full overflow-hidden">
      <div className="w-full max-w-lg rounded-md border border-border bg-card p-8 shadow-sm relative overflow-hidden">
        
        {/* Header & Progress */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold font-collapse uppercase tracking-widest text-foreground">
              Welcome to Hermes-shops
            </h2>
            <p className="text-[10px] text-muted-foreground font-display tracking-widest uppercase mt-1">
              Step {currentIndex + 1} of {steps.length}
            </p>
          </div>
          <div className="flex gap-1.5">
            {steps.map((s, idx) => (
              <div 
                key={s} 
                className={`h-1.5 w-6 rounded-full transition-colors ${idx <= currentIndex ? "bg-primary" : "bg-muted"}`} 
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="min-h-[220px]">
          {step === "provider" && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <label className="text-[11px] font-medium font-display uppercase tracking-widest text-foreground">Select AI Provider</label>
              <select 
                value={provider} 
                onChange={e => setProvider(e.target.value)}
                className="w-full rounded-sm border border-border bg-background p-3 text-sm focus:border-foreground/30 transition-colors focus:outline-none"
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option>
                <option value="ollama">Ollama (Local)</option>
              </select>
            </div>
          )}

          {step === "credentials" && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <label className="text-[11px] font-medium font-display uppercase tracking-widest text-foreground">API Credentials</label>
              <input 
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="w-full rounded-sm border border-border bg-background p-3 text-sm focus:border-foreground/30 transition-colors focus:outline-none"
              />
              <input 
                type="text"
                placeholder="Custom Base URL (optional)"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                className="w-full rounded-sm border border-border bg-background p-3 text-sm focus:border-foreground/30 transition-colors focus:outline-none"
              />
            </div>
          )}

          {step === "model" && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <label className="text-[11px] font-medium font-display uppercase tracking-widest text-foreground">Default Model</label>
              <input 
                type="text"
                placeholder="e.g. anthropic/claude-3-5-sonnet-20241022"
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full rounded-sm border border-border bg-background p-3 text-sm focus:border-foreground/30 transition-colors focus:outline-none"
              />
            </div>
          )}

          {step === "workspace" && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <label className="text-[11px] font-medium font-display uppercase tracking-widest text-foreground">Workspace & Safety</label>
              <input 
                type="text"
                placeholder="Default Workspace Path (e.g. /home/user/projects)"
                value={workspace}
                onChange={e => setWorkspace(e.target.value)}
                className="w-full rounded-sm border border-border bg-background p-3 text-sm focus:border-foreground/30 transition-colors focus:outline-none"
              />
              <select
                value={approvalMode}
                onChange={e => setApprovalMode(e.target.value as ApprovalMode)}
                className="w-full rounded-sm border border-border bg-background p-3 text-sm focus:border-foreground/30 transition-colors focus:outline-none mt-2"
              >
                <option value="ask">Ask for Approval on Risky Commands</option>
                <option value="auto_safe">Auto-run safe, Ask for Risky</option>
                <option value="deny_dangerous">Deny Risky Automatically</option>
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 flex justify-between border-t border-border/50 pt-6">
          <button
            onClick={() => {
              if (currentIndex > 0) setStep(steps[currentIndex - 1]);
            }}
            disabled={currentIndex === 0}
            className="rounded-sm px-4 py-2 text-xs font-medium font-display uppercase tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          >
            Back
          </button>
          
          {currentIndex < steps.length - 1 ? (
            <button
              onClick={() => setStep(steps[currentIndex + 1])}
              className="flex items-center gap-2 rounded-sm bg-primary px-5 py-2 text-[10px] font-medium font-display uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Continue <ChevronRight className="h-3 w-3" />
            </button>
          ) : (
            <button
              onClick={submitSetup}
              className="flex items-center gap-2 rounded-sm bg-primary px-5 py-2 text-[10px] font-medium font-display uppercase tracking-wider text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Complete Setup <CheckCircle2 className="h-3 w-3" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
