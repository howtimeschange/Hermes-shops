import { useEffect, useState, type ComponentType } from "react";
import { Activity, BarChart3, Clock, FileText, KeyRound, MessageSquare, Package, Settings } from "lucide-react";
import StatusPage from "@/pages/StatusPage";
import ConfigPage from "@/pages/ConfigPage";
import EnvPage from "@/pages/EnvPage";
import SessionsPage from "@/pages/SessionsPage";
import LogsPage from "@/pages/LogsPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import CronPage from "@/pages/CronPage";
import SkillsPage from "@/pages/SkillsPage";
import ChatPage from "@/pages/ChatPage";
import OnboardingPage from "@/pages/OnboardingPage";
import { api } from "@/lib/api";
import type { BootstrapResponse } from "@/lib/desktop";

const NAV_ITEMS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "status", label: "Status", icon: Activity },
  { id: "sessions", label: "Sessions", icon: FileText },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "logs", label: "Logs", icon: FileText },
  { id: "cron", label: "Cron", icon: Clock },
  { id: "skills", label: "Skills", icon: Package },
  { id: "config", label: "Config", icon: Settings },
  { id: "env", label: "Keys", icon: KeyRound },
] as const;

type PageId = (typeof NAV_ITEMS)[number]["id"];

const PAGE_COMPONENTS: Record<Exclude<PageId, "chat">, ComponentType> = {
  status: StatusPage,
  sessions: SessionsPage,
  analytics: AnalyticsPage,
  logs: LogsPage,
  cron: CronPage,
  skills: SkillsPage,
  config: ConfigPage,
  env: EnvPage,
};

export default function App() {
  const [page, setPage] = useState<PageId>("chat");
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    setAnimKey((k) => k + 1);
  }, [page]);

  useEffect(() => {
    let cancelled = false;

    async function loadBootstrap() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const next = await api.getBootstrap();
        if (cancelled) {
          return;
        }
        setBootstrap(next);
        setOnboardingCompleted(next.onboarding.completed);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setLoadError(error instanceof Error ? error.message : "Failed to load desktop bootstrap");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadBootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOnboardingComplete = async () => {
    setOnboardingCompleted(true);
    try {
      const next = await api.getBootstrap();
      setBootstrap(next);
      setOnboardingCompleted(next.onboarding.completed);
    } catch (error) {
      console.error(error);
    }
  };

  const StaticPage = page === "chat" ? null : PAGE_COMPONENTS[page];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Global grain + warm glow (matches landing page) */}
      <div className="noise-overlay" />
      <div className="warm-glow" />

      {/* ---- Header with grid-border nav ---- */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-[1400px] items-stretch">
          {/* Brand */}
          <div className="flex items-center border-r border-border px-5 shrink-0">
            <span className="font-collapse text-xl font-bold tracking-wider uppercase blend-lighter">
              Hermes<br className="hidden sm:inline" /><span className="sm:hidden"> </span>Shops
            </span>
          </div>

          {/* Nav grid — Mondwest labels like the landing page nav */}
          <nav className="flex items-stretch overflow-x-auto scrollbar-none">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPage(id)}
                className={`group relative inline-flex items-center gap-1.5 border-r border-border px-4 py-2 font-display text-[0.8rem] tracking-[0.12em] uppercase whitespace-nowrap transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                  page === id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {/* Hover highlight */}
                <span className="absolute inset-0 bg-foreground pointer-events-none transition-opacity duration-150 group-hover:opacity-5 opacity-0" />
                {/* Active indicator — dither bar */}
                {page === id && (
                  <span className="absolute bottom-0 left-0 right-0 h-px bg-foreground" />
                )}
              </button>
            ))}
          </nav>

          {/* Version badge */}
          <div className="ml-auto flex items-center px-4 text-muted-foreground">
            <span className="font-display text-[0.7rem] tracking-[0.15em] uppercase opacity-50">
              {bootstrap ? `${bootstrap.app.buildChannel} ${bootstrap.app.version}` : "Desktop"}
            </span>
          </div>
        </div>
      </header>

      <main
        key={animKey}
        className="relative z-2 mx-auto w-full max-w-[1400px] flex-1 px-6 py-8"
        style={{ animation: "fade-in 150ms ease-out" }}
      >
        {isLoading ? (
          <div className="flex h-[calc(100vh-10rem)] items-center justify-center rounded-md border border-border bg-card text-sm font-display uppercase tracking-[0.18em] text-muted-foreground">
            Loading Hermes-shops...
          </div>
        ) : loadError ? (
          <div className="flex h-[calc(100vh-10rem)] flex-col items-center justify-center gap-4 rounded-md border border-destructive/40 bg-destructive/5 p-8 text-center">
            <div className="font-display text-sm uppercase tracking-[0.18em] text-destructive">
              Failed to Reach Local Sidecar
            </div>
            <p className="max-w-xl text-sm text-foreground/80">{loadError}</p>
          </div>
        ) : !onboardingCompleted ? (
          <OnboardingPage
            onComplete={handleOnboardingComplete}
            bootstrap={bootstrap}
          />
        ) : (
          page === "chat" || !StaticPage ? (
            <ChatPage bootstrap={bootstrap} />
          ) : (
            <StaticPage />
          )
        )}
      </main>

      {/* ---- Footer ---- */}
      <footer className="relative z-2 border-t border-border">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <span className="font-display text-[0.8rem] tracking-[0.12em] uppercase opacity-50">
            Hermes-shops
          </span>
          <span className="font-display text-[0.7rem] tracking-[0.15em] uppercase text-foreground/40">
            Nous Research
          </span>
        </div>
      </footer>
    </div>
  );
}
