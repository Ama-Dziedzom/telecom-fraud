import "server-only";
import { mockAccountFixture } from "./mock-account";
import { mockCaseListFixture } from "./mock-caselist";
import { mockHeatmapFixture } from "./mock-heatmap";
import { mockInsightsFixture } from "./mock-insights";
import { mockLookupFixture } from "./mock-lookup";
import { mockReportsFixture } from "./mock-reports";
import { mockTraceFixture } from "./mock-trace";
import { mockCaseFixture } from "./mock-cases";
import { mockSubscriberFixture } from "./mock-subscribers";

/**
 * Demo data for the Postman mock (FD_API_MOCK=1 only), in two kinds:
 *
 *  - PROPOSED endpoints the screens need but the collection doesn’t have yet
 *    (each is in the list of Postman additions). They answer here until the
 *    collection — and so the mock — serves them.
 *  - RICHER examples for endpoints whose collection example is placeholder
 *    data (“string”, dates in 1988), so the screens show something readable.
 *
 * Nothing here runs against the real API.
 */

type Body = Record<string, unknown> | null;
type Fixture = { status: number; body: unknown };

const GHS = (cedis: number) => ({ amount_minor: Math.round(cedis * 100), currency: "GHS" });
const ama = { id: "usr_ama", name: "Ama Mensah", initials: "AM" };

/** The collection’s GET /alerts example, so detail views agree with the list. */
const ALERTS = [
  { id: "AL-88213", created_at: "2026-10-20T09:25:00Z", region: "Accra", risk_score: 97, rule_ids: ["R-104", "R-211", "R-318"], severity: "critical", status: "auto_case", case_id: "FD-3050", title: "SIM swap to MoMo transfers", subscriber: { msisdn: "+233 54 *** 3457", msisdn_ref: "pii_8KQ2", name: "Kojo M.", subscriber_id: "sub_8KQ2" } },
  { id: "AL-88211", created_at: "2026-10-20T09:22:00Z", region: "Ashaiman", risk_score: 81, rule_ids: ["R-502"], severity: "high", status: "new", case_id: null, title: "SIM box: new SIM, 400 calls an hour", subscriber: { msisdn: "+233 55 *** 2210", msisdn_ref: "pii_2210", name: "Unregistered SIM", subscriber_id: "sub_2210" } },
  { id: "AL-88209", created_at: "2026-10-20T09:19:00Z", region: "Tema", risk_score: 84, rule_ids: ["R-502"], severity: "high", status: "promoted", case_id: "FD-3053", title: "Bypass: SIM-box call pattern", subscriber: { msisdn: "+233 55 *** 0418", msisdn_ref: "pii_0418", name: "Unregistered SIM", subscriber_id: "sub_0418" } },
  { id: "AL-88206", created_at: "2026-10-20T09:14:00Z", region: "Accra", risk_score: 79, rule_ids: ["R-118", "R-120"], severity: "high", status: "promoted", case_id: "FD-3052", title: "New device + KYC name mismatch", subscriber: { msisdn: "+233 20 *** 1234", msisdn_ref: "pii_1234", name: "Esi A.", subscriber_id: "sub_1234" } },
  { id: "AL-88203", created_at: "2026-10-20T09:06:00Z", region: "Kasoa", risk_score: 92, rule_ids: ["R-211", "R-318"], severity: "critical", status: "auto_case", case_id: "FD-3049", title: "MoMo velocity spike", subscriber: { msisdn: "+233 26 *** 4410", msisdn_ref: "pii_4410", name: "Akua S.", subscriber_id: "sub_4410" } },
  { id: "AL-88199", created_at: "2026-10-20T09:02:00Z", region: "Takoradi", risk_score: 76, rule_ids: ["R-410"], severity: "high", status: "seen", case_id: null, title: "Account takeover: 3 failed PINs", subscriber: { msisdn: "+233 27 *** 9101", msisdn_ref: "pii_9101", name: "Adwoa K.", subscriber_id: "sub_9101" } },
  { id: "AL-88195", created_at: "2026-10-20T08:57:00Z", region: "Cape Coast", risk_score: 62, rule_ids: ["R-611"], severity: "medium", status: "new", case_id: null, title: "Wangiri: missed-call burst", subscriber: { msisdn: "+233 55 *** 8890", msisdn_ref: "pii_8890", name: "Kweku N.", subscriber_id: "sub_8890" } },
  { id: "AL-88191", created_at: "2026-10-20T08:52:00Z", region: "Kumasi", risk_score: 58, rule_ids: ["R-702"], severity: "medium", status: "attached", case_id: "FD-3047", title: "Agent cash-out spike", subscriber: { msisdn: "Agent 557210", msisdn_ref: "pii_557210", name: "Agent 557210", subscriber_id: "agt_557210" } },
];

