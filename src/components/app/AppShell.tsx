"use client";

import { useApi } from "@/lib/api/fd";
import { useAlertStream, type FeedState } from "@/lib/api/stream";
import type { User } from "@/lib/auth/api";
import { useOperatorName } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CommandPalette } from "@/components/shell/CommandPalette";
import {
  FeedbackModal,
  HelpDrawer,
  ShortcutsModal,
} from "@/components/shell/ShellDialogs";
import { logout } from "@/lib/auth/api";
import { signOut } from "@/lib/auth/session";
import { useRouter } from "next/navigation";
import { ToastProvider } from "@/components/ui/Toast";
import { CriticalAlertToast } from "./CriticalAlertToast";
import { StepUpProvider } from "./StepUp";
import { Sidebar } from "./Sidebar";

export type Overlay = "palette" | "shortcuts" | "help" | "feedback";
type ShellState = {
  user: User | null;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  feed: FeedState | null;
  /** I1/I11/I12/I13 — app-wide overlays. */
  open: (overlay: Overlay) => void;
  handOver: () => void;
  signOutNow: () => void;
};
const ShellContext = createContext<ShellState>({
  user: null,
  sidebarOpen: true,
  toggleSidebar: () => {},
  feed: null,
  open: () => {},
  handOver: () => {},
  signOutNow: () => {},
});

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
const GO: Record<string, string> = {
  q: "/queue",
  a: "/alerts",
  c: "/cases",
  h: "/heatmap",
};
export const useShell = () => useContext(ShellContext);

/** The live alert feed, shared by every screen (one connection for the app). */
export function useFeed() {
  const { feed } = useShell();
  if (!feed) throw new Error("useFeed must be used inside <AppShell>");
  return feed;
}

/**
 * App shell — Navy sidebar (280, or the 80 rail when collapsed) flush beside
 * the main column on the canvas. Pages render their own <AppHeader> (top bar)
 * and content; the footer is shared.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { data: user } = useApi<User>("/me");
  const operatorName = useOperatorName();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const feed = useAlertStream();
  const router = useRouter();
  const pendingG = useRef(0);

  const handOver = () => {
    setOverlay(null);
    router.push("/queue?handover=1");
  };
  const signOutNow = () => {
    signOut();
    void logout()
      .catch(() => undefined)
      .finally(() => router.push("/sign-in"));
  };

  // ⌘K search · ? shortcuts · G then Q/A/C/H · ⌘/Ctrl Shift H hand over.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "k") {
        e.preventDefault();
        setOverlay("palette");
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && k === "h") {
        e.preventDefault();
        handOver();
        return;
      }
      if (
        typing(e.target) ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        document.querySelector("dialog[open]")
      )
        return;
      if (e.key === "?") {
        e.preventDefault();
        setOverlay("shortcuts");
      } else if (k === "g") {
        pendingG.current = Date.now();
      } else if (GO[k] && Date.now() - pendingG.current < 1200) {
        pendingG.current = 0;
        router.push(GO[k]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return (
    <ShellContext
      value={{
        user: user ?? null,
        sidebarOpen,
        toggleSidebar: () => setSidebarOpen((o) => !o),
        feed,
        open: setOverlay,
        handOver,
        signOutNow,
      }}
    >
      <ToastProvider>
        <StepUpProvider>
          <div className="flex h-dvh">
            <Sidebar operatorName={operatorName} collapsed={!sidebarOpen} />
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface-canvas">
              {children}
            </div>
          </div>
          <CriticalAlertToast feed={feed} />
          {overlay === "palette" && (
            <CommandPalette
              onClose={() => setOverlay(null)}
              onHandover={handOver}
            />
          )}
          {overlay === "shortcuts" && (
            <ShortcutsModal onClose={() => setOverlay(null)} />
          )}
          {overlay === "help" && (
            <HelpDrawer
              onClose={() => setOverlay(null)}
              onShortcuts={() => setOverlay("shortcuts")}
              onFeedback={() => setOverlay("feedback")}
            />
          )}
          {overlay === "feedback" && (
            <FeedbackModal
              user={user ?? null}
              onClose={() => setOverlay(null)}
            />
          )}
        </StepUpProvider>
      </ToastProvider>
    </ShellContext>
  );
}

/** Scrollable page body below the header, with the shared footer at the end. */
export function PageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { feed } = useShell();
  const interrupted = feed?.status === "reconnecting";
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className={className ?? "flex flex-1 flex-col gap-6 px-8 pt-8 pb-10"}>
          {children}
        </div>
        <footer className="flex shrink-0 items-center justify-center gap-2 border-t border-border-default px-8 py-3 text-caption">
          <span
            className={cn(
              "size-1.5 rounded-full",
              interrupted ? "bg-medium-fg" : "bg-success-fg",
            )}
          />
          <span className="text-text-secondary">
            {interrupted
              ? "Live updates interrupted"
              : "All systems operational"}
          </span>
          <span className="whitespace-pre text-text-tertiary">
            · © 2026 FraudDetection · v2.0
          </span>
        </footer>
      </div>
    </>
  );
}

/** Page header — H2 title + Body/S meta left, up to two actions right (one primary at most). */
export function PageHead({
  title,
  pill,
  subtitle,
  actions,
}: {
  title: string;
  /** Optional pill beside the title (Live, Read-only, Restricted). */
  pill?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="text-h2 text-text-primary">{title}</h2>
          {pill}
        </div>
        {subtitle && (
          <p className="text-body-s text-text-secondary">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
