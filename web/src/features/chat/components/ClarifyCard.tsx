import { useState } from "react";
import type { ClarifyRequiredEvent } from "@/lib/runs";
import { HelpCircle, Send } from "lucide-react";

interface Props {
  event: ClarifyRequiredEvent;
  onSubmit: (answer: string) => void;
}

export default function ClarifyCard({ event, onSubmit }: Props) {
  const [text, setText] = useState("");

  return (
    <div className="mt-4 mb-2 flex flex-col gap-4 rounded-md border border-primary/30 bg-primary/5 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <HelpCircle className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold font-display uppercase tracking-wider text-primary">
          Clarification Needed
        </h3>
      </div>
      <p className="text-sm text-foreground/80 leading-relaxed">{event.question}</p>
      
      {event.choices && event.choices.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          {event.choices.map((c) => (
            <button
              key={c.value}
              onClick={() => onSubmit(c.value)}
              className="w-full text-left rounded-sm border border-primary/20 bg-background px-4 py-3 text-sm font-medium hover:bg-primary/10 transition-colors"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {event.allowFreeform && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) onSubmit(text.trim());
            }}
            placeholder="Type your answer..."
            className="flex-1 rounded-sm border border-border bg-background px-3 py-2 text-sm focus:border-foreground/40 transition-colors focus:outline-none"
          />
          <button
            onClick={() => {
                if (text.trim()) onSubmit(text.trim());
            }}
            disabled={!text.trim()}
            className="flex items-center justify-center rounded-sm bg-primary px-4 text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
