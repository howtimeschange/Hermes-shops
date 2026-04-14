import type { SessionMessage } from "@/features/chat/types";
import type { ApprovalRequiredEvent, ApprovalDecision, ClarifyRequiredEvent } from "@/lib/runs";
import MessageBubble from "./MessageBubble";
import ApprovalCard from "./ApprovalCard";
import ClarifyCard from "./ClarifyCard";
import { useEffect, useRef } from "react";

interface Props {
  messages: SessionMessage[];
  pendingApproval?: ApprovalRequiredEvent | null;
  pendingClarify?: ClarifyRequiredEvent | null;
  onApprovalSubmit?: (decision: ApprovalDecision) => void;
  onClarifySubmit?: (answer: string) => void;
}

export default function MessageList({
  messages,
  pendingApproval,
  pendingClarify,
  onApprovalSubmit,
  onClarifySubmit
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingApproval, pendingClarify]);

  return (
    <div className="flex-1 h-full overflow-y-auto pb-4">
      {messages.length === 0 ? (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm font-display tracking-widest uppercase">
          No messages in this session
        </div>
      ) : (
        messages.map((m, idx) => (
          <MessageBubble key={idx} message={m} />
        ))
      )}
      
      {pendingApproval && onApprovalSubmit && (
        <div className="px-4">
          <ApprovalCard event={pendingApproval} onSubmit={onApprovalSubmit} />
        </div>
      )}
      
      {pendingClarify && onClarifySubmit && (
        <div className="px-4">
          <ClarifyCard event={pendingClarify} onSubmit={onClarifySubmit} />
        </div>
      )}
      
      <div ref={bottomRef} className="h-4" />
    </div>
  );
}
