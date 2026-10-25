"use client";

/**
 * Case workspace — types and hooks for /cases/{id} and the subscriber views
 * it opens. Shapes follow the Postman collection; fields marked “proposed”
 * are in the list of collection additions.
 */
import {
  useApi,
  type Alert,
  type Money,
  type Page,
  type Person,
  type ProtectiveAction,
  type Severity,
  type Transaction,
  type TransactionPage,
} from "./fd";

export type CaseStage = "triage" | "investigate" | "act" | "decide" | "closed" | "monitor" | "prospect";

export type StoryStep = {
  at: string;
  kind: string;
  label: string;
  detail?: string;
  amount?: Money;
  links?: string[];
};

export type NextStepKind =
  | "freeze_wallet"
  | "call_subscriber"
  | "request_reversal"
  | "report_agent"
  | "suspend_sim"
  | "block_recipients"
  | "add_evidence"
  | "await_signoff"
  | "watch_repeat";

export type CaseDetail = {
  id: string;
  title: string;
  stage: CaseStage;
  status: "new" | "investigating" | "escalated" | "sent_back" | "pending_decision" | "closed" | "reopened";
  severity: Severity;
  subject: { subscriber_id: string; name: string; msisdn: string; msisdn_ref: string };
  assignee: Person | null;
  opened: { at: string; from_alert: string | null };
  glance: {
    risk_score: number;
    rules_fired: number;
    fraud_type: string;
    money: { label: "money_at_stake" | "money_out" | "being_recovered" | "recovered" | "lost"; amount: Money; note: string };
    first_response: { met: boolean; minutes: number | null; sla_minutes: number };
  };
  what_happened: StoryStep[];
  next_steps: {
    done: NextStepKind[];
    recommended: { kind: NextStepKind; title: string; detail: string } | null;
    remaining: NextStepKind[];
  };
  linked_cases: string[];
  resolution: Resolution | null;
  /** Proposed: the supervisor turned the proposed outcome down (E7). */
  rejection?: {
    by: Person;
    at: string;
    proposed: string;
    comment: string;
    submitted: { summary: string; facts: Array<[string, string, string?]> };
    steps: string[];
  } | null;
  monitoring?: { days: number; until: string; reopen_on_repeat: boolean } | null;
  /** Proposed: SLA state in words, for the compact summary strip. */
  sla?: { label: string; tone: string } | null;
  banners: Array<{ kind: string; title: string; detail: string; at: string }>;
  /** Proposed: tab counts, so the tab row doesn’t need every list loaded. */
  counts?: { linked_alerts: number; timeline: number; transactions: number; evidence: number };
  /** Proposed: what’s in flight, so the page can show progress and results. */
  latest_action?: ProtectiveAction | null;
  reversal?: { id: string; status: string; requested: Money; secured: Money } | null;
  escalation?: Escalation | null;
  handover?: { to: Colleague; note: string; status: "offered" | "accepted" | "declined"; at: string } | null;
  contact?: { alt_msisdn: string; registered: string; language: string };
};

export type Outcome = "confirmed_fraud" | "false_positive" | "inconclusive";

export type Resolution = {
  outcome: Outcome;
  summary: string;
  amount_lost?: Money;
  amount_recovered?: Money;
  submitted_at: string;
  submitted_by: Person;
  status: "pending_decision" | "sent_back" | "closed";
  reviewer?: Person;
  due_at?: string;
  sent_back?: { at: string; comment: string } | null;
  signed_off?: { by: string; at: string } | null;
  resubmitted_at?: string;
  regulator_report?: string | null;
  linked?: string[];
  reason?: string;
  rule_feedback?: string | null;
  watch_days?: number;
  reopen_on_repeat?: boolean;
};

export type Escalation = {
  id: string;
  kind: string;
  to: Person & { role?: string };
  question: string;
  priority: "urgent" | "high" | "normal";
  sent_at: string;
  reply_due_at: string;
  status: "waiting" | "answered";
  answer: { decision: string; label: string; comment: string } | null;
  answered_at?: string;
};

export type Reversal = {
  id: string;
  case_id: string;
  status: "accepted" | "held" | "returning" | "closed";
  requested: Money;
  secured: Money;
  steps: Array<{ step: string; at: string | null; by?: string; detail?: string }>;
  results: Array<{ payment_id: string; to: string; sent: Money; result: "recovered" | "cashed_out" | "declined" | "pending"; recovered: Money; reason?: string }>;
};

