import "server-only";
import { findRow } from "./mock-caselist";

/**
 * Demo state for the case workspace (FD_API_MOCK=1 only). The Postman mock is
 * stateless, so a case would never move from New to Investigating to Closed.
 * This keeps a small per-server copy of each case that the case actions
 * update, so the whole analyst journey can be walked through. Every endpoint
 * here is either in the collection or in the list of proposed additions.
 */

type Body = Record<string, unknown> | null;
type Fixture = { status: number; body: unknown };

const GHS = (cedis: number) => ({ amount_minor: Math.round(cedis * 100), currency: "GHS" });
const ama = { id: "usr_ama", name: "Ama Mensah", initials: "AM" };
const clock = () => new Date(Date.parse(process.env.NEXT_PUBLIC_FD_DEMO_NOW ?? "") || Date.now()).toISOString();

const KOJO = { subscriber_id: "sub_8KQ2", name: "Kojo M.", msisdn: "+233 54 *** 3457", msisdn_ref: "pii_7Hq2" };

/** FD-3050 as it is when the critical alert opens it (C1). */
function freshFd3050() {
  return {
    id: "FD-3050",
    title: "SIM swap to MoMo",
    stage: "investigate",
    status: "new",
    severity: "critical",
    subject: KOJO,
    assignee: ama,
    opened: { at: "2026-10-20T09:25:00Z", from_alert: "AL-88213" },
    glance: {
      risk_score: 97,
      rules_fired: 4,
      fraud_type: "sim_swap_to_momo",
      money: { label: "money_at_stake", amount: GHS(18400), note: "GHS 312.40 still in wallet" },
      first_response: { met: false, minutes: null as number | null, sla_minutes: 15 },
    },
    what_happened: [
      { at: "2026-10-20T06:34:00Z", kind: "sim_swap", label: "SIM swapped", detail: "Agent AG-2231, Adum" },
      { at: "2026-10-20T08:39:00Z", kind: "new_device", label: "New phone logs in", detail: "Tecno Spark 20, Accra" },
      { at: "2026-10-20T08:41:00Z", kind: "payments_out", label: "6 payments out", detail: "In 22 minutes" },
      { at: "2026-10-20T09:03:00Z", kind: "wallets_paid", label: "4 wallets + 1 cash-out", amount: GHS(18400), links: ["FD-2998"] },
      { at: "2026-10-20T09:25:00Z", kind: "alert_raised", label: "Alert raised", detail: "Risk 97 · auto-case" },
    ] as Array<{ at: string; kind: string; label: string; detail?: string; amount?: ReturnType<typeof GHS>; links?: string[] }>,
    next_steps: {
      done: [] as string[],
      recommended: { kind: "freeze_wallet", title: "Freeze the wallet", detail: "GHS 312.40 is left. Freezing stops the last of it leaving." },
      remaining: ["call_subscriber", "request_reversal", "report_agent"],
    },
    linked_cases: ["FD-2998", "FD-3047"],
    banners: [] as Array<{ kind: string; title: string; detail: string; at: string }>,
    counts: { linked_alerts: 3, timeline: 9, transactions: 9, evidence: 4 },
    // Proposed: what’s in flight on the case, so the page can show progress.
    latest_action: null as null | DemoAction,
    reversal: null as null | { id: string; status: string; requested: ReturnType<typeof GHS>; secured: ReturnType<typeof GHS> },
    escalation: null as null | Record<string, unknown>,
    handover: null as null | Record<string, unknown>,
    // Proposed: the outcome as submitted, its review, and who signed it off.
    resolution: null as null | DemoResolution,
    sla: null as null | { label: string; tone: string },
    rejection: null as null | Record<string, unknown>,
    monitoring: null as null | Record<string, unknown>,
    contact: { alt_msisdn: "020 *** 1180", registered: "+233 54 *** 3457", language: "Twi" },
  };
}

type DemoResolution = {
  outcome: "confirmed_fraud" | "false_positive" | "inconclusive";
  summary: string;
  amount_lost?: ReturnType<typeof GHS>;
  amount_recovered?: ReturnType<typeof GHS>;
  submitted_at: string;
  submitted_by: typeof ama;
  status: "pending_decision" | "sent_back" | "closed";
  reviewer?: { id: string; name: string; initials: string };
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
  polls: number;
};
const EFUA = { id: "usr_efua", name: "Efua Owusu-Ansah", initials: "EO" };

type DemoPart = { kind: string; target?: string; targets?: string[]; days?: number; count?: number; status: "pending" | "applied" | "failed"; code?: string; at?: string; reference?: string; detail?: string; retried?: boolean };
type DemoAction = { id: string; case_id: string; status: string; requested_by: typeof ama; requested_at: string; parts: DemoPart[]; polls: number };
const actions = new Map<string, DemoAction>();
const PART_DONE: Record<string, (c: { glance: { money: { amount: ReturnType<typeof GHS> } } }) => string> = {
  freeze_wallet: () => "GHS 312.40 held",
  suspend_sim: () => "Calls, SMS and USSD blocked",
  block_wallets: () => "Watchlist for 30 days",
  block_recipients: () => "Watchlist for 30 days",
  send_safety_sms: () => "Sent to 020 *** 1180",
  bar_sims_on_id: () => "10 SIMs barred",
};

/** Apply one pending part per poll; the SIM suspension fails the first time (D5), then works on retry. */
function advance(a: DemoAction) {
  a.polls += 1;
  const next = a.parts.find((p) => p.status === "pending");
  if (next && a.polls > 1) {
    if (next.kind === "suspend_sim" && !next.retried) {
      Object.assign(next, { status: "failed", code: "PRV-504", detail: "Network provisioning (HLR) didn’t respond in 30 s" });
    } else {
      Object.assign(next, { status: "applied", at: clock(), reference: `MM-${next.kind.slice(0, 3).toUpperCase()}-${55100 + a.parts.indexOf(next)}`, detail: PART_DONE[next.kind]?.({ glance: { money: { amount: GHS(0) } } }) });
    }
  }
  const pending = a.parts.some((p) => p.status === "pending");
  const failed = a.parts.some((p) => p.status === "failed");
  a.status = pending ? "applying" : failed ? "partial" : "applied";
  if (!pending) settle(a);
  return a;
}