const RULE_NAMES: Record<string, [string, number]> = {
  "R-104": ["SIM swap + high-value MoMo in 24 h", 38],
  "R-211": ["Velocity", 38],
  "R-318": ["New device", 24],
  "R-402": ["Known mule", 26],
  "R-118": ["New device on wallet", 30],
  "R-120": ["KYC name mismatch", 28],
  "R-410": ["Failed PIN burst", 40],
  "R-502": ["SIM-box call pattern", 52],
  "R-611": ["Missed-call burst", 34],
  "R-702": ["Agent cash-out spike", 30],
};

/** What happened, per alert. The SIM-swap story is the collection’s own example. */
const STORIES: Record<string, { steps: unknown[]; money_out?: number; suggested?: [string, string, string] }> = {
  "AL-88213": {
    money_out: 18400,
    steps: [
      { at: "2026-10-20T06:34:00Z", kind: "sim_swap", label: "SIM swapped", detail: "Agent AG-2231, Adum" },
      { at: "2026-10-20T08:39:00Z", kind: "new_device", label: "New phone logs in", detail: "Tecno Spark 20, Accra" },
      { at: "2026-10-20T08:41:00Z", kind: "payments_out", label: "6 payments out", detail: "GHS 18,400 in 22 minutes", tone: "critical" },
    ],
  },
  "AL-88203": {
    money_out: 7350,
    suggested: ["FD-3047", "Agent cash-out spike", "Same mule wallet, same pattern. One case keeps the story together."],
    steps: [
      { at: "2026-10-20T08:46:00Z", kind: "new_device", label: "New phone signs in", detail: "Itel A70 · never seen on this wallet" },
      { at: "2026-10-20T08:47:00Z", kind: "payments_out", label: "Transfers start", detail: "First one GHS 800" },
      { at: "2026-10-20T09:05:00Z", kind: "recipients", label: "9 transfers to 5 new wallets", detail: "GHS 7,350 in 18 min · she usually sends 1-2 a day", tone: "critical" },
      { at: "2026-10-20T09:05:00Z", kind: "network", label: "One wallet is already evidence", detail: "024 *** 8812 in your case FD-3047", tone: "critical" },
    ],
  },
  "AL-88211": {
    steps: [
      { at: "2026-10-20T08:10:00Z", kind: "sim", label: "New SIM activated", detail: "Unregistered · no KYC on file" },
      { at: "2026-10-20T08:40:00Z", kind: "calls", label: "Calls start", detail: "International inbound, re-routed locally" },
      { at: "2026-10-20T09:22:00Z", kind: "calls", label: "400 calls in the last hour", detail: "Average 38 seconds · one cell site in Ashaiman", tone: "critical" },
    ],
  },
  "AL-88199": {
    suggested: ["FD-3044", "Account takeover", "Same caller asked customer care to reset this PIN yesterday."],
    steps: [
      { at: "2026-10-19T15:20:00Z", kind: "crm", label: "Customer care call: “change my MoMo PIN”", detail: "Failed security questions" },
      { at: "2026-10-20T08:58:00Z", kind: "pin", label: "3 failed PIN attempts", detail: "From a device never seen on this wallet", tone: "critical" },
      { at: "2026-10-20T09:02:00Z", kind: "pin", label: "Wallet temporarily locked", detail: "Automatic lock after 3 attempts" },
    ],
  },
  "AL-88191": {
    steps: [
      { at: "2026-10-20T08:20:00Z", kind: "payments_out", label: "4 cash-outs at agent 557210", detail: "GHS 9,600 in 30 minutes, from 4 new wallets" },
      { at: "2026-10-20T08:52:00Z", kind: "network", label: "Wallets linked to FD-3047", detail: "Same mule ring as the overnight cash-outs", tone: "critical" },
    ],
  },
  "AL-88195": {
    steps: [
      { at: "2026-10-20T08:40:00Z", kind: "calls", label: "Missed calls from +882 range", detail: "212 subscribers in Cape Coast" },
      { at: "2026-10-20T08:57:00Z", kind: "calls", label: "Call-backs to a premium number", detail: "14 subscribers called back · GHS 4.20 a minute" },
    ],
  },
};

