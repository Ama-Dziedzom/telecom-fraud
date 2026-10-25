"use client";

/**
 * Case workspace — types and hooks for /cases/{id} and the subscriber views
 * it opens. Shapes follow API 0.2 (FraudDetection-mock.postman_collection.json):
 * ISO dates, Money, PersonRef and codes; the workspace writes the labels.
 */
import {
  useApi,
  type Alert,
  type CaseStatus,
  type Money,
  type Page,
  type PersonRef,
  type ProtectiveAction,
  type Severity,
  type SubscriberRef,
  type Transaction,
  type TransactionPage,
} from "./fd";

export type CaseStage = "triage" | "investigate" | "act" | "decide" | "closed" | "monitor" | "prospect";

/** One step of “What happened”. `label` and `detail` are engine text; `links` are case IDs. */
export type StoryStep = {
  at: string;
  kind: string;
  label: string;
  detail?: string;
  amount?: Money;
  links?: string[];
};

export type NextStepKind =
  | "start"
  | "pick_up"
  | "freeze_wallet"
  | "suspend_sim"
  | "block_recipients"
  | "call_subscriber"
  | "request_reversal"
  | "report_agent"
  | "agent_suspension"
  | "link_case"
  | "add_evidence"
  | "wait"
  | "watch_repeat"
  | "none";

/**
 * A banner on the case; `title` and `detail` are engine text. Kinds: `new`,
 * `protected`, `handover`, `reopened`, `sent_back`, `pending_decision`, `read_only`.
 */
export type CaseBanner = { kind: string; title: string; detail: string; at?: string; by?: PersonRef };

export type MoneyLabel = "money_at_stake" | "money_out" | "being_recovered" | "recovered" | "lost";

/** GET /cases/{id}. */
export type CaseDetail = {
  id: string;
  title: string;
  stage: CaseStage;
  status: CaseStatus;
  severity: Severity;
  subject: SubscriberRef;
  assignee: PersonRef | null;
  opened: { at: string; from_alert: string | null };
  glance: {
    risk_score: number;
    rules_fired: number;
    fraud_type: string;
    /** `note` is engine text. */
    money: { label: MoneyLabel; amount: Money; note: string };
    /** `minutes` is 0 until the case is started. */
    first_response: { met: boolean; minutes: number; sla_minutes: number };
  };
  what_happened: StoryStep[];
  next_steps: {
    done: NextStepKind[];
    recommended: { kind: NextStepKind; title: string; detail: string } | null;
    remaining: NextStepKind[];
  };
  linked_cases: string[];
  /** Set once the case is closed. */
  resolution: Resolution | null;
  banners: CaseBanner[];
  // Not on every case in the collection (FD-3050 has them all).
  counts?: { linked_alerts: number; timeline: number; transactions: number; evidence: number };
  contact?: { alt_msisdn: string | null; registered: string; language: string | null };
  sla?: { first_response_due_at: string; close_due_at: string; breached: boolean };
  /** The last protective action; GET /actions/{id} has its parts. */
  latest_action?: Omit<ProtectiveAction, "parts"> | null;
  reversal?: Pick<Reversal, "id" | "status" | "requested" | "secured"> | null;
  escalation?: Escalation | null;
  handover?: Handover | null;
  rejection?: Rejection | null;
  monitoring?: Monitoring | null;
};

export type Outcome = "confirmed_fraud" | "false_positive" | "inconclusive";

/** The outcome on the record. */
export type Resolution = {
  outcome: Outcome;
  lost: Money;
  recovered: Money;
  net_loss: Money;
  summary: string;
  signed_off_by: PersonRef | null;
  /** Head of Fraud, for outcomes over GHS 20,000. */
  co_signed_by: PersonRef | null;
  closed_at: string;
  regulator_reference: string | null;
};

/**
 * E7 · The supervisor turned the proposed outcome down. 0.2 has no example of
 * it set (FD-3050 sends null); this is the proposed shape with named fields.
 */