/** When an action finishes, the case shows it: banner, next steps, money tile. */
function settle(a: DemoAction) {
  const c = getCase(a.case_id);
  c.latest_action = a;
  const applied = a.parts.filter((p) => p.status === "applied").map((p) => p.kind);
  const done = new Set(c.next_steps.done);
  if (applied.includes("freeze_wallet")) done.add("freeze_wallet");
  c.next_steps.done = Array.from(done);
  if (done.has("freeze_wallet") && c.next_steps.recommended?.kind === "freeze_wallet") {
    c.next_steps.recommended = { kind: "call_subscriber", title: "Call the subscriber", detail: "Confirm on 020 *** 1180 that Kojo didn’t ask for the swap." };
    c.next_steps.remaining = c.next_steps.remaining.filter((k) => k !== "call_subscriber");
  }
  if (applied.includes("freeze_wallet")) {
    c.glance.money = { label: "money_out", amount: c.glance.money.amount, note: `GHS 312.40 frozen ${hhmm(clock())}` };
    c.stage = "act";
  }
  const words = a.parts.map((p) => ({ freeze_wallet: "Wallet frozen (GHS 312.40 held)", suspend_sim: "SIM suspended", block_wallets: `${p.targets?.length ?? 4} recipient wallets blocked`, block_recipients: `${p.targets?.length ?? 4} recipient wallets blocked`, send_safety_sms: "Safety SMS sent", bar_sims_on_id: "10 SIMs barred" })[p.kind as "freeze_wallet"] ?? p.kind);
  if (a.status === "applied") {
    c.banners = [{ kind: "protected", title: "Subscriber protected", detail: `${words.join(" · ")}. A supervisor can undo this from the timeline.`, at: clock() }];
    addEvent(a.case_id, { kind: "action", source: "person", actor: ama, title: "Subscriber protected", detail: words.join(", ") });
  }
}
const hhmm = (iso: string) => new Date(iso).toISOString().slice(11, 16);

type DemoCase = ReturnType<typeof freshFd3050>;

/** Other cases open as a lighter copy of the list entry, so every link works. */
const LIST: Record<string, { title: string; fraud_type: string; risk: number; status: string; stage: string; subject: typeof KOJO; money: number }> = {
  "FD-3051": { title: "MoMo velocity", fraud_type: "momo_velocity", risk: 88, status: "investigating", stage: "investigate", subject: { subscriber_id: "sub_6789", name: "Yaw B.", msisdn: "+233 24 *** 6789", msisdn_ref: "pii_6789" }, money: 5600 },
  "FD-3047": { title: "Mule ring, Kumasi", fraud_type: "agent_cash_out", risk: 84, status: "investigating", stage: "investigate", subject: { subscriber_id: "agt_557210", name: "Agent 557210", msisdn: "Agent 557210", msisdn_ref: "pii_557210" }, money: 22050 },
  "FD-3046": { title: "Bypass (SIM box)", fraud_type: "sim_box_bypass", risk: 81, status: "escalated", stage: "act", subject: { subscriber_id: "sub_5678", name: "Kwesi A.", msisdn: "+233 55 *** 5678", msisdn_ref: "pii_5678" }, money: 0 },
  "FD-3044": { title: "Account takeover", fraud_type: "account_takeover", risk: 76, status: "sent_back", stage: "decide", subject: { subscriber_id: "sub_9101", name: "Adwoa K.", msisdn: "+233 27 *** 9101", msisdn_ref: "pii_9101" }, money: 3100 },
  "FD-3041": { title: "Bypass (SIM box)", fraud_type: "sim_box_bypass", risk: 63, status: "pending_decision", stage: "decide", subject: { subscriber_id: "sub_1123", name: "Fiifi E.", msisdn: "+233 50 *** 1123", msisdn_ref: "pii_1123" }, money: 0 },
  "FD-3049": { title: "MoMo velocity spike", fraud_type: "momo_velocity", risk: 92, status: "new", stage: "investigate", subject: { subscriber_id: "sub_4410", name: "Akua S.", msisdn: "+233 26 *** 4410", msisdn_ref: "pii_4410" }, money: 7350 },
};

const cases = new Map<string, DemoCase>();

function getCase(id: string): DemoCase {
  let c = cases.get(id);
  if (c) return c;
  c = freshFd3050();
  const entry = LIST[id];
  if (id !== "FD-3050") {
    c.id = id;
    if (entry) {
      Object.assign(c, { title: entry.title, status: entry.status, stage: entry.stage, subject: entry.subject });
      c.glance = { ...c.glance, risk_score: entry.risk, fraud_type: entry.fraud_type, money: { ...c.glance.money, amount: GHS(entry.money) } };
      c.severity = entry.risk >= 90 ? "critical" : entry.risk >= 70 ? "high" : "medium";
    } else if (findRow(id)) {
      const r = findRow(id)!;
      Object.assign(c, {
        title: r.title,
        status: r.status,
        stage: r.stage,
        subject: { subscriber_id: r.subscriber.subscriber_id, name: r.subscriber.name, msisdn: r.subscriber.msisdn, msisdn_ref: r.subscriber.msisdn_ref },
        assignee: r.assignee,
        opened: { at: r.waiting_since, from_alert: null },
      });
      c.glance = { ...c.glance, risk_score: r.risk_score, fraud_type: r.fraud_type, money: { ...c.glance.money, amount: r.money_at_stake } };
      c.severity = r.risk_score >= 90 ? "critical" : r.risk_score >= 70 ? "high" : "medium";
    } else {
      // A case just opened in this session.
      Object.assign(c, { title: "New case", status: "investigating", opened: { at: clock(), from_alert: null } });
    }
  }
  if (id === "FD-3041") {
    Object.assign(c, {
      title: "Bypass (SIM box)",
      severity: "medium",
      status: "investigating",
      stage: "investigate",
      subject: { subscriber_id: "sub_1123", name: "Fiifi E.", msisdn: "+233 50 *** 1123", msisdn_ref: "pii_1123" },
      opened: { at: "2026-10-19T16:20:00Z", from_alert: "AL-87990" },
      sla: { label: "Restarted · 4h to close", tone: "medium" },
      rejection: {
        by: EFUA,
        at: "2026-10-20T11:20:00Z",
        proposed: "confirmed_fraud",
        comment: "The 6 SIMs belong to a call-centre client with a valid bulk agreement (contract KM-ENT-2210). Check with Enterprise sales before calling it bypass. Happy to talk it through.",
        submitted: {
          summary: "6 SIMs on one Ghana Card making high volumes of short international calls from Tema. Treated as SIM-box bypass.",
          facts: [["SIMs", "6 · registered Aug 2026"], ["Calls / day", "1,900"], ["Account type", "Enterprise · call centre (KM-ENT-2210)", "medium"]],
        },
        steps: ["Check contract KM-ENT-2210 with Enterprise sales", "Compare traffic to the contracted profile", "Resolve again (or reply to Efua)"],
      },
    });
    c.glance = { ...c.glance, risk_score: 63, fraud_type: "sim_box_bypass", money: { label: "money_at_stake", amount: GHS(0), note: "" } };
  }
  if (id === "FD-3036") {
    Object.assign(c, {
      title: "Account takeover",
      severity: "medium",
      status: "investigating",
      stage: "act",
      subject: { subscriber_id: "sub_8901", name: "Abena O.", msisdn: "+233 54 *** 8901", msisdn_ref: "pii_8901" },
      opened: { at: "2026-10-20T05:58:00Z", from_alert: "AL-88102" },
      sla: { label: "On track", tone: "success" },
    });
    c.glance = { ...c.glance, risk_score: 44, fraud_type: "account_takeover", money: { label: "money_at_stake", amount: GHS(0), note: "" }, first_response: { met: true, minutes: 8, sla_minutes: 15 } };
    c.next_steps = { done: ["call_subscriber"], recommended: { kind: "call_subscriber", title: "Resolve the case", detail: "Subscriber confirmed the new phone on a call." }, remaining: [] };
  }
  cases.set(id, c);
  return c;
}

