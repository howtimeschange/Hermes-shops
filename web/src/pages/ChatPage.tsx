import type { BootstrapResponse } from "@/lib/desktop";
import SessionSidebar from "@/features/chat/components/SessionSidebar";
import MessageList from "@/features/chat/components/MessageList";
import TimelinePanel from "@/features/chat/components/TimelinePanel";
import Composer from "@/features/chat/components/Composer";
import { useSessionList } from "@/features/chat/hooks/useSessionList";
import { useChatSession } from "@/features/chat/hooks/useChatSession";

interface Props {
  bootstrap: BootstrapResponse | null;
}

export default function ChatPage({ bootstrap }: Props) {
  const defaultWorkspace = bootstrap?.onboarding.workspace ?? null;
  const defaultModel = bootstrap?.onboarding.defaultModel || "anthropic/claude-3-5-sonnet-20241022";
  const {
    sessions,
    activeSessionId,
    setActiveSessionId,
    createNewSession,
    isLoading,
  } = useSessionList({ initialWorkspace: defaultWorkspace });
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;
  const { messages, stream, sendMessage, isLoadingHistory } = useChatSession({
    sessionId: activeSessionId,
    cwd: activeSession?.cwd ?? defaultWorkspace,
    model: activeSession?.model ?? defaultModel,
  });

  const handleNewChat = async () => {
    try {
      await createNewSession(defaultWorkspace);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSend = async (content: string) => {
    if (!activeSessionId) {
      return;
    }
    await sendMessage(content);
  };

  return (
    <div className="flex h-[calc(100vh-10rem)] w-full overflow-hidden rounded-md border border-border bg-background shadow-xl">
      {/* Left Sidebar */}
      <div className="w-64 shrink-0 border-r border-border md:w-80 h-full">
        <SessionSidebar 
          sessions={sessions} 
          activeSessionId={activeSessionId} 
          onSelect={setActiveSessionId} 
          onNewChat={handleNewChat}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden h-full relative z-10">
        {/* Header */}
        <div className="flex items-center border-b border-border px-4 py-3 h-14 shrink-0 bg-background/80 backdrop-blur-sm">
          <h2 className="text-sm font-medium font-display tracking-wide uppercase truncate">
            {activeSession?.title || "New Chat"}
          </h2>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-hidden relative">
          <MessageList
            messages={messages}
            pendingApproval={stream.pendingApproval}
            pendingClarify={stream.pendingClarify}
            onApprovalSubmit={stream.submitApproval}
            onClarifySubmit={stream.submitClarify}
          />
          {(isLoading || isLoadingHistory) && (
            <div className="absolute inset-x-0 top-0 flex justify-center p-3">
              <div className="rounded-sm border border-border bg-card px-3 py-1 text-[10px] font-display uppercase tracking-[0.18em] text-muted-foreground">
                Loading session...
              </div>
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="p-4 border-t border-border shrink-0 bg-background">
          <Composer
            onSend={(text) => {
              void handleSend(text);
            }}
            onStop={() => {
              void stream.cancelRun();
            }}
            isStreaming={["starting", "streaming", "waiting_for_approval", "waiting_for_clarify"].includes(stream.runState)}
            disabled={isLoading || isLoadingHistory || !activeSessionId}
          />
        </div>
      </div>

      {/* Right Timeline Phase 2 */}
      <div className="hidden w-64 shrink-0 border-l border-border md:flex md:w-80 h-full flex-col bg-card/30">
        <TimelinePanel timeline={stream.timeline} runState={stream.runState} />
      </div>
    </div>
  );
}
