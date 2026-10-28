"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

const TONES = {
  info: { wrap: "bg-brand-primary", icon: "app/icon-info-white-12" },
  success: { wrap: "bg-success-fg", icon: "app/icon-check-white-12" },
  error: { wrap: "bg-critical-fg", icon: "app/icon-alert-circle-white-12" },
} as const;

/**
 * Toast — bottom-centre, 24 above the content edge, 440 wide, surface/inverse,
 * radius 8. Title Label/S, optional body; the action is an underlined link.
 * Auto-hides after 6 s (10 s when it has an action), pauses on hover.
 */
export function Toast({
  title,
  body,
  action,
  tone = "info",
  width = 440,
  onDismiss,
}: {
  title: string;
  body?: ReactNode;
  action?: { label: string; onClick: () => void };
  tone?: keyof typeof TONES;
  width?: number;
  onDismiss: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(action ? 10_000 : 6_000);

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const id = setTimeout(onDismiss, remaining.current);
    return () => {
      clearTimeout(id);
      remaining.current -= Date.now() - started;
    };
  }, [paused, onDismiss]);

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      style={{ width }}
      className="fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-32px)] -translate-x-1/2 animate-[toast-in_200ms_ease-out] items-center gap-3 rounded-lg bg-surface-inverse px-4 py-3 shadow-[0_24px_24px_rgb(15_23_42/0.2)] motion-reduce:animate-none"
    >
      <span className={`flex size-5 shrink-0 items-center justify-center rounded-full ${TONES[tone].wrap}`}>
        <Icon name={TONES[tone].icon} size={12} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-text-inverse">
        <p className="text-label-s">{title}</p>
        {body && <p className="text-body-s">{body}</p>}
      </div>
      {action && (
        <button
          type="button"
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
          className="rounded text-label-s text-text-inverse underline"
        >
          {action.label}
        </button>
      )}
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="flex rounded">
        <Icon name="app/icon-x-white-16" size={16} />
      </button>
    </div>
  );
}

type ToastSpec = {
  title: string;
  body?: ReactNode;
  action?: { label: string; onClick: () => void };
  tone?: keyof typeof TONES;
};

const ToastContext = createContext<(toast: ToastSpec) => void>(() => {});

/** One toast at a time for the whole app; a new one replaces the current one. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastSpec & { key: number }) | null>(null);
  const show = useCallback((t: ToastSpec) => setToast({ ...t, key: Date.now() }), []);
  return (
    <ToastContext value={show}>
      {children}
      {toast && (
        <Toast
          key={toast.key}
          width={440}
          title={toast.title}
          body={toast.body}
          action={toast.action}
          tone={toast.tone}
          onDismiss={() => setToast(null)}
        />
      )}
    </ToastContext>
  );
}

export const useToast = () => useContext(ToastContext);
