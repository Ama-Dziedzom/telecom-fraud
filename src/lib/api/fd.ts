"use client";

/**
 * FraudDetection App API — types and data hooks for the operator app.
 * Shapes follow the Postman collection; reads go through SWR so screens
 * that show the same data (sidebar counts, queue, alerts) share one request.
 */
import { useMemo, useSyncExternalStore } from "react";
import useSWR, { type SWRConfiguration } from "swr";
import { apiFetch } from "./client";

export type Severity = "critical" | "high" | "medium" | "low";

export type SubscriberRef = {
  msisdn: string;
  msisdn_ref: string;
  name: string;
  subscriber_id: string;
};

export type Alert = {
  id: string;
  title: string;
  severity: Severity;
  risk_score: number;
  status: "new" | "seen" | "locked" | "auto_case" | "promoted" | "attached" | "dismissed";
  region: string;
  rule_ids: string[];
  created_at: string;
  case_id: string | null;
  subscriber: SubscriberRef;
};

export type CaseStatus =
  | "new"
  | "investigating"
  | "escalated"
  | "sent_back"
  | "pending_decision"
  | "closed";

export type CaseSummary = {
  id: string;
  title: string;
  fraud_type: string;
  stage: "triage" | "investigate" | "act" | "decide" | "closed";
  status: CaseStatus;
  risk_score: number;
  alerts: number;
  sla_due_at: string;
  waiting_since: string;
  money_at_stake: { amount_minor: number; currency: string };
  assignee: { id: string; initials: string; name: string } | null;
  subscriber: SubscriberRef;
};

export type Notification = {
  id: string;
  kind: string;
  title: string;
  link: string;
  at: string;
  read: boolean;
};

export type Page<T> = { data: T[]; next_cursor?: string | null };

export type Money = { amount_minor: number; currency: string };
export type Person = { id: string; name: string; initials: string };

export type AlertDetail = Alert & {
  rules_fired: Array<{ id: string; name: string; points: number }>;
  what_happened: Array<{ at: string; kind: string; label: string; detail: string; amount?: Money; tone?: "critical" }>;
  money_out?: Money;
  /** Proposed: the open case this alert most likely belongs to. */
  suggested_case?: { id: string; title: string; reason: string } | null;
};

export type AlertLock = { alert_id: string; locked_by: Person; expires_at: string };

export type Subscriber = {
  id: string;
  name: string;
  msisdn: string;
  status: string;
  risk_score: number;
  customer_since: string;
  kyc: { ghana_card: string; nia_verified: boolean; verified_at: string; branch?: string; dob_matches?: boolean; address?: string };
  sim: { age_months: number; iccid: string; last_swap_at: string | null; swap_agent: string | null };
  device: { imei: string; model: string; usual_model: string; first_seen: string };
  wallet: { tier: number; status: string; balance: Money; daily_limit: Money; usual_monthly_out: Money };
  contact: { alt_msisdn: string; language: string; last_called_at: string | null };
  cases: CaseSummary[];
};

export type ActivityEvent = {
  id: string;
  at: string;
  source: string;
  actor?: Person | null;
  title: string;
  detail: string;
  kind: string;
};

export type DeviceRecord = {
  imei: string;
  model: string;
  first_seen: string;
  last_seen: string;
  eir_status: string;
  sim_iccid: string;
  kind?: "device" | "sim";
  note?: string;
};

export type Transaction = {
  id: string;
  at: string;
  amount: Money;
  counterparty: string;
  counterparty_note: string;
  direction: "in" | "out";
  flagged: boolean;
  type: string;
  where_now?: string;
};

export type TransactionPage = {
  data: Transaction[];
  totals: { balance: Money; flagged: number; total: number; out_since_swap?: Money; out?: Money; window_minutes?: number };
};

export type CaseSuggestion = {
  case: Pick<CaseSummary, "id" | "title" | "assignee" | "fraud_type">;
  match: string;
  strength: "suggested" | "possible" | "weak";
};

/** POST /alerts/{id}/protect and /cases/{id}/actions both answer with an action. */
export type ActionPart = {
  kind: string;
  target?: string;
  targets?: string[];
  days?: number;
  status: "pending" | "applied" | "failed";
  code?: string;
  at?: string;
  reference?: string;
};
export type ProtectiveAction = {
  id: string;
  case_id: string;
  status: string;
  requested_by: Person;
  requested_at: string;
  parts: ActionPart[];
};

export type Overview = {
  period: string;
  kpis: Array<{ key: string; value: number; unit: string; change: number; spark: number[] }>;
  fraud_mix: Array<{ fraud_type: string; share_pct: number }>;
  hotspots: Array<{ area: string; alerts: number }>;
  right_now: Alert[];
};

const fetcher = <T>(path: string) => apiFetch<T>("GET", path);