function alertDetail(id: string) {
  const base = ALERTS.find((a) => a.id === id) ?? { ...ALERTS[0], id };
  const story = STORIES[base.id] ?? { steps: [] };
  return {
    ...base,
    id,
    rules_fired: base.rule_ids.map((r) => ({ id: r, name: RULE_NAMES[r]?.[0] ?? r, points: RULE_NAMES[r]?.[1] ?? 10 })),
    what_happened: story.steps,
    money_out: story.money_out ? GHS(story.money_out) : undefined,
    suggested_case: story.suggested
      ? { id: story.suggested[0], title: story.suggested[1], reason: story.suggested[2] }
      : null,
  };
}

/** PROPOSED: GET /alerts/{id}/transactions — same shape as the case transactions. */
function alertTransactions() {
  const rows: Array<[string, string, string, number]> = [
    ["09:05", "024 *** 8812", "New", 1200], ["09:02", "055 *** 2093", "New", 800], ["09:00", "024 *** 8812", "New", 950],
    ["08:57", "020 *** 6634", "New", 700], ["08:55", "027 *** 4471", "New", 1000], ["08:53", "050 *** 1182", "New", 600],
    ["08:51", "024 *** 7710", "Known", 900], ["08:49", "024 *** 7710", "Known", 600], ["08:47", "055 *** 9001", "Known", 600],
  ];
  return {
    data: rows.map(([t, to, note, cedis], i) => ({
      id: `MP2010.${8900 + i}`,
      at: `2026-10-20T${t}:00Z`,
      amount: GHS(cedis),
      counterparty: to,
      counterparty_note: note,
      direction: "out",
      flagged: note === "New",
      type: "transfer",
    })),
    totals: { balance: GHS(312.4), flagged: 6, total: 9, out: GHS(7350), window_minutes: 18 },
  };
}

/** PROPOSED: GET /alerts/{id}/case-suggestions */
const CASE_SUGGESTIONS = {
  data: [
    { case: { id: "FD-3047", title: "Agent cash-out spike", fraud_type: "agent_cash_out", assignee: ama }, match: "Same recipient wallet 024 *** 8812", strength: "suggested" },
    { case: { id: "FD-3050", title: "SIM swap to MoMo", fraud_type: "sim_swap_to_momo", assignee: ama }, match: "Same region and time window", strength: "possible" },
    { case: { id: "FD-3039", title: "SIM swap", fraud_type: "sim_swap_to_momo", assignee: { id: "usr_kwame", name: "Kwame Asante", initials: "KA" } }, match: "Same device model (Itel A70)", strength: "weak" },
  ],
};

/** RICHER: GET /subscribers/{id}/activity */
const ACTIVITY = {
  next_cursor: null,
  data: [
    { id: "ev1", at: "2026-10-20T09:05:00Z", source: "momo", kind: "alert", title: "9th transfer · GHS 1,200 to 024 *** 8812", detail: "Alert raised: velocity rule R-211" },
    { id: "ev2", at: "2026-10-20T08:46:00Z", source: "network", kind: "device", title: "New device registered on this SIM", detail: "Itel A70 · IMEI 35 *** 2290 · first seen on this wallet" },
    { id: "ev3", at: "2026-10-20T08:45:00Z", source: "momo", kind: "event", title: "Successful PIN entry after 2 failed attempts", detail: "From the new device" },
    { id: "ev4", at: "2026-10-20T08:12:00Z", source: "network", kind: "event", title: "Calls from 3 unknown numbers", detail: "All under 20 seconds" },
    { id: "ev5", at: "2026-10-19T15:20:00Z", source: "crm", kind: "event", title: "Customer care call: “change my MoMo PIN”", detail: "Agent ID CC-1182 · call declined, failed security questions" },
    { id: "ev6", at: "2026-10-18T12:05:00Z", source: "momo", kind: "event", title: "Normal activity", detail: "2 transfers · airtime · merchant payment (Melcom Kumasi)" },
    { id: "ev7", at: "2024-07-12T10:00:00Z", source: "crm", kind: "kyc", title: "Ghana Card KYC verified", detail: "Wallet upgraded to Tier 2" },
  ],
};

