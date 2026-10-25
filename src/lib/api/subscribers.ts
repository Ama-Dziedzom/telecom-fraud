"use client";

/**
 * Subscriber 360 and the analysis checks. GET /subscribers/{id} is in the
 * collection; the extra fields and the check endpoints are proposed.
 */
import { useApi, type Money, type Page, type Subscriber } from "./fd";

export type Subscriber360 = Subscriber & {
  initials?: string;
  plan?: string;
  prepaid_since?: string;
  home?: string;
  kyc: Subscriber["kyc"] & { dob_masked?: string };
  device: Subscriber["device"] & { usual_months?: number };
  wallet: Subscriber["wallet"] & { frozen_at?: string; frozen_by?: string; usual_recipients?: string; new_recipients_today?: number };
  counts?: { activity: number; transactions: number; devices: number; cases: number };
  risk_reasons?: Array<{ rule: string; text: string; points: number }>;
  sim_history?: Array<{ at: string; iccid: string; event: "sim_swap" | "new_sim"; where: string; agent: string | null; id_check: string; id_ok: boolean }>;
  devices_on_wallet?: Array<{ model: string; imei: string; first_seen: string; last_seen: string; shared_with: string; risky: boolean }>;
  device_warning?: { title: string; detail: string } | null;
  /** Sources that didn’t answer; their figures are from `*_as_of`. */
  unavailable?: string[];
  wallet_as_of?: string;
  wallet_last_try?: string;
};

export type Outflow = { days: Array<{ date: string; amount: Money }>; typical: { min: Money; max: Money }; today: Money };

export type Behaviour = {
  compared_days: number;
  signals: Array<{ key: string; label: string; usual: string; today: string; unusual: boolean }>;
  daily: Array<{ date: string; amount: Money }>;
  normal_max: Money;
  hours: { usual: number[]; today: number[] };
  places: Array<{ name: string; share: number; today?: boolean }>;
  verdict: { title: string; detail: string } | null;
};

export type SimCheck = {
  status: "duplicate" | "clear";
  sim: string;
  window_hours: number;
  phones: Array<{ label: string; model: string; place: string; cell?: string; seen?: string; imei?: string; note?: string; usual: boolean }>;
  distance_km?: number;
  minutes_apart?: number;
  registrations: Array<{ phone: number; at: string }>;
  overlap?: { from: string; to: string };
  axis: { from: string; to: string };
  also_used?: Array<{ sim: string; msisdn: string; case: { id: string; label: string } | null }>;
  checked?: Array<[string, string]>;
};

export type DeviceCheck = {
  model: string | null;
  imei: string;
  source: string;
  luhn: { valid: boolean; expected: number; actual: number };
  tac: { brand: string; matches: boolean; note: string } | null;
  stolen: { listed: boolean; checked_at: string } | null;
  registry: "ok" | "unavailable";
  registry_last_try?: string;
  other_sims: Array<{ msisdn: string; case: { id: string; label: string } | null }>;
  other_window: string;
};

export type Patterns = {
  transfers: Array<{ at: string; amount: Money; flagged: boolean }>;
  normal_max: Money;
  cluster: { from: string; to: string; count: number; total: Money; minutes: number } | null;
  findings: Array<{ kind: "burst" | "fanout" | "drain"; title: string; headline: string; detail: string }>;
};

export type AuditEvent = { id: string; at: string; actor: { id: string; name: string; initials: string }; action: string; object: string; reason: string };

export const useSubscriber360 = (id: string) => useApi<Subscriber360>(`/subscribers/${id}`);
export const useRecent = (id: string) => useApi<Page<{ at: string; until?: string; text: string; hot: boolean }>>(`/subscribers/${id}/recent`);
export const useOutflow = (id: string, days: number) => useApi<Outflow>(`/subscribers/${id}/outflow?days=${days}`);
export const useBehaviour = (id: string) => useApi<Behaviour>(`/subscribers/${id}/behaviour`);
export const useSimCheck = (id: string) => useApi<SimCheck>(`/subscribers/${id}/sim-check`);
export const useDeviceCheck = (id: string) => useApi<DeviceCheck>(`/subscribers/${id}/device-check`);
export const usePatterns = (id: string, q: string) => useApi<Patterns>(`/subscribers/${id}/patterns?${q}`);
export const useAudit = (object: string) => useApi<Page<AuditEvent>>(`/audit/events?object=${object}`);