const timelineExtra = new Map<string, unknown[]>();
const addEvent = (id: string, event: Record<string, unknown>) =>
  timelineExtra.set(id, [{ id: `tl_${Date.now()}`, at: clock(), ...event }, ...(timelineExtra.get(id) ?? [])]);

/** The collection’s FD-3050 timeline; new events from this session go on top. */
const TIMELINE = [
  { id: "tl_9", at: "2026-10-20T09:55:00Z", kind: "note", source: "person", actor: ama, title: "Note · customer contact", detail: "Called 020 *** 1180. Kojo confirms he did NOT request a SIM swap; his phone lost signal around 06:30. He is in Kumasi." },
  { id: "tl_8", at: "2026-10-20T09:50:00Z", kind: "link", source: "person", actor: ama, title: "Linked alert AL-88190", detail: "SIM swap at agent without biometric check" },
  { id: "tl_7", at: "2026-10-20T09:47:00Z", kind: "link", source: "system", title: "Alert AL-88233 auto-linked", detail: "MoMo PIN reset after SIM swap" },
  { id: "tl_5", at: "2026-10-20T09:31:00Z", kind: "status", source: "person", actor: ama, title: "Started investigating", detail: "New to Investigating · first response in 6 min" },
  { id: "tl_4", at: "2026-10-20T09:25:00Z", kind: "opened", source: "system", title: "Case opened automatically · risk 97", detail: "From critical alert AL-88213 · assigned to Ama Mensah" },
  { id: "tl_3", at: "2026-10-20T09:03:00Z", kind: "payment", source: "momo", title: "Last payment · GHS 2,900 cash-out at agent 557210" },
  { id: "tl_2", at: "2026-10-20T08:39:00Z", kind: "device", source: "network", title: "New device on wallet · Tecno Spark 20", detail: "IMEI 35 *** 4417 · Accra" },
  { id: "tl_1", at: "2026-10-20T06:34:00Z", kind: "sim_swap", source: "crm", title: "SIM swap completed at agent AG-2231", detail: "Adum, Kumasi · no biometric check recorded" },
];

/** RICHER: linked alerts with how they joined (proposed `link`). */
const LINKED_ALERTS = {
  data: [
    { id: "AL-88213", created_at: "2026-10-20T09:25:00Z", severity: "critical", risk_score: 97, title: "SIM swap to MoMo transfers", rule_ids: ["R-104", "R-211", "R-318", "R-402"], subscriber: KOJO, region: "Accra", status: "auto_case", case_id: "FD-3050", link: { kind: "opened" } },
    { id: "AL-88233", created_at: "2026-10-20T09:47:00Z", severity: "critical", risk_score: 91, title: "MoMo PIN reset after SIM swap", rule_ids: ["R-104"], subscriber: KOJO, region: "Accra", status: "attached", case_id: "FD-3050", link: { kind: "auto" } },
    { id: "AL-88190", created_at: "2026-10-20T06:41:00Z", severity: "medium", risk_score: 66, title: "SIM swap at agent without biometric check", rule_ids: ["R-118"], subscriber: KOJO, region: "Kumasi", status: "attached", case_id: "FD-3050", link: { kind: "manual", by: ama } },
  ],
};

/** RICHER: evidence with readable titles. */
const EVIDENCE = [
  { id: "ev_4", title: "Call note: subscriber confirms no swap requested", kind: "call_log", summary: "Customer contact", mime_type: "text/plain", pages: 1, size_bytes: 1200, sha256: "9f2c…a71e", attached_by: ama, attached_at: "2026-10-20T10:08:00Z", supports_event_id: "tl_9", retention_until: "2033-10-20" },
  { id: "ev_3", title: "SIM swap record: AG-2231.pdf", kind: "auto", summary: "CRM export", mime_type: "application/pdf", pages: 2, size_bytes: 214_000, sha256: "1b7d…0c42", attached_by: null, attached_at: "2026-10-20T09:25:00Z", supports_event_id: "tl_1", retention_until: "2033-10-20" },
  { id: "ev_2", title: "Device fingerprint: IMEI 35***4417.json", kind: "auto", summary: "Network logs", mime_type: "application/json", pages: 1, size_bytes: 18_000, sha256: "77aa…9e10", attached_by: null, attached_at: "2026-10-20T09:25:00Z", supports_event_id: "tl_2", retention_until: "2033-10-20" },
];
const evidenceExtra = new Map<string, unknown[]>();

/** PROPOSED: GET /people — colleagues to @mention, hand over or escalate to. */
const PEOPLE = {
  data: [
    { id: "usr_kwame", name: "Kwame Asante", initials: "KA", role: "Senior analyst", skills: "SIM swap", on_shift: true, note: "night shift from 16:00", open_cases: 3, limit: 8 },
    { id: "usr_akosua", name: "Akosua Boateng", initials: "AB", role: "Analyst", skills: "MoMo", on_shift: true, open_cases: 5, limit: 8 },
    { id: "usr_yaw", name: "Yaw Agyeman", initials: "YA", role: "Analyst", skills: "Bypass", on_shift: true, open_cases: 9, limit: 9 },
    { id: "usr_kofi", name: "Kofi Boateng", initials: "KB", role: "Analyst", skills: "Agent fraud", on_shift: true, note: "knows agent fraud", open_cases: 4, limit: 8 },
    { id: "usr_mabel", name: "Mabel Tetteh", initials: "MT", role: "Analyst", skills: "MoMo", on_shift: false, open_cases: 2, limit: 8 },
    { id: "usr_efua", name: "Efua Owusu-Ansah", initials: "EO", role: "Fraud Supervisor", on_shift: true, reply_minutes: 25 },
    { id: "usr_kojo", name: "Kojo Asare", initials: "KA", role: "IT admin", on_shift: true },
  ],
};