/** RICHER: GET /subscribers/{id}/devices — newest first; the last row is the SIM itself. */
const DEVICES = {
  data: [
    { kind: "device", imei: "35 *** 2290", model: "Itel A70", first_seen: "2026-10-20T08:46:00Z", last_seen: "2026-10-20T09:25:00Z", eir_status: "valid", sim_iccid: "8923 *** 0918", note: "New: never used with this SIM before" },
    { kind: "device", imei: "35 *** 7781", model: "Samsung A14", first_seen: "2025-03-02T10:00:00Z", last_seen: "2026-10-20T06:30:00Z", eir_status: "valid", sim_iccid: "8923 *** 0918", note: "Used for 19 months" },
    { kind: "sim", imei: "", model: "SIM issued · no swaps since", first_seen: "2024-06-14T10:00:00Z", last_seen: "2026-10-20T09:25:00Z", eir_status: "valid", sim_iccid: "8923 *** 0918", note: "Adum branch · agent AG-1044" },
  ],
};

/** RICHER + PROPOSED: GET /me — the collection’s example plus regions and next_shift. */
const ME = {
  email: "ama.mensah@kasamobile.com.gh",
  id: "usr_ama",
  last_active_at: "2026-10-20T09:31:00Z",
  name: "Ama Mensah",
  role: "fraud_analyst",
  shift: "08:00-16:00",
  status: "active",
  regions: ["Greater Accra", "Ashanti"],
  next_shift: { user: { id: "usr_kwame", name: "Kwame Asante", initials: "KA" }, shift: "night", starts_at: "16:00" },
};

export function mockFixture(method: string, path: string, body: Body, search: URLSearchParams): Fixture | undefined {
  if (method === "GET" && path === "me") return { status: 200, body: ME };
  const forCase =
    mockAccountFixture(method, path, body, search) ??
    mockHeatmapFixture(method, path, search) ??
    mockTraceFixture(method, path, search) ??
    mockInsightsFixture(method, path, search) ??
    mockReportsFixture(method, path, body, search) ??
    mockLookupFixture(method, path, body, search) ??
    mockCaseListFixture(method, path, body, search) ??
    mockCaseFixture(method, path, body, search) ?? mockSubscriberFixture(method, path, search);
  if (forCase) return forCase;
  const alert = path.match(/^alerts\/([^/]+)(?:\/(.+))?$/);
  if (alert && alert[1] !== "stream") {
    const [, id, sub] = alert;
    if (method === "GET" && !sub) return { status: 200, body: alertDetail(id) };
    if (method === "GET" && sub === "transactions") return { status: 200, body: alertTransactions() };
    if (method === "GET" && sub === "case-suggestions") return { status: 200, body: CASE_SUGGESTIONS };
    // Someone else is already triaging this one (B20).
    if (method === "POST" && sub === "lock" && id === "AL-88199") {
      return {
        status: 423,
        body: {
          status: 423,
          code: "alert_locked",
          title: "Kofi Boateng is triaging this alert",
          locked_by: { id: "usr_kofi", name: "Kofi Boateng", initials: "KB" },
          since: "2026-10-20T09:26:00Z",
        },
      };
    }
    if (method === "POST" && sub === "undo-dismiss") return { status: 200, body: { ...alertDetail(id), status: "new" } };
  }
  if (method === "POST" && path === "alerts/bulk") return { status: 202, body: { accepted: true } };
  if (method === "GET" && /^subscribers\/[^/]+\/activity$/.test(path)) return { status: 200, body: ACTIVITY };
  // RICHER: the example only returns the number; the screens show every masked field.
  if (method === "POST" && /^subscribers\/[^/]+\/reveal$/.test(path)) {
    return {
      status: 200,
      body: {
        values: { msisdn: "+233 54 218 3457", name: "Kojo Mensah Boadu", dob: "14 Mar 1987", ghana_card: "GHA-723019884-4", alt_msisdn: "020 551 1180" },
        expires_at: new Date(Date.parse(process.env.NEXT_PUBLIC_FD_DEMO_NOW ?? "") + 15 * 60_000 || Date.now() + 15 * 60_000).toISOString(),
        audit_event_id: "aud_reveal_01",
      },
    };
  }
  if (method === "GET" && /^subscribers\/[^/]+\/devices$/.test(path)) return { status: 200, body: DEVICES };
  return undefined;
}
