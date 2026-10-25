"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

const TONES = {
  info: { wrap: "bg-brand-primary", icon: "icon-info-white-14" },
  success: { wrap: "bg-success-fg", icon: "app/icon-check-white-14" },
} as const;

/**
 * Toast — bottom-right, auto-hides after 6 s (10 s when it has an action),
 * pauses on hover.
 */
export function Toast({
  title,
  body,
  action,
  tone = "info",
  width = 380,
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
      className="fixed right-12 bottom-26 z-50 flex max-w-[calc(100vw-32px)] animate-[toast-in_200ms_ease-out] items-start gap-3 rounded-xl bg-brand-ink px-4 py-3.5 shadow-lg motion-reduce:animate-none"
    >
      <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${TONES[tone].wrap}`}>
        <Icon name={TONES[tone].icon} size={14} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-label-m text-text-inverse">{title}</p>
        {body && <p className="text-body-s text-[#c9c6e6]">{body}</p>}
      </div>
      {action && (
        <button
          type="button"
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
          className="rounded text-label-s text-logo-accent hover:underline"
        >
          {action.label}
        </button>
      )}
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="flex rounded">
        <Icon name="icon-x-toast" size={16} />
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
