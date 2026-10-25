"use client";

import { useSyncExternalStore } from "react";

/**
 * Data the screens need that the App API doesn’t provide yet. Each function
 * resolves locally (design data, or this browser’s storage) and is marked
 * with the missing endpoint, so it can be swapped for a real call without
 * touching the screens.
 */

export type ShiftHandover = {
  author: { name: string; initials: string };
  shift: string;
  at: string;
  note: string;
};

export type Colleague = { id: string; name: string; initials: string; shift: string; startsAt: string };

export type NightHandover = ShiftHandover & {
  shiftHours: string;
  handedCount: number;
  flagged: Array<{ ref: string; href: string; title: string; detail: string }>;
  breachedOvernight: string;
  alertsWaiting: string;
};

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

/** TODO(api): no shift-handover endpoint in the collection (A1, A5–A7). */
export async function getLatestHandover(): Promise<ShiftHandover> {
  return {
    author: { name: "Kwame Asante", initials: "KA" },
    shift: "night shift",
    at: "2026-10-20T07:58:00Z",
    note: "Watch agent 557210 in Adum: 4 cash-outs flagged overnight, linked to FD-3047. The MoMo connector was slow around 03:00.",
  };
}

/** TODO(api): who takes over next (A5). */
export async function getNextShift(): Promise<Colleague> {
  return { id: "usr_kwame", name: "Kwame Asante", initials: "KA", shift: "night", startsAt: "16:00" };
}

/** TODO(api): the full night handover for the start of the day shift (A7). */
export async function getNightHandover(): Promise<NightHandover> {
  return {
    ...(await getLatestHandover()),
    note: "Watch agent 557210 in Adum: 4 cash-outs flagged overnight, linked to FD-3047. The MoMo connector was slow around 03:00 (now fine).",
    shiftHours: "22:00-08:00",
    handedCount: 7,
    flagged: [
      { ref: "FD-3047", href: "/cases/FD-3047", title: "Agent cash-out · Agent 557210", detail: "4 cash-outs overnight: check the agent first" },
      { ref: "FD-3044", href: "/cases/FD-3044", title: "Account takeover", detail: "Efua sent it back: needs the call log" },
      { ref: "AL-88190", href: "/alerts?alert=AL-88190", title: "MoMo velocity · Kasoa", detail: "Came in 07:52, not triaged" },
    ],
    breachedOvernight: "None",
    alertsWaiting: "9 untriaged · oldest 14 min",
  };
}

export type SubmittedHandover = { at: number; to: Colleague; handed: string[]; note: string };

/** TODO(api): store the shift note; the per-case offers use POST /cases/{id}/handover. */
export async function saveHandover(handover: SubmittedHandover) {
  write(handoverKey(handover.at), handover);
}

export const handoverKey = (day: number) => dayKey("fd:handover", day);
export const nightHandoverKey = (day: number) => dayKey("fd:night-handover-read", day);

export function markNightHandoverSeen(day: number) {
  write(nightHandoverKey(day), true);
}

/** First-day “Get set up” checklist (A3) — a per-person convenience. */
export type SetupStep = "alerts" | "tour" | "first_alert";
export const SETUP_KEY = "fd:setup-done";
export function markSetupDone(step: SetupStep, done: SetupStep[]) {
  write(SETUP_KEY, Array.from(new Set([...done, step])));
}