/** RICHER: GET /network?seed=… — the money trail around Kojo’s wallet (C8). */
const NETWORK = {
  nodes: [
    { id: "sub_8KQ2", label: "+233 54 *** 3457", type: "subscriber", risk: "high", role: "Subscriber · FD-3050", hop: 0 },
    { id: "AG-2231", label: "AG-2231", type: "agent", risk: "high", role: "Swap agent · Adum", hop: 1 },
    { id: "dev_4417", label: "Tecno Spark 20", type: "device", risk: "medium", role: "New device · 08:39", hop: 1 },
    { id: "sub_7781", label: "+233 20 *** 7781", type: "subscriber", risk: "medium", role: "FD-3012 · same device", hop: 2 },
    { id: "sub_5521", label: "+233 24 *** 5521", type: "subscriber", risk: "medium", role: "Other swap today", hop: 2 },
    { id: "w_8812", label: "024 *** 8812", type: "wallet", risk: "confirmed", role: "Recipient", hop: 1 },
    { id: "w_2093", label: "055 *** 2093", type: "wallet", risk: "medium", role: "Recipient", hop: 1 },
    { id: "w_6634", label: "020 *** 6634", type: "wallet", risk: "medium", role: "Recipient", hop: 1 },
    { id: "w_4471", label: "027 *** 4471", type: "wallet", risk: "medium", role: "Recipient", hop: 1 },
    { id: "agt_557210", label: "Agent 557210", type: "agent", risk: "high", role: "Cash-out · Kumasi", hop: 1 },
    { id: "w_1182", label: "050 *** 1182", type: "wallet", risk: "high", role: "Mule", hop: 2 },
    { id: "w_7710", label: "024 *** 7710", type: "wallet", risk: "high", role: "Mule", hop: 2 },
    { id: "FD-2998", label: "FD-2998", type: "case", risk: "confirmed", role: "Confirmed ring", hop: 3 },
  ],
  edges: [
    { from: "AG-2231", to: "sub_8KQ2", kind: "swapped_by", count: 1 },
    { from: "dev_4417", to: "sub_8KQ2", kind: "used_by", count: 1 },
    { from: "dev_4417", to: "sub_7781", kind: "used_by", count: 1 },
    { from: "AG-2231", to: "sub_5521", kind: "swapped_by", count: 1 },
    { from: "sub_8KQ2", to: "w_8812", kind: "paid", count: 2, amount: GHS(7200) },
    { from: "sub_8KQ2", to: "w_2093", kind: "paid", count: 1, amount: GHS(3500) },
    { from: "sub_8KQ2", to: "w_6634", kind: "paid", count: 1, amount: GHS(2800) },
    { from: "sub_8KQ2", to: "w_4471", kind: "paid", count: 1, amount: GHS(2000) },
    { from: "sub_8KQ2", to: "agt_557210", kind: "cash_out", count: 1, amount: GHS(2900) },
    { from: "w_8812", to: "w_1182", kind: "paid", count: 1, amount: GHS(3700) },
    { from: "w_8812", to: "w_7710", kind: "paid", count: 1, amount: GHS(3200) },
    { from: "w_1182", to: "FD-2998", kind: "in_case", count: 1 },
    { from: "w_7710", to: "FD-2998", kind: "in_case", count: 1 },
  ],
  returned_hops: 2,
  total_entities: 13,
  truncated: false,
  suggested_filters: [],
  // Proposed: what the view adds up to, and the one thing worth knowing.
  insight: {
    title: "Money reaches a confirmed ring in 2 hops",
    detail: "024 *** 8812 forwarded GHS 6,900 to two FD-2998 mule wallets within 40 min.",
  },
  new_today: { wallet: 4 },
};

/** PROPOSED: GET /network?seed=AG-2231 — too big to draw at 2 hops (G32). */
const AGENT_NETWORK = {
  nodes: [{ id: "AG-2231", label: "AG-2231", type: "agent", risk: "high", role: "Swap agent · Adum", hop: 0 }],
  edges: [],
  returned_hops: 1,
  total_entities: 2418,
  shown_entities: 186,
  truncated: true,
  suggested_filters: [
    { estimate: 14, label: "Only SIM swaps that became fraud", detail: "3 subscribers · 11 wallets", params: { became_fraud: true } },
    { estimate: 41, label: "Only today (since 00:00)", detail: "41 entities", params: { since: "today" } },
    { estimate: 640, label: "Hide wallets with no outflow", detail: "~640 entities", params: { has_outflow: true } },
  ],
  summary: [
    ["Seed", "AG-2231 · agent"],
    ["Showing", "1 hop · 186 entities"],
    ["Subscribers swapped", "143 this month"],
    ["Became fraud", "3 · FD-3050, FD-3047, FD-3012", "critical"],
  ],
};

/** The explorer’s side panel for a wallet (G29), richer than the case tab’s. */
const EXPLORE_DETAIL: Record<string, unknown> = {
  w_8812: {
    id: "w_8812",
    title: "024 *** 8812",
    subtitle: "MoMo wallet · Yaw D. (masked)",
    type: "wallet",
    badges: [
      { label: "Recipient", tone: "neutral" },
      { label: "Mule pattern", tone: "critical" },
    ],
    facts: [
      ["Opened", "11 days ago · Kejetia"],
      ["Received today", "GHS 7,200 from 1 victim", "critical"],
      ["Sent on", "GHS 6,900 in 40 min", "critical"],
      ["Forwarded to", "050 *** 1182 · 024 *** 7710"],
      ["Cases", "FD-2998 (linked)"],
    ],
    actions: [],
    add_to_case: { suggested: ["w_8812", "w_1182", "w_7710"] },
  },
};

/** PROPOSED: GET /network/nodes/{id} — the side panel for a selected entity. */
const NODE_DETAIL: Record<string, unknown> = {
  w_8812: {
    id: "w_8812",
    title: "Wallet 024 *** 8812",
    badges: [{ label: "Mule wallet · likely", tone: "critical" }, { label: "Tier 1", tone: "neutral" }],
    facts: [
      ["Received from this case", "GHS 7,200 · 2 transfers", "critical"],
      ["Received today (all)", "GHS 19,850 · 11 senders"],
      ["Cash-outs today", "3 · agent 557210, Kumasi"],
      ["Registered", "4 days ago · Tier 1, no Ghana Card"],
      ["Also in", "FD-2998 (confirmed) · FD-3047"],
    ],
    actions: ["add_to_evidence", "block", "link_case:FD-2998"],
  },
};

/** Simulated time: a supervisor answers after a few looks at the case; reversals move on. */
function tick(c: DemoCase) {
  const r = c.resolution;
  if (r && r.status === "pending_decision" && r.outcome === "confirmed_fraud") {
    r.polls += 1;
    if (r.polls >= 3 && !r.sent_back && !r.resubmitted_at) {
      // The first time, Efua asks for one more thing (E4).
      r.status = "sent_back";
      r.sent_back = { at: clock(), comment: "Please attach the agent CCTV still before I sign off. Compliance needs it for the agent report." };
      c.status = "sent_back";
      c.next_steps.recommended = { kind: "add_evidence" as never, title: "Add the agent CCTV still", detail: "Efua needs it for the agent report before she signs off." };
      addEvent(c.id, { kind: "decision", source: "person", actor: EFUA, title: "Sent back · changes requested", detail: r.sent_back.comment });
    } else if (r.polls >= 3 && r.resubmitted_at) {
      // After the resubmit, she signs off (E6).
      r.status = "closed";
      r.signed_off = { by: EFUA.name, at: clock() };
      r.regulator_report = "BoG-FR-2210";
      c.status = "closed";
      c.stage = "closed";
      c.next_steps.recommended = { kind: "watch_repeat" as never, title: "Watch for a repeat", detail: "Keep this number and the 4 wallets on watch for 30 days." };
      addEvent(c.id, { kind: "decision", source: "person", actor: EFUA, title: "Signed off · confirmed fraud", detail: "Regulator report BoG-FR-2210 filed" });
    }
  }
  const e = c.escalation as null | { polls: number; status: string; kind: string; answer: unknown; answered_at?: string };
  if (e && e.status === "waiting") {
    e.polls += 1;
    if (e.polls >= 3) {
      e.status = "answered";
      e.answered_at = clock();
      e.answer = {
        decision: "approve",
        label: e.kind === "agent_suspension" ? "Approved: suspend agent AG-2231" : "Approved: suspend agent AG-2231",
        comment: "Approved: 11 swaps with no fingerprint is enough. I’ve asked MoMo ops to suspend AG-2231. File the agent report so it’s on record.",
      };
      if (c.status === "escalated") c.status = "investigating";
      addEvent(c.id, { kind: "escalation", source: "person", actor: { id: "usr_efua", name: "Efua Owusu-Ansah", initials: "EO" }, title: "Escalation answered: proceed", detail: "Suspend agent AG-2231 approved" });
    }
  }
  if (c.reversal) {
    c.reversal = { ...c.reversal, status: reversal().status };
    if (c.reversal.status === "closed") c.glance.money = { label: "recovered", amount: GHS(10700), note: "GHS 7,700 lost" };
  }
}

