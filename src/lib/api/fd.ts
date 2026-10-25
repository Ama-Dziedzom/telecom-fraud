"use client";

/**
 * FraudDetection App API — types and data hooks for the operator app.
 * Shapes follow API 0.2 (FraudDetection-mock.postman_collection.json):
 * responses carry data and codes, and the app writes every label, colour and
 * icon. Reads go through SWR so screens that show the same data (sidebar
 * counts, queue, alerts) share one request.
 */
import { useMemo, useSyncExternalStore } from "react";
import useSWR, { mutate, type SWRConfiguration } from "swr";
import { apiFetch } from "./client";

export type Severity = "critical" | "high" | "medium" | "low";

export type SubscriberRef = {
  msisdn: string;
  msisdn_ref: string;
  name: string;
  subscriber_id: string;
};

export type Money = { amount_minor: number; currency: string };
export type PersonRef = { id: string; name: string; initials: string };
/** @deprecated Same shape as PersonRef, the name the API uses. */
export type Person = PersonRef;

/** AlertSummary in the API. */
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
  fraud_type: string;
  /** Null when no money moved. */
  money_out: Money | null;
};

export type AlertPage = Page<Alert> & {
  summary: {
    by_severity: Partial<Record<Severity, number>>;
    by_fraud_type: Record<string, number>;
    by_region: Record<string, number>;
  };
};

export type CaseStatus =
  | "new"
  | "investigating"
  | "escalated"
  | "sent_back"
  | "pending_decision"
  | "closed"
  | "reopened";

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
  money_at_stake: Money;
  assignee: PersonRef | null;
  subscriber: SubscriberRef;
  region: string;
  /** Decide-stage cases: when the reviewer is due to answer, and who. */
  decision_due_at?: string;
  reviewer?: PersonRef;
};

/** GET /cases?view=mine: the list plus the counts behind the scope switch, status tabs and pick-up room. */
export type MyCases = Page<CaseSummary> & {
  counts: { mine: number; team_queue: number; all: number; by_status: Partial<Record<CaseStatus, number>> };
  closed_this_month: number;
  capacity: { open_cases: number; limit: number };
};

/** GET /search: one hit per match, with the data for its kind. */
export type SearchHit = {
  kind: "subscriber" | "case" | "alert";
  id: string;
  best: boolean;
  open_cases?: number;
  subscriber?: SubscriberRef & {
    area: string;
    wallet_tier: number | null;
    status: string;
    inactive_since?: string;
  };
  case?: Pick<CaseSummary, "id" | "title" | "fraud_type" | "risk_score" | "stage" | "status" | "subscriber" | "assignee">;
  alert?: Pick<Alert, "id" | "title" | "severity" | "risk_score" | "status" | "case_id" | "created_at">;
};
export type SearchResult = {
  detected_type: string;
  data: SearchHit[];
  /** No match: the highest case ID, and near misses. */
  max_case_id?: string;
  did_you_mean?: SearchHit[];
  /** No match, and the number belongs to another operator. */
  other_operator?: { id: string; name: string };
};

export type Notification = {
  id: string;
  at: string;
  kind: string;
  category: string;
  actor: PersonRef | null;
  /** Engine text. */
  title: string;
  body: string;
  link: string;
  read: boolean;
};

/** Lists shown with page numbers send `page` instead of `cursor` and get `page` and `total` back. */
export type Page<T> = { data: T[]; next_cursor?: string | null; page?: number; total?: number };

/** One step of the alert’s story. `label` and `detail` are engine text; `links` are case IDs it mentions. */
export type AlertStep = { at: string; kind: string; label: string; detail: string; amount?: Money; links?: string[] };

export type AlertDetail = Alert & {
  rules_fired: Array<{ id: string; name: string; points: number }>;
  what_happened: AlertStep[];
  /** The open case this alert most likely belongs to; `why` is engine text. Only sent when the engine found one. */
  suggested_case?: { case_id: string; why: string } | null;
  locked_by?: PersonRef | null;
};

export type AlertLock = { alert_id: string; locked_by: PersonRef; expires_at: string };

