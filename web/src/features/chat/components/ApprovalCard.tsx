import type { ApprovalRequiredEvent, ApprovalDecision } from "@/lib/runs";
import { AlertTriangle } from "lucide-react";

interface Props {
  event: ApprovalRequiredEvent;
  onSubmit: (decision: ApprovalDecision) => void;
}

export default function ApprovalCard({ event, onSubmit }: Props) {
  const isHighRisk = event.riskLevel === "high";

  return (
    <div className={`mt-4 mb-2 flex flex-col gap-4 rounded-md border p-5 shadow-sm ${isHighRisk ? "border-destructive/50 bg-destructive/5" : "border-warning/50 bg-warning/5"}`}>
      <div className="flex items-center gap-3">
        <AlertTriangle className={`h-5 w-5 ${isHighRisk ? "text-destructive" : "text-warning"}`} />
        <h3 className={`text-sm font-semibold font-display uppercase tracking-wider ${isHighRisk ? "text-destructive" : "text-warning"}`}>
          {event.title}
        </h3>
      </div>
      <p className="text-sm text-foreground/80 leading-relaxed">{event.description}</p>
      
      <div className="flex flex-col gap-1 rounded-sm bg-background p-3 border border-border/50">
        <div className="text-[10px] uppercase font-display tracking-widest text-muted-foreground mb-1">Command Preview</div>
        <code className="text-[11px] break-all text-foreground font-mono bg-muted p-1 px-2 rounded-sm select-all">{event.command}</code>
        <div className="text-[10px] uppercase font-display tracking-widest text-muted-foreground mt-3 mb-1">Working Directory</div>
        <code className="text-xs break-all text-muted-foreground">{event.cwd}</code>
      </div>

      <div className="flex flex-wrap gap-2 mt-2">
        {event.options.includes("allow_once") && (
          <button
            onClick={() => onSubmit("allow_once")}
            className="rounded-sm border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-display tracking-wider uppercase font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            Allow Once
          </button>
        )}
        {event.options.includes("allow_session") && (
          <button
            onClick={() => onSubmit("allow_session")}
            className="rounded-sm border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-display tracking-wider uppercase font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            Allow for Session
          </button>
        )}
        {event.options.includes("allow_workspace") && (
          <button
            onClick={() => onSubmit("allow_workspace")}
            className="rounded-sm border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-display tracking-wider uppercase font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            Allow for Workspace
          </button>
        )}
        <div className="flex-1" />
        {event.options.includes("deny") && (
          <button
            onClick={() => onSubmit("deny")}
            className="rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-display tracking-wider uppercase font-medium text-destructive hover:bg-destructive/20 transition-colors"
          >
            Deny
          </button>
        )}
      </div>
    </div>
  );
}