let reversalPolls = 0;
/** GET /reversals/{id}: the collection’s example (held), then closed with results (D9 → D10). */
function reversal() {
  const closed = reversalPolls >= 4;
  return {
    id: "RV-0921",
    case_id: "FD-3050",
    status: closed ? "closed" : reversalPolls >= 1 ? "held" : "accepted",
    requested: GHS(13600),
    secured: GHS(10700),
    steps: [
      { step: "requested", at: "2026-10-20T10:12:00Z", by: "Ama Mensah", detail: "GHS 13,600 across 4 payments" },
      { step: "accepted", at: "2026-10-20T10:31:00Z", by: "Comfort Addo, MoMo Fraud Ops" },
      { step: "held", at: reversalPolls >= 1 ? "2026-10-20T10:52:00Z" : null, detail: "GHS 10,700 frozen in 2 recipient wallets" },
      { step: "returning", at: closed ? "2026-10-20T13:40:00Z" : null, detail: "Expected by 14:00 today" },
      { step: "closed", at: closed ? "2026-10-20T13:52:00Z" : null, detail: "Final amount recovered will be added to the case" },
    ],
    results: closed
      ? [
          { payment_id: "MP2010.8941 +1", to: "024 *** 8812", sent: GHS(7200), result: "recovered", recovered: GHS(7200) },
          { payment_id: "MP2010.8945", to: "055 *** 2093", sent: GHS(3500), result: "recovered", recovered: GHS(3500) },
          { payment_id: "MP2010.8953", to: "020 *** 6634", sent: GHS(2800), result: "cashed_out", recovered: GHS(0) },
          { payment_id: "MP2010.8958", to: "027 *** 4471", sent: GHS(2000), result: "cashed_out", recovered: GHS(0) },
          { payment_id: "MP2010.9031", to: "Agent 557210", sent: GHS(2900), result: "declined", recovered: GHS(0), reason: "agent dispute" },
        ]
      : [],
  };
}

/** RICHER: GET /agents/{code} — plus proposed fields for the suspension request (D14). */
const AGENT = {
  code: "AG-2231",
  linked_cases: ["FD-3050", "FD-3012"],
  name: "Adum Mobile Hub",
  outlet: "Adum, Kumasi",
  sim_swaps_by_day: [
    { count: 2, date: "2026-10-14" }, { count: 1, date: "2026-10-15" }, { count: 3, date: "2026-10-16" }, { count: 2, date: "2026-10-17" },
    { count: 2, date: "2026-10-18" }, { count: 1, date: "2026-10-19" }, { count: 11, date: "2026-10-20" },
  ],
  since: "2023-02-01",
  status: "active",
  swaps_today: 11,
  swaps_became_fraud: 3,
  id_mismatches: 2,
  customers_30d: 143,
};