/** POST /alerts/{id}/dismiss: the alert, dismissed, and how long undo-dismiss is allowed. */
export type DismissedAlert = Alert & { undo_until: string };

/** POST /alerts/bulk: each alert succeeds or fails on its own (`locked` comes with `locked_by`). */
export type BulkTriageResult = {
  done: string[];
  failed: Array<{ id: string; code: string; locked_by?: PersonRef | null }>;
};

/** GET /subscribers/{id}: Subscriber 360. Masked values (`msisdn`, `kyc.date_of_birth`) come masked; POST …/reveal unmasks them. */
export type Subscriber = {
  id: string;
  name: string;
  initials: string;
  msisdn: string;
  status: string;
  risk_score: number;
  /** Date. */
  customer_since: string;
  plan: "prepaid" | "postpaid";
  home: string;
  kyc: {
    ghana_card: string;
    nia_verified: boolean;
    /** Date. */
    verified_at: string;
    branch: string;
    /** Masked (“•• ••• 1987”). */
    date_of_birth: string;
    date_of_birth_matches: boolean;
    address: string;
  };
  sim: { iccid: string; age_months: number; last_swap_at: string | null; swap_agent: string | null };
  device: { model: string; imei: string; first_seen: string; usual_model: string; usual_months: number };
  wallet: {
    tier: number;
    daily_limit: Money;
    balance: Money;
    status: string;
    usual_monthly_out: Money;
    frozen_at: string | null;
    frozen_by: PersonRef | null;
    usual_recipients: number;
    new_recipients_today: number;
  };
  contact: { alt_msisdn: string; language: string; last_called_at: string | null };
  cases: CaseSummary[];
  counts: { activity: number; transactions: number; devices: number; cases: number };
  /** `text` is engine text. */
  risk_reasons: Array<{ rule_id: string; text: string; points: number }>;
  sim_history: Array<{
    at: string;
    iccid: string;
    event: "sim_swap" | "new_sim";
    place: string;
    agent: string | null;
    id_check: { document: string; method: string; matched: boolean };
  }>;
  devices_on_wallet: Array<{
    model: string;
    imei: string;
    first_seen: string;
    last_seen: string;
    /** Wallets this device was used on in the last 24 hours, this one included. */
    wallets_24h: number;
    case_ids: string[];
    risky: boolean;
  }>;
  /** Engine text. */
  device_warning: { title: string; detail: string } | null;
  /** Sources that didn’t answer (“wallet” when MoMo is down). */
  unavailable: string[];
  /** TODO(api): 0.2 doesn’t say how old the wallet figures are when MoMo is down (C16). */
  wallet_as_of?: string;
  wallet_last_try?: string;
};

export type ActivityEvent = {
  id: string;
  at: string;
  source: string;
  /** Only on events a person did. */
  actor?: PersonRef;
  kind: string;
  /** Engine text. */
  title: string;
};

export type DeviceRecord = {
  imei: string;
  model: string;
  first_seen: string;
  last_seen: string;
  eir_status: string;
  sim_iccid: string;
};

export type Transaction = {
  id: string;
  at: string;
  amount: Money;
  counterparty: string;
  /** First time this subject paid that counterparty. */
  counterparty_new: boolean;
  /** A case the counterparty is already evidence in. */
  counterparty_case_id: string | null;
  direction: "in" | "out";
  flagged: boolean;
  type: string;
  /** Case and subscriber transactions only. */
  where_now?: "in_wallet" | "cashed_out" | "agent_holds";
};

export type TransactionPage = {
  data: Transaction[];
  totals: { balance: Money; flagged: number; total: number; out_since_swap?: Money; out?: Money; window_minutes?: number };
};

export type CaseSuggestion = {
  case: Pick<CaseSummary, "id" | "title" | "fraud_type" | "stage" | "assignee">;
  strength: "suggested" | "possible" | "weak";
  /** Codes such as `same_recipient_wallet`, `same_region`, `same_time_window`, `same_device_model`. */
  match_kinds: string[];
  /** Engine text. */
  reason: string;
};

