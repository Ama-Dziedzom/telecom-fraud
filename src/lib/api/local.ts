"use client";

import { useSyncExternalStore } from "react";
import { apiFetch } from "./client";
import { useApi, type PersonRef } from "./fd";

/**
 * Shift handover (GET /handovers/shift/latest, POST /handovers/shift), plus
 * what only this browser needs to remember: which handover note was already
 * read today, the handover sent today and the first-day checklist.
 */

export type HandoverChoice = "hand_over" | "keep" | "watch";

export type ShiftHandover = {
  id: string;
  from: PersonRef;
  to: PersonRef;
  shift: { name: string; starts: string; ends: string };
  at: string;
  note: string;
  cases: Array<{ case_id: string; choice: HandoverChoice }>;
  read_at: string | null;
};

/** The note the previous shift left for me. */
export const useLatestHandover = () => useApi<ShiftHandover>("/handovers/shift/latest");

/** Day 08:00-16:00 · evening 16:00-00:00 · night 00:00-08:00, from “16:00-00:00” or “16:00”. */
export function shiftName(hours: string) {
  return { "00": "night", "08": "day", "16": "evening" }[hours.slice(0, 2)] ?? hours;
}

const listeners = new Set<() => void>();
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the screen still works for this visit.
  }
  listeners.forEach((l) => l());
};

/** Subscribes to a stored value without reading storage during the server render. */
export function useStored<T>(key: string | null): T | null {
  const raw = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      try {
        return key ? localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    },
    () => null,
  );
  try {
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

const dayKey = (prefix: string, day: number) => `${prefix}:${new Date(day).toDateString()}`;

/** What the queue shows after handing over: the server’s handover, plus when the next shift starts. */
export type SubmittedHandover = ShiftHandover & { submitted_at: number; starts_at: string };

export async function submitHandover(
  body: { to_user_id: string; note?: string; cases: ShiftHandover["cases"] },
  startsAt: string,
  at: number,
) {
  const handover = await apiFetch<ShiftHandover>("POST", "/handovers/shift", body);
  const submitted: SubmittedHandover = { ...handover, submitted_at: at, starts_at: startsAt };
  write(handoverKey(at), submitted);
  return submitted;
}

export const handoverKey = (day: number) => dayKey("fd:handover", day);
export const nightHandoverKey = (day: number) => dayKey("fd:night-handover-read", day);

/** TODO(api): 0.2 has no call to mark the handover read (`read_at`), so this browser remembers it per day. */
export function markNightHandoverSeen(day: number) {
  write(nightHandoverKey(day), true);
}

/** First-day “Get set up” checklist (A3) — a per-person convenience. */
export type SetupStep = "alerts" | "tour" | "first_alert";
export const SETUP_KEY = "fd:setup-done";
export function markSetupDone(step: SetupStep, done: SetupStep[]) {
  write(SETUP_KEY, Array.from(new Set([...done, step])));
}
