"use client";

/**
 * Subscriber 360’s extra panels and the analysis checks. The profile itself
 * is `Subscriber` / `useSubscriber` in ./fd.
 */
import { useApi, type Money, type Page } from "./fd";

export type Outflow = { days: Array<{ date: string; amount: Money }>; typical: { min: Money; max: Money }; today: Money };

/** Newest first. `text` is written by the event pipeline. */
export type RecentEvent = {
  at: string;
  until?: string;
  kind: string;
  text: string;
  amount?: Money;
  flagged: boolean;
  case_id?: string;
};

type Signal<T> = { usual: T; today: T; unusual: boolean };
export type Behaviour = {
  compared_days: number;
  signals: {
    place: Signal<string>;
    device: Signal<string>;
    active_hours: Signal<{ from: string; to: string }>;
    average_transfer: Signal<Money>;
    recipients: Signal<number> & { today_new: number };
  };
  daily: Array<{ date: string; amount: Money }>;
  normal_max: Money;
  hours: { usual: number[]; today: number[] };
  places: Array<{ name: string; share_pct: number; today_only: boolean }>;
  /** `title` and `detail` are engine text. */
  verdict: { kind: string; title: string; detail: string } | null;
};

/** A case another number or SIM is in, with how it ended. */
export type LinkedCase = { id: string; outcome: string };

export type SimCheck = {
  status: "duplicate" | "clear";
  iccid: string;
  window_hours: number;
  /** `index` is the phone’s lane; registrations point at it. */
  phones: Array<{
    index: number;
    model: string;
    place: string;
    cell_id: string;
    imei: string;
    usual: boolean;
    used_months: number;
    first_seen_at: string;
    last_seen_at: string;
  }>;
  distance_km: number | null;
  minutes_apart: number | null;
  registrations: Array<{ phone: number; at: string }>;
  overlap: { from: string; to: string } | null;
  axis: { from: string; to: string };
  also_used: Array<{ iccid: string; msisdn: string; case: LinkedCase | null }>;
};

export type DeviceCheck = {
  model: string | null;
  imei: string;
  /** Index of the phone in the SIM check this IMEI came from. */
  from_phone: number | null;
  first_seen_on_sim_at: string;
  luhn: { valid: boolean; expected_digit: number; actual_digit: number };
  /** Null while the device registry is unavailable. */
  tac: { brand: string; model: string; year: number; matches_reported_model: boolean } | null;
  stolen: { listed: boolean; checked_at: string } | null;
  registry: "ok" | "unavailable";
  /** TODO(api): 0.2 doesn’t say when the registry was last tried (C25). */
  registry_last_try?: string;
  other_sims: { window_days: number; data: Array<{ msisdn: string; case: LinkedCase | null }> };
};

export type Patterns = {
  transfers: Array<{ at: string; amount: Money; flagged: boolean }>;
  normal_max: Money;
  cluster: { from: string; to: string; count: number; total: Money; minutes: number } | null;
  /** `headline` and `detail` are engine text. */
  findings: Array<{ kind: "burst" | "fan_out" | "drain"; headline: string; detail: string }>;
};

export type AuditEvent = { id: string; at: string; actor: { id: string; name: string; initials: string }; action: string; object: string; reason: string };

/** Lane name for a phone in the SIM and device checks (index 0 → Phone A). */
export const phoneLabel = (index: number) => `Phone ${String.fromCharCode(65 + index)}`;

export const useRecent = (id: string) => useApi<Page<RecentEvent>>(`/subscribers/${id}/recent`);
export const useOutflow = (id: string, days: number) => useApi<Outflow>(`/subscribers/${id}/outflow?days=${days}`);
export const useBehaviour = (id: string) => useApi<Behaviour>(`/subscribers/${id}/behaviour`);
export const useSimCheck = (id: string) => useApi<SimCheck>(`/subscribers/${id}/sim-check`);
export const useDeviceCheck = (id: string) => useApi<DeviceCheck>(`/subscribers/${id}/device-check`);
export const usePatterns = (id: string, q: string) => useApi<Patterns>(`/subscribers/${id}/patterns?${q}`);
export const useAudit = (object: string) => useApi<Page<AuditEvent>>(`/audit/events?object=${object}`);