/** POST /alerts/{id}/protect and /cases/{id}/actions both answer with an action. */
export type ActionPart = {
  kind: string;
  target?: string;
  targets?: string[];
  days?: number;
  status: "pending" | "applied" | "failed";
  /** Why a part failed (`feed_unavailable`, `upstream_timeout`…); null until then. */
  code?: string | null;
  at?: string | null;
  reference?: string | null;
};
export type ProtectiveAction = {
  id: string;
  case_id: string;
  status: string;
  requested_by: Person;
  requested_at: string;
  parts: ActionPart[];
};

/** One overview tile. `breakdown` holds counts or Money, by key (`open`, `critical`, `frozen`, `lost`…). */
export type OverviewKpi = {
  key: string;
  unit: "count" | "cases" | "minutes" | "percent" | "money";
  value: number | null;
  money: Money | null;
  /** Against the previous period, in the KPI’s unit. */
  change: number | null;
  breakdown: Record<string, number | Money>;
  /** Today only. */
  spark?: number[];
  basis?: string;
  noisiest_rule?: string;
};

type OverviewBase = {
  scope: "me" | "team" | "operator";
  updated_at: string;
  kpis: OverviewKpi[];
  fraud_mix: Array<{ fraud_type: string; share_pct: number }>;
  /** A widget that failed on its own, by widget. Its data is null. */
  widget_errors: Partial<Record<"hotspots" | "right_now" | "fraud_mix", { code: string; retry_after_seconds: number }>>;
};

/** GET /insights/overview. Today is live; a week or month adds the daily series and rule precision. */
export type Overview =
  | (OverviewBase & {
      period: "today";
      open_alerts: number;
      hotspots: Array<{ area: string; alerts: number }> | null;
      right_now: Alert[];
    })
  | (OverviewBase & {
      period: "7d" | "30d";
      daily: Array<{ date: string; alerts: number; cases: number }>;
      rules: Array<{ id: string; name: string; hits: number; precision_pct: number; your_fp_feedback: number }>;
    });

const fetcher = <T>(path: string) => apiFetch<T>("GET", path);

export function useApi<T>(path: string | null, config?: SWRConfiguration<T>) {
  return useSWR<T>(path, fetcher, { revalidateOnFocus: false, ...config });
}

export const useMyCases = () => useApi<MyCases>("/cases?view=mine");
export const useAlert = (id: string | null) => useApi<AlertDetail>(id && `/alerts/${id}`);
export const useSubscriber = (id: string | null | undefined) => useApi<Subscriber>(id ? `/subscribers/${id}` : null);
export const useSubscriberActivity = (id: string | null | undefined) =>
  useApi<Page<ActivityEvent>>(id ? `/subscribers/${id}/activity` : null);
export const useDevices = (id: string | null | undefined) => useApi<Page<DeviceRecord>>(id ? `/subscribers/${id}/devices` : null);
/** The drawer’s Transactions tab, before there is a case. */
export const useAlertTransactions = (id: string | null) => useApi<TransactionPage>(id && `/alerts/${id}/transactions`);
/** Open cases this alert could join, for “Add to case”. */
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
  const result = useApi<AlertPage>("/alerts", { refreshInterval: 30_000 });
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
export const useNotifications = () => useApi<Page<Notification> & { unread: number }>("/notifications");

/** POST /notifications/read-all, shown as read straight away (the list isn’t fetched again). */
export async function markAllNotificationsRead(before: number) {
  await apiFetch("POST", "/notifications/read-all", { before: new Date(before).toISOString().replace(/\.\d{3}Z$/, "Z") });
  await mutate<Page<Notification> & { unread: number }>(
    "/notifications",
    (d) => d && { ...d, unread: 0, data: d.data.map((n) => ({ ...n, read: true })) },
    { revalidate: false },
  );
}

/** GET /insights/me: the queue’s “Resolved today” and “My first response” tiles. */
export type MyInsights = {
  period: string;
  resolved: number;
  resolved_avg: number;
  first_response_median_minutes: number;
  first_response_sla_minutes: number;
};
export const useMyInsights = () => useApi<MyInsights>("/insights/me?period=today");
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