/** RICHER + PROPOSED: GET /cases/{id}/brief — six chapters, each with the data for its picture. */
let lastBrief = 0;
function brief(id: string): Fixture {
  if (id === "FD-3071") {
    return { status: 422, body: { status: 422, code: "not_enough_events", title: "Not much of a story yet", events: 1, needed: 3, opened_at: new Date(Date.parse(clock()) - 4 * 60_000).toISOString() } };
  }
  // Opening the story builds it (E21); it’s ready a moment later.
  const fresh = Date.now() - lastBrief > 30_000;
  lastBrief = Date.now();
  if (fresh) return { status: 202, body: { case_id: id, status: "building", events_found: 28, chapters_ready: 3, chapters_total: 6 } };
  const c = getCase(id);
  const signoff = c.resolution?.reviewer?.name ?? "Efua Owusu-Ansah";
  return {
    status: 200,
    body: {
      case_id: id,
      status: "ready",
      outcome: c.resolution?.outcome ?? "confirmed_fraud",
      chapters: [
        {
          number: 1, at: "2026-10-20T06:34:00Z", short: "The SIM swap", title: "It started with a SIM swap",
          summary: "At 06:34, someone walked into an agent in Adum and got a new SIM for Kojo’s number. Kojo was at home.",
          stats: [["06:34", "Swap time"], ["11", "Swaps by this agent today", "high"]],
          visual: { kind: "agent_swaps", agent: "Agent AG-2231 · Adum, Kumasi", since: "Kasa MoMo agent since 2023", facts: [["sim", "06:34 · SIM re-issued for +233 54 *** 3457", "Requested in person at this agent"], ["fingerprint", "No fingerprint taken", "Ghana Card number typed in by hand"]], by_day: [["Mon", 2], ["Tue", 1], ["Wed", 3], ["Thu", 2], ["Fri", 2], ["Sat", 1], ["Today", 11]] },
        },
        {
          number: 2, at: "2026-10-20T08:39:00Z", short: "A new phone", title: "A new phone took over",
          summary: "His own phone went silent. Two hours later a phone he had never used signed into his wallet from Accra.",
          stats: [["08:39", "New phone signs in"], ["1st try", "PIN correct", "high"]],
          visual: { kind: "two_phones", a: { model: "Infinix Hot 30", sub: "His phone · Kumasi · 2 years", note: "Went silent 06:34" }, b: { model: "Tecno Spark 20", sub: "New · Madina, Accra", note: "Signed in 08:39" }, distance: "248 km", facts: [["fingerprint", "IMEI fails the Luhn check", "The phone’s ID number has been changed"], ["lock", "PIN entered correctly first time", "The PIN was known: likely phished before the swap"]] },
        },
        {
          number: 3, at: "2026-10-20T08:41:00Z", short: "The money moves", title: "Then the money moved, fast",
          summary: "Two minutes after the new phone signed in, money started leaving. Six transfers, all around GHS 3,000, emptied the wallet.",
          stats: [["GHS 18,400", "Sent out", "high"], ["22 min", "Start to finish"]],
          visual: { kind: "transfers", title: "6 transfers in 22 minutes", sub: "Each one at or under his GHS 3,500 single-transfer limit", bars: [["08:41", 3000], ["08:45", 3500], ["08:49", 2800], ["08:53", 3000], ["08:58", 3000], ["09:03", 3000]], balance: { from: 18712, to: 312 } },
        },
        {
          number: 4, at: "2026-10-20T09:03:00Z", short: "Where it went", title: "It went to four strangers",
          summary: "The money was split across four wallets Kojo had never paid. One is a mule we already know. Two were cashed out in Kasoa.",
          stats: [["4", "New wallets", "high"], ["GHS 12,500", "Cashed out", "high"]],
          visual: { kind: "flow", title: "4 wallets he had never paid", sub: "Two were emptied for cash in Kasoa within 40 minutes", source: ["054 *** 3457", "Kojo’s wallet"], wallets: [["024 *** 8812", "GHS 6,500 · FD-2998 mule", 6500, true], ["055 *** 2093", "GHS 6,000 · new wallet", 6000, true], ["027 *** 4471", "GHS 3,000 · new wallet", 3000, false], ["020 *** 6634", "GHS 2,900 · new wallet", 2900, false]], sink: ["Agent KS-0917", "Kasoa · cash-out"], notes: ["024 *** 8812 is a known mule in FD-2998", "Line thickness = amount"] },
        },
        {
          number: 5, at: "2026-10-20T09:25:00Z", short: "What we did", title: "What we did about it",
          summary: "16 minutes after the alert the wallet was frozen. Then Kojo was called and MoMo was asked to pull money back.",
          stats: [["16 min", "Alert to frozen", "success"], ["5", "Actions"]],
          visual: { kind: "actions", title: "16 minutes from alert to protected", items: [["user", "Picked up the alert", "Ama Mensah", "09:31"], ["shield", "Froze the wallet and blocked the SIM", "GHS 312.40 kept", "09:41"], ["phone", "Called Kojo on his other number. He never asked for a swap", "Ama Mensah · call logged", "09:55"], ["refresh", "Asked MoMo ops to pull back GHS 10,700", "Still in two mule wallets", "10:12"], ["building", "Reported agent AG-2231", "To Kasa agent network", "10:21"]] },
        },
        {
          number: 6, at: null, short: "Where it stands", title: "Where it stands now",
          summary: `We froze what was left and asked MoMo to pull back the money still sitting in mule wallets. ${signoff.split(" ")[0]} signs off today.`,
          stats: [["Confirmed fraud", "Proposed outcome", "critical"]],
          visual: { kind: "standing", tiles: [["alert", "Taken", "GHS 18,400", "critical"], ["shield", "Saved by the freeze", "GHS 312", "success"], ["refresh", "Reversal requested", "GHS 10,700", "medium"]], next: [[true, "Wallet frozen, SIM blocked", "09:41 · Ama Mensah"], [true, "Agent AG-2231 reported to Kasa agent network", "10:21"], [false, "Supervisor sign-off", `${signoff} · due today 16:00`], [false, "MoMo ops decision on the reversal", "Usually 2 working days"]] },
        },
      ],
    },
  };
}