export type Rejection = {
  by: PersonRef;
  at: string;
  proposed: Outcome;
  comment: string;
  submitted: { summary: string; facts: Array<{ label: string; value: string; severity: Severity | null }> };
  steps: string[];
};

/** Where an escalation goes. */
export type EscalationTarget = "supervisor" | "legal" | "momo_ops";

export type Escalation = {
  id: string;
  case_id: string;
  to: PersonRef;
  target: EscalationTarget;
  kind: "question" | "agent_suspension";
  question: string;
  priority: "urgent" | "high" | "normal";
  status: "waiting" | "approved" | "declined";
  sent_at: string;
  reply_due_at: string;
  /** The supervisor’s reply, as written. */
  answer: string | null;
};

export type Handover = {
  id: string;
  case_id: string;
  from: PersonRef;
  to: PersonRef;
  status: "offered" | "accepted" | "declined";
  note: string;
};

/** POST /cases/{id}/monitor and GET /watchlist: what is watched after closing. */
export type Monitoring = {
  case_id: string;
  title: string;
  entities: string[];
  entity_counts: Record<string, number>;
  until: string;
  days_left: number;
  days_total: number;
  reopen_on_repeat: boolean;
  status: "quiet" | "near_miss" | "reopened";
  near_misses: number;
  reopened_at?: string;
  /** Engine text. */
  repeat_detail?: string;
};

export type Reversal = {
  id: string;
  case_id: string;
  status: "requested" | "accepted" | "held" | "returning" | "closed" | "appealed";
  requested: Money;
  secured: Money;
  steps: Array<{ step: string; at: string | null; by?: string; detail?: string }>;
  /** Per payment, once MoMo ops have answered. */
  results?: Array<{ payment_id: string; to: string; sent: Money; result: "recovered" | "cashed_out" | "declined" | "pending"; recovered: Money; reason?: string }>;
};

/** What the case actions (start, resolve, decide, reopen, resubmit) answer with. */
export type CaseChange = { id: string; stage: CaseStage; status: CaseStatus; assignee: PersonRef | null };
/** POST /cases/{id}/start: the change, and how the first response went. */
export type CaseStarted = CaseChange & { first_response: CaseDetail["glance"]["first_response"] };

/** A 409 `case_changed` on a note: what moved while you were writing. */
export type CaseChangedProblem = {
  title: string;
  detail: string;
  changes: Array<{ field: string; from: PersonRef | string | null; to: PersonRef | string | null }>;
  changed_by: PersonRef;
  changed_at: string;
};

export type Agent = {
  code: string;
  name: string;
  outlet: string;
  status: string;
  /** Date. */
  since: string;
  sim_swaps_by_day: Array<{ date: string; count: number }>;
  linked_cases: string[];
  swaps_today: number;
  swaps_became_fraud: number;
  id_mismatches: number;
  customers_30d: number;
};

export type LinkedAlert = Alert & {
  /** How the alert joined the case. */
  link: { kind: "opened" | "auto" | "manual"; by: PersonRef | null; at: string };
};

export type TimelineEvent = {
  id: string;
  at: string;
  kind: string;
  source: "person" | "system" | "momo" | "network" | "crm";
  actor?: PersonRef | null;
  /** Engine text, like `detail`. */
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
  attached_by: PersonRef | null;
  attached_at: string;
  supports_event_id: string | null;
  retention_until: string;
  /** Transactions saved as evidence: how many. */
  item_count?: number;
};

/** Who looked, and when: stamped on every view and download. */
export type Watermark = { text: string; viewer: PersonRef; at: string };

/** GET /evidence/{id}/view — watermarked page images, never the raw file. */
export type EvidenceView = {
  evidence: Evidence;
  integrity: { unchanged_since_upload: boolean; sha256: string };
  watermark: Watermark;
  pages: Array<{ number: number; image_url: string }>;
  viewed_by: Array<{ person: PersonRef; what: string; at: string }>;
};

/** GET /evidence/{id}/download — a short-lived signed link to a watermarked copy. */
export type EvidenceDownload = { url: string; expires_at: string; watermark: Watermark };

