import { Search, Plus } from "lucide-react";
import type { SessionSummary } from "@/features/chat/types";

interface Props {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

export default function SessionSidebar({ sessions, activeSessionId, onSelect, onNewChat }: Props) {
  return (
    <div className="flex h-full w-full flex-col bg-background/50">
      <div className="flex items-center justify-between border-b border-border p-4 shrink-0">
        <button
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-sm border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Plus className="h-4 w-4" />
          <span className="font-display tracking-[0.1em] uppercase text-xs">New Chat</span>
        </button>
      </div>
      
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search sessions..."
            className="w-full rounded-sm border border-border bg-background py-2 pl-9 pr-4 text-xs font-display tracking-widest placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`mb-1 flex w-full flex-col gap-1 rounded-sm p-3 text-left transition-colors ${
              activeSessionId === s.id
                ? "bg-muted"
                : "hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate flex-1">{s.title || "Untitled Session"}</span>
            </div>
            <div className="text-xs text-muted-foreground truncate">{s.preview || "No content"}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