export function useApi<T>(path: string | null, config?: SWRConfiguration<T>) {
  return useSWR<T>(path, fetcher, { revalidateOnFocus: false, ...config });
}

export const useMyCases = () => useApi<Page<CaseSummary>>("/cases?view=mine");
export const useAlert = (id: string | null) => useApi<AlertDetail>(id && `/alerts/${id}`);
export const useSubscriber = (id: string | null | undefined) => useApi<Subscriber>(id ? `/subscribers/${id}` : null);
export const useSubscriberActivity = (id: string | null | undefined) =>
  useApi<Page<ActivityEvent>>(id ? `/subscribers/${id}/activity` : null);
export const useDevices = (id: string | null | undefined) => useApi<Page<DeviceRecord>>(id ? `/subscribers/${id}/devices` : null);
/** Proposed endpoint (TODO(api)): transfers around the alert. */
export const useAlertTransactions = (id: string | null) => useApi<TransactionPage>(id && `/alerts/${id}/transactions`);
/** Proposed endpoint (TODO(api)): open cases this alert could join. */
export const useCaseSuggestions = (id: string | null) => useApi<Page<CaseSuggestion>>(id && `/alerts/${id}/case-suggestions`);

// ─── Alerts list, with this session’s triage decisions applied ────────────

/**
 * Triage changes an alert’s status straight away; the list keeps showing the
 * decision until the server’s copy catches up (or is undone).
 */
type AlertPatch = Partial<Pick<Alert, "status" | "case_id">>;
const alertPatches = new Map<string, AlertPatch>();
const patchListeners = new Set<() => void>();
let patchVersion = 0;

export function patchAlert(id: string, patch: AlertPatch | null) {
  if (patch) alertPatches.set(id, { ...alertPatches.get(id), ...patch });
  else alertPatches.delete(id);
  patchVersion++;
  patchListeners.forEach((l) => l());
}

function useAlertPatchVersion() {
  return useSyncExternalStore(
    (cb) => {
      patchListeners.add(cb);
      return () => patchListeners.delete(cb);
    },
    () => patchVersion,
    () => 0,
  );
}

export function useAlerts() {
  const result = useApi<Page<Alert>>("/alerts", { refreshInterval: 30_000 });
  const version = useAlertPatchVersion();
  const data = useMemo(
    () =>
      result.data && {
        ...result.data,
        data: result.data.data.map((a) => (alertPatches.has(a.id) ? { ...a, ...alertPatches.get(a.id) } : a)),
      },
    // `version` re-applies the patches when one changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result.data, version],
  );
  return { ...result, data };
}
export const useNotifications = () => useApi<Page<Notification>>("/notifications");
export const useOverview = (period = "today", scope = "me") =>
  useApi<Overview>(`/insights/overview?period=${period}&scope=${scope}`);

// ─── Labels ───────────────────────────────────────────────────────────────

const FRAUD_TYPES: Record<string, string> = {
  sim_swap_to_momo: "SIM swap to MoMo",
  momo_velocity: "MoMo velocity",
  agent_cash_out: "Agent cash-out",
  sim_box_bypass: "Bypass (SIM box)",
  account_takeover: "Account takeover",
  wangiri: "Wangiri",
  other: "Other",
};

export const fraudTypeLabel = (t: string) => FRAUD_TYPES[t] ?? t.replace(/_/g, " ");

/** Alerts that still need someone to look at them. */
export const isOpenAlert = (a: Alert) => a.status === "new" || a.status === "seen" || a.status === "locked";

const REGIONS: Record<string, string> = {
  Accra: "Greater Accra", Tema: "Greater Accra", Ashaiman: "Greater Accra", Kasoa: "Central",
  "Cape Coast": "Central", Kumasi: "Ashanti", Takoradi: "Western", Ho: "Volta",
};
/** Town → administrative region, for the region filter. */
export const regionOf = (town: string) => REGIONS[town] ?? "Other";

const FRAUD_FROM_RULE: Array<[RegExp, string]> = [
  [/^R-1/, "sim_swap"], [/^R-2|^R-3/, "momo_fraud"], [/^R-4/, "account_takeover"],
  [/^R-5/, "sim_box_bypass"], [/^R-6/, "wangiri"], [/^R-7/, "agent_cash_out"], [/^R-9/, "device"],
];
/** Fraud family of an alert, from its first rule (rules are numbered by family). */
export const alertFamily = (a: Pick<Alert, "rule_ids">) =>
  FRAUD_FROM_RULE.find(([re]) => re.test(a.rule_ids[0] ?? ""))?.[1] ?? "other";

export const FAMILY_LABELS: Record<string, string> = {
  momo_fraud: "MoMo fraud", sim_swap: "SIM swap", sim_box_bypass: "Bypass / SIM box",
  account_takeover: "Account takeover", wangiri: "Wangiri", agent_cash_out: "Agent cash-out", device: "Device", other: "Other",
};