export type NetworkNode = {
  id: string;
  label: string;
  type: "subscriber" | "wallet" | "device" | "agent" | "case";
  risk: "low" | "medium" | "high" | "confirmed";
  /** How the node relates to the seed (`subject`, `recipient`, `mule`, …); the app writes the caption. Not sent on truncated graphs. */
  relation?: string;
  hop?: number;
  case_ids?: string[];
};
export type NetworkEdge = { from: string; to: string; kind: string; count: number; amount?: Money };
export type Network = {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  returned_hops: number;
  total_entities: number;
  shown_entities?: number;
  truncated: boolean;
  /** `params` go straight onto GET /network; the app writes the label. */
  suggested_filters: Array<{ id: string; params: Record<string, string | number | boolean>; estimate: number }>;
  /** Truncated graphs: what the whole view adds up to. */
  summary?: { seed_type: NetworkNode["type"]; subscribers_swapped_30d: number; became_fraud_case_ids: string[] };
  /** Sources that didn’t answer (“wallet” links from MoMo). */
  unavailable?: string[];
  /** Engine text: the one thing worth knowing about this view. */
  insight?: { title: string; detail: string };
  new_today?: Partial<Record<NetworkNode["type"], number>>;
};

/** GET /people: colleagues you can @mention, hand work to or escalate to. */
export type Colleague = PersonRef & {
  /** Role code (`fraud_analyst`…); see roleLabel. */
  role: string;
  /** Fraud-type codes. */
  skills: string[];
  status: "active" | "on_leave";
  on_shift: boolean;
  /** “08:00-16:00”. */
  shift: string;
  // Analysts only.
  open_cases?: number;
  case_limit?: number;
  // Supervisors and the Head of Fraud only.
  typical_reply_minutes?: number;
};

export const useCase = (id: string) => useApi<CaseDetail>(`/cases/${id}`);
export const useLinkedAlerts = (id: string) => useApi<Page<LinkedAlert>>(`/cases/${id}/linked-alerts`);
export const useTimeline = (id: string) => useApi<Page<TimelineEvent> & { next_cursor: string | null }>(`/cases/${id}/timeline`);
export const useCaseTransactions = (id: string) => useApi<TransactionPage>(`/cases/${id}/transactions`);
export const useEvidence = (id: string) => useApi<Page<Evidence>>(`/cases/${id}/evidence`);
/** `filters` are a suggested filter’s params (`became_fraud`, `since`, `has_outflow`). */
export const useNetwork = (seed: string | null, hops = 2, filters?: Record<string, string>) =>
  useApi<Network>(seed ? `/network?${new URLSearchParams({ seed, hops: String(hops), ...filters })}` : null);
export const useReversal = (id: string | null | undefined) => useApi<Reversal>(id ? `/reversals/${id}` : null);
export const useAgent = (code: string | null) => useApi<Agent>(code ? `/agents/${code}` : null);
export const useColleagues = () => useApi<Page<Colleague>>("/people");
export const useAction = (id: string | null | undefined) => useApi<ProtectiveAction>(id ? `/actions/${id}` : null);

export const STAGES: Array<{ id: CaseStage; label: string }> = [
  { id: "triage", label: "Alert" },
  { id: "investigate", label: "Investigate" },
  { id: "act", label: "Act" },
  { id: "decide", label: "Decide" },
  { id: "closed", label: "Closed" },
  { id: "monitor", label: "Monitor" },
];

export const NEXT_STEP_LABELS: Record<NextStepKind, string> = {
  start: "Start investigating",
  pick_up: "Pick up",
  freeze_wallet: "Freeze wallet",
  suspend_sim: "Suspend SIM",
  block_recipients: "Block recipients",
  call_subscriber: "Call subscriber",
  request_reversal: "Request reversal",
  report_agent: "Report agent",
  agent_suspension: "Ask to suspend agent",
  link_case: "Link case",
  add_evidence: "Go to Evidence",
  wait: "Remind Efua",
  watch_repeat: "Set up monitoring",
  none: "Nothing to do",
};

export type { Transaction };
