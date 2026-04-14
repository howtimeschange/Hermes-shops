import { Clock, CheckCircle2, XCircle, AlertCircle, Loader2, Cpu } from "lucide-react";
import type { TimelineEntry } from "../hooks/useRunStream";

interface Props {
  item: TimelineEntry;
}

export default function TimelineItem({ item }: Props) {
  const isError = item.status === "error";
  const isBlocked = item.status === "blocked";
  const isActive = item.status === "active";
  const isSuccess = item.status === "success";
  let Icon = Clock;
  let colorClass = "text-muted-foreground";
  
  if (isError) {
    Icon = XCircle;
    colorClass = "text-destructive";
  } else if (isBlocked) {
    Icon = AlertCircle;
    colorClass = "text-warning";
  } else if (isActive) {
    Icon = Loader2;
    colorClass = "text-foreground";
  } else if (isSuccess) {
    Icon = CheckCircle2;
    colorClass = "text-primary border-primary";
  }
  
  if (item.type === "thinking") {
    Icon = Cpu;
  }

  return (
    <div className={`relative pl-8 py-3 w-full border-b border-border/50 last:border-0`}>
      <div className="absolute left-2 top-4">
        <Icon className={`h-4 w-4 ${isActive ? 'animate-spin' : ''} ${colorClass}`} />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-medium font-display tracking-wider uppercase ${isError ? 'text-destructive' : isBlocked ? 'text-warning' : 'text-foreground'}`}>
            {item.title}
          </span>
          {item.duration && (
            <span className="text-[10px] text-muted-foreground">{item.duration}s</span>
          )}
        </div>
        {item.description && (
          <span className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
            {item.description}
          </span>
        )}
      </div>
    </div>
  );
}