export type Agent = {
  code: string;
  name: string;
  outlet: string;
  status: string;
  linked_cases: string[];
  sim_swaps_by_day: Array<{ date: string; count: number }>;
  swaps_today?: number;
  swaps_became_fraud?: number;
  id_mismatches?: number;
  customers_30d?: number;
};

export type LinkedAlert = Alert & {
  /** Proposed: how the alert joined the case. */
  link?: { kind: "opened" | "auto" | "manual"; by?: Person | null; at?: string };
};

export type TimelineEvent = {
  id: string;
  at: string;
  kind: string;
  source: "person" | "system" | "momo" | "network" | "crm";
  actor?: Person | null;
  title: string;
  detail?: string;
};

export type Evidence = {
  id: string;
  title: string;
  kind: "call_log" | "transactions" | "file" | "auto" | "note";
  mime_type: string;
  pages: number;
  size_bytes: number;
  sha256: string;
  attached_by: Person | null;
  attached_at: string;
  supports_event_id: string | null;
  retention_until: string;
  /** Proposed: one-line description (“3 transactions · saved by …”). */
  summary?: string;
};

export type NetworkNode = {
  id: string;
  label: string;
  type: "subscriber" | "wallet" | "device" | "agent" | "case";
  risk: "low" | "medium" | "high" | "confirmed";
  /** Proposed: small caption under the label (“Recipient”, “Mule”). */
  role?: string;
  hop?: number;
};
export type NetworkEdge = { from: string; to: string; kind: string; count: number; amount?: Money };
export type Network = {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  returned_hops: number;
  total_entities: number;
  truncated: boolean;
  suggested_filters: Array<{ estimate: number; label: string; detail?: string; params: Record<string, unknown> }>;
  /** Proposed: sources that didn’t answer (“wallet” links from MoMo). */
  unavailable?: string[];
  /** Proposed: the one thing worth knowing about this view. */
  insight?: { title: string; detail: string };
  new_today?: Partial<Record<NetworkNode["type"], number>>;
  shown_entities?: number;
  summary?: Array<[string, string, string?]>;
};

export type Colleague = Person & {
  role: string;
  on_shift: boolean;
  note?: string;
  skills?: string;
  open_cases?: number;
  limit?: number;
  reply_minutes?: number;
};

export const useCase = (id: string) => useApi<CaseDetail>(`/cases/${id}`);
export const useLinkedAlerts = (id: string) => useApi<Page<LinkedAlert>>(`/cases/${id}/linked-alerts`);
export const useTimeline = (id: string) => useApi<Page<TimelineEvent> & { next_cursor: string | null }>(`/cases/${id}/timeline`);
export const useCaseTransactions = (id: string) => useApi<TransactionPage>(`/cases/${id}/transactions`);
export const useEvidence = (id: string) => useApi<Page<Evidence>>(`/cases/${id}/evidence`);
export const useNetwork = (seed: string | null, hops = 2) =>
  useApi<Network>(seed ? `/network?seed=${encodeURIComponent(seed)}&hops=${hops}` : null);
export const useReversal = (id: string | null | undefined) => useApi<Reversal>(id ? `/reversals/${id}` : null);
export const useAgent = (code: string | null) => useApi<Agent>(code ? `/agents/${code}` : null);
/** Proposed (TODO(api)): colleagues you can @mention or hand work to. */
export const useColleagues = () => useApi<Page<Colleague>>("/people");

export const STAGES: Array<{ id: CaseStage; label: string }> = [
  { id: "triage", label: "Alert" },
  { id: "investigate", label: "Investigate" },
  { id: "act", label: "Act" },
  { id: "decide", label: "Decide" },
  { id: "closed", label: "Closed" },
  { id: "monitor", label: "Monitor" },
];

export const NEXT_STEP_LABELS: Record<NextStepKind, string> = {
  freeze_wallet: "Freeze wallet",
  call_subscriber: "Call subscriber",
  request_reversal: "Request reversal",
  report_agent: "Report agent",
  suspend_sim: "Suspend SIM",
  block_recipients: "Block recipients",
  add_evidence: "Go to Evidence",
  await_signoff: "Remind Efua",
  watch_repeat: "Set up monitoring",
};

export type { Transaction };
