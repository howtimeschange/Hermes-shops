import type { TimelineEntry } from "../hooks/useRunStream";
import TimelineItem from "./TimelineItem";
import { useEffect, useRef } from "react";

interface Props {
  timeline: TimelineEntry[];
  runState: string;
}

export default function TimelinePanel({ timeline, runState }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [timeline]);

  return (
    <div className="flex h-full w-full flex-col bg-card/10">
      <div className="border-b border-border px-4 py-3 h-14 shrink-0 flex items-center justify-between bg-card/30 backdrop-blur-sm">
        <span className="text-xs font-display uppercase tracking-widest text-muted-foreground">Run Timeline</span>
        {runState !== "idle" && runState !== "completed" && (
          <span className="text-[10px] font-display uppercase tracking-widest text-primary animate-pulse flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {runState.replace(/_/g, " ")}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto w-full relative">
        <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border z-0" />
        <div className="relative z-10">
          {timeline.length === 0 ? (
            <div className="p-4 text-xs tracking-widest font-display text-muted-foreground uppercase py-8 text-center text-opacity-50">
              No active events
            </div>
          ) : (
            timeline.map((item) => (
              <TimelineItem key={item.id} item={item} />
            ))
          )}
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>
    </div>
  );
}
