"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Re-renders every second until `until`; returns ms remaining. */
export function useRemaining(until: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, until - now);
}

/** Sunken card with a timer icon and a large mono countdown (A6, E2). */
export function CountdownCard({
  label,
  until,
  tone = "neutral",
  aside,
}: {
  label: string;
  until: number;
  tone?: "neutral" | "medium";
  aside?: ReactNode;
}) {
  const remaining = useRemaining(until);
  return (
    <div className="flex w-full items-center gap-4 rounded-xl bg-surface-sunken px-[18px] py-4">
      <Icon name={tone === "medium" ? "icon-timer-medium" : "icon-timer"} size={22} />
      <div className="flex flex-col gap-0.5">
        <span className="text-caption text-text-secondary">{label}</span>
        <span className="font-mono text-mono-code text-text-primary" role="timer" aria-live="off">
          {formatDuration(remaining)}
        </span>
      </div>
      {aside && <span className="ml-auto text-body-s text-text-secondary">{aside}</span>}
    </div>
  );
}