export function mockCaseFixture(method: string, path: string, body: Body, search: URLSearchParams): Fixture | undefined {
  if (method === "GET" && path === "people") return { status: 200, body: PEOPLE };
  if (method === "GET" && path === "network") {
    const seed = search.get("seed") ?? "";
    if (seed === "AG-2231" && !search.get("became_fraud") && !search.get("since") && !search.get("has_outflow") && search.get("hops") !== "1") {
      return { status: 200, body: AGENT_NETWORK };
    }
    if (seed.endsWith("3457-fail")) return { status: 200, body: { ...NETWORK, edges: NETWORK.edges.filter((e) => !e.from.startsWith("w_") && !e.to.startsWith("w_")), unavailable: ["wallet"] } };
    const hops = Number(search.get("hops") ?? 2);
    const nodes = NETWORK.nodes.filter((n) => (n.hop ?? 0) <= hops + (hops >= 2 ? 1 : 0));
    const ids = new Set(nodes.map((n) => n.id));
    return { status: 200, body: { ...NETWORK, returned_hops: hops, nodes, edges: NETWORK.edges.filter((e) => ids.has(e.from) && ids.has(e.to)) } };
  }
  const node = path.match(/^network\/nodes\/([^/]+)$/);
  if (method === "GET" && node && search.get("context") === "explore" && EXPLORE_DETAIL[node[1]]) {
    return { status: 200, body: EXPLORE_DETAIL[node[1]] };
  }
  if (method === "GET" && node) {
    const found = NETWORK.nodes.find((n) => n.id === node[1]);
    return {
      status: 200,
      body: NODE_DETAIL[node[1]] ?? {
        id: node[1],
        title: found ? `${found.type[0].toUpperCase()}${found.type.slice(1)} ${found.label}` : node[1],
        badges: found?.role ? [{ label: found.role, tone: "neutral" }] : [],
        facts: [["Linked to this case", found?.role ?? "Yes"]],
        actions: ["add_to_evidence"],
      },
    };
  }

  const act = path.match(/^actions\/([^/]+)(?:\/(retry|undo))?$/);
  if (act && actions.has(act[1])) {
    const a = actions.get(act[1])!;
    if (method === "GET" && !act[2]) return { status: 200, body: advance(a) };
    if (method === "POST" && act[2] === "retry") {
      a.parts.forEach((p) => p.status === "failed" && Object.assign(p, { status: "pending", retried: true, code: undefined, detail: undefined }));
      a.status = "applying";
      a.polls = 1;
      return { status: 202, body: a };
    }
  }
  if (method === "GET" && /^reversals\/[^/]+$/.test(path)) {
    reversalPolls += 1;
    return { status: 200, body: reversal() };
  }
  const esc = path.match(/^escalations\/([^/]+)$/);
  if (method === "DELETE" && esc) {
    for (const c of cases.values()) if ((c.escalation as { id?: string } | null)?.id === esc[1]) {
      c.escalation = null;
      if (c.status === "escalated") c.status = "investigating";
    }
    return { status: 204, body: null };
  }
  if (method === "GET" && /^agents\/[^/]+$/.test(path)) return { status: 200, body: AGENT };

  const m = path.match(/^cases\/([^/]+)(?:\/(.+))?$/);
  if (!m || m[1] === "pick-up") return undefined;
  const [, id, sub] = m;

  if (method === "GET" && !sub) {
    // Demo states for I16–I18.
    if (id === "FD-9999") return { status: 404, body: { status: 404, code: "case_not_found", title: "Case not found" } };
    if (id === "FD-3005") return { status: 404, body: { status: 404, code: "case_merged", title: "Case merged", merged_into: "FD-2998", merged_at: "2026-10-14T10:00:00Z", merged_by: "Efua Owusu-Ansah" } };
    if (id === "FD-2864") return { status: 403, body: { status: 403, code: "case_restricted", title: "This case is restricted", detail: "This case is restricted to the Internal Investigations team at Kasa Mobile. Ask for access and Efua Owusu-Ansah (your supervisor) will be notified." } };
    if (id === "FD-5000") return { status: 500, body: { status: 500, code: "internal", title: "Something went wrong", request_id: "ERR-5F2C-0942" } };
    const c = getCase(id);
    tick(c);
    return { status: 200, body: c };
  }
  if (method === "GET" && sub === "linked-alerts") return { status: 200, body: LINKED_ALERTS };
  if (method === "GET" && sub === "brief") return brief(id);
  // PROPOSED: POST /cases/{id}/brief/export {format, include_thumbnails} — PDFs over 25 MB fail (E23).
  if (method === "POST" && sub === "brief/export") {
    if (body?.format === "pdf" && body?.include_thumbnails) {
      return { status: 413, body: { status: 413, code: "export_too_large", title: "Export failed: the file was over 25 MB", detail: "Evidence thumbnails made it too big. Turn them off, or export images instead." } };
    }
    const ext = body?.format === "images" ? "zip" : body?.format === "link" ? null : "pdf";
    return { status: 200, body: { file_name: ext ? `${id}-story.${ext}` : null, url: ext ? `/api/fd/cases/${id}/brief?format=${body?.format}` : `https://fd.kasamobile.example/s/${id.toLowerCase()}-7f3a`, pages: 6, size_bytes: 1_200_000, expires_at: body?.format === "link" ? new Date(Date.parse(clock()) + 7 * 86_400_000).toISOString() : null } };
  }
  if (method === "GET" && sub === "timeline") {
    const extra = timelineExtra.get(id) ?? [];
    const c = getCase(id);
    // Events that haven’t happened yet in this session’s copy of the case stay hidden.
    const startedHere = extra.some((e) => (e as { kind: string }).kind === "status");
    const base = TIMELINE.filter(
      (e) => (c.status !== "new" || !["tl_5", "tl_7", "tl_8", "tl_9"].includes(e.id)) && !(startedHere && e.id === "tl_5"),
    );
    const all = [...extra, ...base] as Array<{ at: string }>;
    return { status: 200, body: { data: all.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)), next_cursor: null } };
  }
  if (method === "GET" && sub === "evidence") return { status: 200, body: { data: [...(evidenceExtra.get(id) ?? []), ...EVIDENCE] } };

  // PROPOSED: POST /cases/{id}/start — New → Investigating, stops the first-response clock.
  if (method === "POST" && sub === "start") {
    const c = getCase(id);
    const minutes = Math.max(1, Math.round((Date.parse(clock()) - Date.parse(c.opened.at)) / 60_000));
    c.status = "investigating";
    c.glance.first_response = { met: minutes <= c.glance.first_response.sla_minutes, minutes, sla_minutes: c.glance.first_response.sla_minutes };
    c.what_happened = [...c.what_happened.filter((s) => s.kind !== "picked_up"), { at: clock(), kind: "picked_up", label: "You picked it up", detail: `First response in ${minutes} min` }];
    addEvent(id, { kind: "status", source: "person", actor: ama, title: "Started investigating", detail: `New to Investigating · first response in ${minutes} min` });
    return { status: 200, body: c };
  }
  if (method === "POST" && sub === "notes") {
    // PROPOSED: 409 case_changed when the case moved while you were writing (I15). Resend with `force: true`.
    if (id === "FD-3051" && !body?.force) {
      return {
        status: 409,
        body: {
          status: 409,
          code: "case_changed",
          title: "FD-3051 was reassigned to Kofi",
          detail: "Efua moved it 2 minutes ago, while you were writing. You can still add your note so Kofi has it.",
          changes: [
            { field: "Assignee", from: "Ama Mensah", to: "Kofi Boateng" },
            { field: "Status", from: "Investigating", to: "Investigating" },
            { field: "Changed by", from: "—", to: "Efua Owusu-Ansah · 09:51" },
          ],
          new_assignee: { id: "usr_kofi", name: "Kofi Boateng" },
        },
      };
    }
    const event = { kind: "note", source: "person", actor: ama, title: body?.visibility === "supervisor" ? "Note · shared with supervisor" : "Note", detail: String(body?.body ?? "") };
    addEvent(id, event);
    return { status: 201, body: { id: `tl_${Date.now()}`, at: clock(), ...event } };
  }
  // PROPOSED: JSON evidence from selected transactions (multipart upload stays for files).
  if (method === "POST" && sub === "evidence") {
    const ids = (body?.transaction_ids as string[] | undefined) ?? [];
    const file = body?.file as { name: string; size: number } | undefined;
    const item = {
      id: `ev_${Date.now()}`,
      title: String(body?.title ?? "Evidence"),
      kind: ids.length ? "transactions" : "file",
      summary: ids.length ? `${ids.length} transactions · saved by Ama Mensah` : undefined,
      mime_type: "application/json",
      pages: 1,
      size_bytes: file?.size ?? 2048,
      sha256: "c0ff…ee42",
      attached_by: ama,
      attached_at: clock(),
      supports_event_id: null,
      retention_until: "2033-10-20",
    };
    evidenceExtra.set(id, [item, ...(evidenceExtra.get(id) ?? [])]);
    getCase(id).counts.evidence += 1;
    return { status: 201, body: item };
  }
  // POST /cases/{id}/actions — 202 applying; parts finish on later polls (D2–D5). Barring every SIM on an ID is capped (D6).
  if (method === "POST" && sub === "actions") {
    const parts = ((body?.parts as DemoPart[]) ?? []).map((p) => ({ ...p, status: "pending" as const }));
    const bar = parts.find((p) => p.kind === "bar_sims_on_id");
    if (bar && ((bar as { count?: number }).count ?? 14) > 10) {
      return { status: 403, body: { status: 403, code: "over_limit", title: "14 is over your limit of 10", detail: "Ask Efua to lift the limit, or bar the 10 most active now.", limit: 10, requested: 14, approver: { id: "usr_efua", name: "Efua Owusu-Ansah" } } };
    }
    const a: DemoAction = { id: `act_${Date.now().toString(36)}`, case_id: id, status: "applying", requested_by: ama, requested_at: clock(), parts, polls: 0 };
    actions.set(a.id, a);
    getCase(id).latest_action = a;
    return { status: 202, body: a };
  }
  if (method === "POST" && sub === "calls") {
    const c = getCase(id);
    const outcome = String(body?.outcome ?? "reached");
    addEvent(id, { kind: "call", source: "person", actor: ama, title: `Call · ${outcome.replace(/_/g, " ")}`, detail: String(body?.notes ?? "") });
    if (outcome === "reached") {
      c.next_steps.done = Array.from(new Set([...c.next_steps.done, "call_subscriber"]));
      c.next_steps.recommended = { kind: "request_reversal", title: "Request reversal of the 6 transfers", detail: "MoMo ops can recall funds still in mule wallets." };
      c.next_steps.remaining = c.next_steps.remaining.filter((k) => k !== "request_reversal" && k !== "call_subscriber");
    }
    return { status: 201, body: { id: `tl_${Date.now()}`, at: clock(), kind: "call", source: "person", actor: ama, title: "Call logged", detail: body?.notes } };
  }
  if (method === "POST" && sub === "reversals") {
    const c = getCase(id);
    c.reversal = { id: "RV-0921", status: "accepted", requested: GHS(13600), secured: GHS(10700) };
    c.glance.money = { label: "being_recovered", amount: GHS(10700), note: "of GHS 18,400 · RV-0921" };
    c.next_steps.done = Array.from(new Set([...c.next_steps.done, "request_reversal"]));
    c.next_steps.recommended = { kind: "report_agent", title: "Report agent AG-2231", detail: "11 SIM swaps today, no fingerprint taken." };
    c.next_steps.remaining = c.next_steps.remaining.filter((k) => k !== "report_agent" && k !== "request_reversal");
    reversalPolls = 0;
    addEvent(id, { kind: "reversal", source: "person", actor: ama, title: "Requested reversal RV-0921 from MoMo ops", detail: `${(body?.payment_ids as string[] | undefined)?.length ?? 0} payments` });
    return { status: 202, body: reversal() };
  }
  if (method === "POST" && sub === "escalations") {
    const c = getCase(id);
    const kind = String(body?.kind ?? "question");
    c.escalation = {
      id: `esc_${Date.now().toString(36)}`,
      kind,
      to: { id: "usr_efua", name: "Efua Owusu-Ansah", initials: "EO", role: "Fraud supervisor" },
      question: body?.question,
      priority: body?.priority ?? "urgent",
      sent_at: clock(),
      reply_due_at: new Date(Date.parse(clock()) + 30 * 60_000).toISOString(),
      status: "waiting",
      answer: null,
      polls: 0,
    };
    if (kind !== "agent_suspension") c.status = "escalated";
    addEvent(id, { kind: "escalation", source: "person", actor: ama, title: kind === "agent_suspension" ? "Requested suspension of agent AG-2231" : "Escalated to Efua Owusu-Ansah", detail: String(body?.question ?? "") });
    return { status: 201, body: c.escalation };
  }
  // PROPOSED: DELETE /escalations/{id} — withdraw before it’s answered.
  if (method === "POST" && sub === "handover") {
    const c = getCase(id);
    const to = PEOPLE.data.find((p) => p.id === body?.to_user_id) ?? PEOPLE.data[0];
    c.handover = { to, note: body?.note, status: "offered", at: clock() };
    return { status: 202, body: { id: `ho_${Date.now()}`, case_id: id, from: ama, to, status: "offered", note: body?.note } };
  }
  // POST /cases/{id}/resolution — confirmed fraud waits for sign-off; the others close now.
  if (method === "POST" && sub === "resolution") {
    const c = getCase(id);
    const outcome = String(body?.outcome) as DemoResolution["outcome"];
    const resubmit = c.resolution?.status === "sent_back";
    const signoff = outcome === "confirmed_fraud";
    c.resolution = {
      ...(c.resolution ?? {}),
      outcome,
      summary: String(body?.summary ?? c.resolution?.summary ?? ""),
      amount_lost: body?.amount_lost as ReturnType<typeof GHS> | undefined,
      amount_recovered: body?.amount_recovered as ReturnType<typeof GHS> | undefined,
      submitted_at: resubmit ? c.resolution!.submitted_at : clock(),
      submitted_by: ama,
      status: signoff ? "pending_decision" : "closed",
      reviewer: signoff ? EFUA : undefined,
      due_at: signoff ? "2026-10-20T16:00:00Z" : undefined,
      resubmitted_at: resubmit ? clock() : undefined,
      sent_back: resubmit ? c.resolution!.sent_back : null,
      linked: (body?.link_cases as string[] | undefined) ?? [],
      reason: body?.reason as string | undefined,
      rule_feedback: (body?.rule_feedback as string | undefined) ?? null,
      watch_days: body?.watch_days as number | undefined,
      reopen_on_repeat: body?.reopen_on_repeat as boolean | undefined,
      polls: 0,
    };
    c.status = signoff ? "pending_decision" : "closed";
    c.stage = signoff ? "decide" : "closed";
    const back = body?.amount_recovered as ReturnType<typeof GHS> | undefined;
    const lost = body?.amount_lost as ReturnType<typeof GHS> | undefined;
    if (back && lost && back.amount_minor > 0) {
      c.glance.money = { label: "recovered", amount: back, note: `GHS ${((lost.amount_minor - back.amount_minor) / 100).toLocaleString("en-GB")} lost` };
    }
    if (signoff) {
      c.next_steps.done = Array.from(new Set([...c.next_steps.done, "report_agent"]));
      c.next_steps.recommended = { kind: "await_signoff" as never, title: "Waiting for Efua’s sign-off", detail: "Submitted · due by 16:00 today." };
      c.next_steps.remaining = [];
    }
    addEvent(id, {
      kind: "resolution",
      source: "person",
      actor: ama,
      title: resubmit ? "Resubmitted for sign-off" : signoff ? "Submitted for sign-off · confirmed fraud" : `Closed as ${outcome.replace(/_/g, " ")}`,
      detail: String(body?.summary ?? ""),
    });
    return { status: 200, body: { id, stage: c.stage, status: c.status, assignee: ama } };
  }
  // PROPOSED: DELETE /cases/{id}/resolution — withdraw a submission before it’s reviewed.
  if (method === "DELETE" && sub === "resolution") {
    const c = getCase(id);
    c.resolution = null;
    c.status = "investigating";
    c.stage = "act";
    return { status: 204, body: null };
  }
  if (method === "POST" && sub === "reopen") {
    const c = getCase(id);
    c.status = "investigating";
    c.stage = "investigate";
    c.rejection = null;
    c.next_steps.recommended = { kind: "call_subscriber", title: "Look at what changed", detail: String(body?.reason ?? "") };
    addEvent(id, { kind: "status", source: "person", actor: ama, title: "Reopened", detail: String(body?.reason ?? "") });
    return { status: 200, body: { id, stage: c.stage, status: c.status, assignee: ama } };
  }
  if (method === "POST" && sub === "monitor") {
    const c = getCase(id);
    const days = Number(body?.days ?? 30);
    c.monitoring = { days, entities: body?.entity_ids, reopen_on_repeat: body?.reopen_on_repeat, until: new Date(Date.parse(clock()) + days * 86_400_000).toISOString().slice(0, 10) };
    c.stage = "monitor";
    addEvent(id, { kind: "status", source: "person", actor: ama, title: `Monitoring for ${days} days`, detail: `${(body?.entity_ids as string[] | undefined)?.length ?? 0} numbers and wallets on watch` });
    return { status: 200, body: { case_id: id, ...c.monitoring, days_left: days } };
  }
  // PROPOSED: DELETE /cases/{id}/linked-alerts/{alert_id}
  if (method === "DELETE" && sub?.startsWith("linked-alerts/")) return { status: 204, body: null };
  return undefined;
}

export const _demo = { getCase, addEvent };
