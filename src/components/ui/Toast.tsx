"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * Toast — bottom-right, auto-hides after 6 s (10 s when it has an action),
 * pauses on hover. Only the Info tone is designed so far.
 */
export function Toast({
  title,
  body,
  action,
  onDismiss,
}: {
  title: string;
  body?: ReactNode;
  action?: { label: string; onClick: () => void };
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
      className="fixed right-12 bottom-26 z-50 flex w-[380px] max-w-[calc(100vw-32px)] animate-[toast-in_200ms_ease-out] items-start gap-3 rounded-xl bg-brand-ink px-4 py-3.5 shadow-lg motion-reduce:animate-none"
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-primary">
        <Icon name="icon-info-white-14" size={14} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-label-m text-text-inverse">{title}</p>
        {body && <p className="text-body-s text-[#c9c6e6]">{body}</p>}
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
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
