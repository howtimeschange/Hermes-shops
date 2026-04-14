import { Markdown } from "@/components/Markdown";
import type { SessionMessage } from "@/features/chat/types";
import { User, Sparkles } from "lucide-react";

interface Props {
  message: SessionMessage;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex w-full gap-4 p-4 ${isUser ? "bg-background" : "bg-card border-y border-border"}`}>
      <div className="shrink-0 mt-1">
        {isUser ? (
          <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-muted text-muted-foreground">
            <User className="h-4 w-4" />
          </div>
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary/20 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-medium text-foreground mb-1 uppercase tracking-widest font-display">
          {isUser ? "You" : "Agent"}
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90">
          {message.content ? <Markdown content={message.content} /> : null}
        </div>
      </div>
    </div>
  );
}
