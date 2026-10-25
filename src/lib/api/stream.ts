"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { now } from "@/lib/time";

export type CriticalAlertEvent = { id: string; case_id: string | null; risk_score: number; at: number };

export type FeedState = {
  /** live · reconnecting (dropped for 5 s+) · paused (by the analyst) */
  status: "live" | "reconnecting" | "paused";
  since: number | null;
  /** Last time the stream said anything, for “updated 2s ago”. */
  lastEventAt: number | null;
  attempt: number;
  arrived: Set<string>;
  /** The latest critical alert that opened a case, until it’s acknowledged. */
  critical: CriticalAlertEvent | null;
  dismissCritical: () => void;
  reconnect: () => void;
  setPaused: (paused: boolean) => void;
};

/** A critical alert interrupts once per session, not again after every reload. */
const SEEN_KEY = "fd:critical-seen";
function seenCritical(id: string) {
  try {
    return (JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]") as string[]).includes(id);
  } catch {
    return false;
  }
}
function markCriticalSeen(id: string) {
  try {
    const seen = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]") as string[];
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...seen, id])]));
  } catch {
    // Storage blocked: it may show again after a reload.
  }
}

/** Debounce before calling the feed “paused”: brief reconnects stay invisible. */
const PAUSED_AFTER_MS = 5_000;

/**
 * GET /alerts/stream (server-sent events). New and updated alerts refresh the
 * shared alert list; new IDs are kept for the 1200 ms row highlight. On a
 * dropped connection the last data stays on screen and EventSource
 * reconnects by itself (with Last-Event-ID). One connection for the whole
 * app: the shell owns it and shares it through context.
 */
export function useAlertStream(): FeedState {
  const { mutate } = useSWRConfig();
  const [status, setStatus] = useState<"live" | "reconnecting">("live");
  const [paused, setPaused] = useState(false);
  const [since, setSince] = useState<number | null>(null);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [arrived, setArrived] = useState<Set<string>>(new Set());
  const [critical, setCritical] = useState<CriticalAlertEvent | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [errors, setErrors] = useState(0);
  const pausedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (paused) return;
    const source = new EventSource("/api/fd/alerts/stream");

    const onAlert = (e: MessageEvent<string>) => {
      setLastEventAt(now());
      try {
        const alert = JSON.parse(e.data) as { id: string; severity?: string; case_id?: string | null; risk_score?: number };
        if (e.type === "alert.created") {
          setArrived((prev) => new Set(prev).add(alert.id));
          setTimeout(() => setArrived((prev) => {
            const next = new Set(prev);
            next.delete(alert.id);
            return next;
          }), 1200);
          if (alert.severity === "critical" && alert.case_id && !seenCritical(alert.id)) {
            setCritical({ id: alert.id, case_id: alert.case_id, risk_score: alert.risk_score ?? 0, at: now() });
          }
        }
      } catch {
        // Ignore malformed events; the list refresh below still runs.
      }
      void mutate("/alerts");
    };

    source.addEventListener("alert.created", onAlert);
    source.addEventListener("alert.updated", onAlert);
    source.addEventListener("alert.locked", onAlert);
    source.addEventListener("case.assigned", () => void mutate("/cases?view=mine"));

    source.onopen = () => {
      if (pausedTimer.current) clearTimeout(pausedTimer.current);
      pausedTimer.current = null;
      setLastEventAt(now());
      setStatus("live");
      setSince(null);
      setErrors(0);
    };
    source.onerror = () => {
      setErrors((n) => n + 1);
      if (pausedTimer.current) return;
      const droppedAt = now();
      pausedTimer.current = setTimeout(() => {
        setStatus("reconnecting");
        setSince(droppedAt);
      }, PAUSED_AFTER_MS);
    };

    return () => {
      if (pausedTimer.current) clearTimeout(pausedTimer.current);
      pausedTimer.current = null;
      source.close();
    };
  }, [mutate, attempt, paused]);

  const reconnect = useCallback(() => {
    setAttempt((n) => n + 1);
    void mutate("/alerts");
  }, [mutate]);

  return {
    status: paused ? "paused" : status,
    since,
    lastEventAt,
    attempt: errors,
    arrived,
    critical,
    dismissCritical: useCallback(() => {
      setCritical((c) => {
        if (c) markCriticalSeen(c.id);
        return null;
      });
    }, []),
    reconnect,
    setPaused,
  };
}
