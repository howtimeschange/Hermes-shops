import { useState, type KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";

interface Props {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export default function Composer({ onSend, onStop, isStreaming, disabled }: Props) {
  const [text, setText] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (text.trim() && !disabled && !isStreaming) {
        onSend(text);
        setText("");
      }
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-3 shadow-sm focus-within:border-foreground/30 transition-colors">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isStreaming ? "Agent is working..." : "Type your message... (Shift+Enter for newline)"}
        disabled={disabled}
        className="w-full resize-none bg-transparent placeholder:text-muted-foreground focus:outline-none min-h-[44px] max-h-[200px]"
        rows={Math.min(10, text.split("\n").length || 1)}
      />
      <div className="flex items-center justify-between mt-2 border-t border-border/50 pt-2">
        <div className="text-[10px] uppercase font-display tracking-widest text-muted-foreground">
          {disabled && !isStreaming ? "Select a session to start" : "Workspace / Default"}
        </div>
        <div>
          {isStreaming ? (
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 rounded-sm bg-destructive/10 px-3 py-1.5 text-[10px] font-medium text-destructive hover:bg-destructive/20 border border-destructive/20 transition-colors"
            >
              <Square className="h-3 w-3 fill-current" />
              <span className="uppercase tracking-widest font-display mt-0.5">Stop</span>
            </button>
          ) : (
            <button
              onClick={() => {
                if (text.trim() && !disabled) {
                  onSend(text);
                  setText("");
                }
              }}
              disabled={disabled || !text.trim()}
              className="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Send className="h-3 w-3" />
              <span className="uppercase tracking-widest font-display mt-0.5">Send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
