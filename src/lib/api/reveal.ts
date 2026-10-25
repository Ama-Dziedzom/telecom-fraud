"use client";

import { useSyncExternalStore } from "react";
import { apiFetch } from "./client";
import { now } from "@/lib/time";

/**
 * Revealed personal details (C14/C15). POST /subscribers/{id}/reveal needs a
 * reason, is audited, and the values expire — here they live in memory only,
 * never in storage, and disappear at `expires_at` or when hidden.
 */
export type Revealed = {
  values: Partial<Record<"msisdn" | "name" | "dob" | "ghana_card" | "alt_msisdn", string>>;
  expires_at: string;
  reason: string;
  case_id?: string;
};

const revealed = new Map<string, Revealed>();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

export async function reveal(subscriberId: string, request: { reason: string; case_id?: string; note?: string }) {
  const res = await apiFetch<Revealed>("POST", `/subscribers/${subscriberId}/reveal`, {
    fields: ["msisdn", "name", "dob", "ghana_card", "alt_msisdn"],
    ...request,
  });
  // The mock’s expiry is a placeholder date; 15 minutes is the rule.
  const expires = Date.parse(res.expires_at);
  const entry = {
    ...res,
    expires_at: Number.isFinite(expires) && expires > now() ? res.expires_at : new Date(now() + 15 * 60_000).toISOString(),
    reason: request.reason,
    case_id: request.case_id,
  };
  revealed.set(subscriberId, entry);
  emit();
  setTimeout(() => hide(subscriberId), Date.parse(entry.expires_at) - now());
  return entry;
}

export function hide(subscriberId: string) {
  if (revealed.delete(subscriberId)) emit();
}

export function useRevealed(subscriberId: string | null | undefined) {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => 0,
  );
  const entry = subscriberId ? revealed.get(subscriberId) : undefined;
  return entry && Date.parse(entry.expires_at) > now() ? entry : null;
}
