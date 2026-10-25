import "server-only";

/**
 * Subscriber 360 and the analysis checks (FD_API_MOCK=1 only). RICHER
 * versions of GET /subscribers/{id}, plus PROPOSED endpoints the collection
 * doesn’t have yet: outflow, transactions, behaviour, SIM duplication, device
 * check and transaction patterns. Demo IDs:
 *   sub_4410 → MoMo didn’t answer (partial data, C16)
 *   sub_9101 → every source timed out (C18)
 *   sub_1234 → clean results (C22, C24) · sub_2210 → device registry down (C25)
 */

type Fixture = { status: number; body: unknown };
const GHS = (cedis: number) => ({ amount_minor: Math.round(cedis * 100), currency: "GHS" });

const KOJO = {
  id: "sub_8KQ2",
  name: "Kojo M.",
  initials: "KM",
  msisdn: "+233 54 *** 3457",
  status: "active",
  risk_score: 97,
  plan: "Prepaid",
  customer_since: "2019-03-11",
  prepaid_since: "2023-08-12",
  home: "Kumasi, Ashanti",
  kyc: { ghana_card: "GHA-72*****-4", nia_verified: true, verified_at: "2023-08-12", branch: "Adum branch", dob_masked: "•• ••• 1987", dob_matches: true, address: "Bantama, Kumasi" },
  sim: { age_months: 38, iccid: "8923 3…0918", last_swap_at: "2026-10-20T06:34:00Z", swap_agent: "AG-2231" },
  device: { imei: "35 *** 4417", model: "Tecno Spark 20", usual_model: "Samsung A14", usual_months: 14, first_seen: "2026-10-20T08:39:00Z" },
  wallet: {
    tier: 2,
    status: "frozen",
    frozen_at: "2026-10-20T09:41:00Z",
    frozen_by: "Ama",
    balance: GHS(312.4),
    daily_limit: GHS(25000),
    usual_monthly_out: GHS(2100),
    usual_recipients: "3 · family",
    new_recipients_today: 4,
  },
  contact: { alt_msisdn: "020 *** 1180", language: "Twi, English", last_called_at: null },
  counts: { activity: 42, transactions: 118, devices: 4, cases: 2 },
  risk_reasons: [
    { rule: "R-104", text: "SIM swap followed by a high-value MoMo transfer", points: 38 },
    { rule: "R-211", text: "6 transfers in 22 min (normal 1-2 a day)", points: 24 },
    { rule: "R-318", text: "Transfers from a device never seen on this wallet", points: 19 },
    { rule: "R-402", text: "Paid 2 wallets in confirmed ring FD-2998", points: 16 },
  ],
  sim_history: [
    { at: "2026-10-20T06:34:00Z", iccid: "8923 3…0918", event: "sim_swap", where: "AG-2231 · Adum, Kumasi", agent: "AG-2231", id_check: "Ghana Card · not matched to photo", id_ok: false },
    { at: "2023-08-12T10:00:00Z", iccid: "8923 3…4471", event: "new_sim", where: "Kasa shop · Adum", agent: null, id_check: "Ghana Card · biometric", id_ok: true },
  ],
  devices_on_wallet: [
    { model: "Tecno Spark 20", imei: "3569…4417", first_seen: "2026-10-20T08:39:00Z", last_seen: "now", shared_with: "3 wallets · 2 in FD-3012", risky: true },
    { model: "Samsung Galaxy A14", imei: "3527…1886", first_seen: "2023-08-12T10:00:00Z", last_seen: "2026-10-20T06:30:00Z", shared_with: "This wallet only", risky: false },
    { model: "itel A70", imei: "3581…2240", first_seen: "2023-03-02T10:00:00Z", last_seen: "2023-08-01T10:00:00Z", shared_with: "This wallet only", risky: false },
  ],
  device_warning: { title: "This device has been used on 3 wallets in the last 24 hours", detail: "Two of them are linked to FD-3012. Devices shared across unrelated wallets are a strong sign of a mule operator." },
  unavailable: [] as string[],
  cases: [
    { alerts: 3, assignee: { id: "usr_ama", initials: "AM", name: "Ama Mensah" }, fraud_type: "sim_swap_to_momo", id: "FD-3050", money_at_stake: GHS(18400), risk_score: 97, sla_due_at: "2026-10-20T09:46:00Z", stage: "act", status: "investigating", subscriber: { msisdn: "+233 54 *** 3457", msisdn_ref: "pii_8KQ2", name: "Kojo M.", subscriber_id: "sub_8KQ2" }, title: "SIM swap to MoMo", waiting_since: "2026-10-20T09:25:00Z" },
    { alerts: 1, assignee: { id: "usr_kofi", initials: "KB", name: "Kofi Boateng" }, fraud_type: "momo_velocity", id: "FD-1402", money_at_stake: GHS(0), risk_score: 41, sla_due_at: null, stage: "closed", status: "closed", subscriber: { msisdn: "+233 54 *** 3457", msisdn_ref: "pii_8KQ2", name: "Kojo M.", subscriber_id: "sub_8KQ2" }, title: "Velocity, school fees", waiting_since: "2024-09-02T10:00:00Z" },
  ],
};

/** Recent activity on the Overview tab (newest first). */
const RECENT = [
  { at: "2026-10-20T09:25:00Z", text: "Case FD-3050 opened from alert AL-88213", hot: true },
  { at: "2026-10-20T08:39:00Z", text: "New device Tecno Spark 20 (IMEI …4417) on wallet", hot: true },
  { at: "2026-10-20T08:41:00Z", until: "2026-10-20T09:03:00Z", text: "6 MoMo transfers · GHS 18,400 to 4 new wallets", hot: true },
  { at: "2026-10-20T06:34:00Z", text: "SIM swap at agent AG-2231, Adum · ID shown: Ghana Card", hot: true },
  { at: "2026-10-19T19:10:00Z", text: "Airtime purchase GHS 10 · usual device", hot: false },
  { at: "2026-10-14T08:00:00Z", text: "Wallet login from Kumasi · usual device", hot: false },
];

/** PROPOSED: GET /subscribers/{id}/outflow?days=… — money out per day. */
function outflow(days: number) {
  const out = [];
  const end = Date.parse("2026-10-20T00:00:00Z");
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(end - i * 86_400_000).toISOString().slice(0, 10);
    // A steady, believable pattern; today is the spike.
    const amount = i === 0 ? 18400 : [600, 900, 1200, 1500, 700, 1100, 1800, 400, 1300, 1000][i % 10];
    out.push({ date, amount: GHS(amount) });
  }
  return { days: out, typical: { min: GHS(600), max: GHS(1800) }, today: GHS(18400) };
}

/** PROPOSED: GET /subscribers/{id}/behaviour — normal vs now (C19). */
const BEHAVIOUR = {
  compared_days: 90,
  signals: [
    { key: "where", label: "Where", usual: "Kumasi", today: "Accra", unusual: true },
    { key: "device", label: "Device", usual: "Infinix Hot 30", today: "Tecno Spark 20", unusual: true },
    { key: "hours", label: "Active hours", usual: "07:00-21:00", today: "06:34-09:03", unusual: false },
    { key: "average", label: "Average transfer", usual: "GHS 120", today: "GHS 3,067", unusual: true },
    { key: "recipients", label: "Recipients", usual: "3 regulars", today: "4 never paid", unusual: true },
  ],
  daily: outflow(30).days.map((d, i, all) => ({ ...d, amount: i === all.length - 1 ? GHS(18400) : GHS([150, 120, 240, 0, 180, 210, 130, 170, 90, 0, 220, 270, 160, 140, 230, 60, 150, 0, 190, 140, 120, 160, 200, 130, 90, 160, 180, 130, 170][i % 29]) })),
  normal_max: GHS(300),
  hours: { usual: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], today: [6, 7, 8, 9] },
  places: [
    { name: "Kumasi, Ashanti", share: 92 },
    { name: "Obuasi", share: 8 },
    { name: "Accra (today only)", share: 100, today: true },
  ],
  verdict: { title: "Pattern matches account takeover after a SIM swap", detail: "Same pattern as 41 confirmed cases this quarter. Freeze the wallet before more money leaves." },
};

/** PROPOSED: GET /subscribers/{id}/sim-check (C21/C22). */
const SIM_CHECK_DUP = {
  status: "duplicate",
  sim: "8923 3011 *** 4471",
  window_hours: 24,
  phones: [
    { label: "Phone A", model: "Infinix Hot 30", place: "Adum, Kumasi", cell: "KU-0412", seen: "Last seen 09:00", imei: "35 778 *** 0193", note: "His usual phone · 2 yrs", usual: true },
    { label: "Phone B", model: "Tecno Spark 20", place: "Madina, Accra", cell: "AC-1187", seen: "First seen 08:39", imei: "35 209 *** 1764", note: "Never seen before today", usual: false },
  ],
  distance_km: 248,
  minutes_apart: 4,
  registrations: [
    { phone: 0, at: "2026-10-20T06:10:00Z" }, { phone: 0, at: "2026-10-20T07:40:00Z" }, { phone: 0, at: "2026-10-20T08:15:00Z" }, { phone: 0, at: "2026-10-20T08:45:00Z" }, { phone: 0, at: "2026-10-20T09:00:00Z" },
    { phone: 1, at: "2026-10-20T08:39:00Z" }, { phone: 1, at: "2026-10-20T08:48:00Z" }, { phone: 1, at: "2026-10-20T09:12:00Z" }, { phone: 1, at: "2026-10-20T09:55:00Z" },
  ],
  overlap: { from: "2026-10-20T08:39:00Z", to: "2026-10-20T09:00:00Z" },
  axis: { from: "2026-10-20T06:00:00Z", to: "2026-10-20T10:00:00Z" },
  also_used: [
    { sim: "8923 3011 *** 9902", msisdn: "+233 24 *** 6610", case: { id: "FD-2998", label: "Confirmed fraud" } },
    { sim: "8923 3011 *** 5518", msisdn: "+233 55 *** 0047", case: null },
  ],
};
const SIM_CHECK_CLEAR = {
  status: "clear",
  sim: "8923 3011 *** 2286",
  window_hours: 24,
  phones: [{ label: "Phone A", model: "Samsung A14", place: "Tema", usual: true }],
  registrations: [0, 4.5, 6, 12.2, 12.9, 18, 21.5, 23.8].map((h) => ({ phone: 0, at: new Date(Date.parse("2026-10-19T10:00:00Z") + h * 3_600_000).toISOString() })),
  axis: { from: "2026-10-19T10:00:00Z", to: "2026-10-20T10:00:00Z" },
  checked: [
    ["Phones this SIM was in", "1"],
    ["Furthest move in 1 hour", "6 km (Tema to Ashaiman)"],
    ["SIM swaps in 90 days", "None"],
    ["IMEI check", "Valid · Samsung A14"],
  ],
};

/** PROPOSED: GET /subscribers/{id}/device-check (C23–C25). */
const DEVICE_INVALID = {
  model: "Tecno Spark 20",
  imei: "352099001761487",
  source: "IMEI from Phone B · first seen on this SIM today at 08:39",
  luhn: { valid: false, expected: 1, actual: 7 },
  tac: { brand: "Tecno", matches: false, note: "Number belongs to Tecno: the phone says Spark 20 but the TAC is for a 2019 model" },
  stolen: { listed: false, checked_at: "2026-10-20T09:41:00Z" },
  registry: "ok",
  other_sims: [
    { msisdn: "+233 24 *** 6610", case: { id: "FD-2998", label: "Confirmed fraud" } },
    { msisdn: "+233 55 *** 0047", case: null },
    { msisdn: "+233 27 *** 3391", case: null },
  ],
  other_window: "3 SIMs · 30 days",
};
const DEVICE_VALID = {
  ...DEVICE_INVALID,
  model: "Samsung A14",
  imei: "353456112087348",
  source: "IMEI from her only phone · in use on this SIM since March 2025",
  luhn: { valid: true, expected: 8, actual: 8 },
  tac: { brand: "Samsung", matches: true, note: "Samsung Galaxy A14, as reported by the phone" },
  stolen: { listed: false, checked_at: "2026-10-20T09:41:00Z" },
  other_sims: [],
  other_window: "1 SIM · 90 days",
};
const DEVICE_PARTIAL = { ...DEVICE_VALID, model: null, imei: "353456112087348", tac: null, stolen: null, registry: "unavailable", registry_last_try: "2026-10-20T11:20:00Z" };

/** PROPOSED: GET /subscribers/{id}/patterns (C26). */
function patterns(search: URLSearchParams) {
  const min = Number(search.get("min") ?? 0) * 100;
  const max = Number(search.get("max") ?? 20000) * 100;
  const normal = [
    ["2026-10-14T09:00:00Z", 120], ["2026-10-14T15:00:00Z", 80], ["2026-10-15T12:00:00Z", 150], ["2026-10-16T08:00:00Z", 200],
    ["2026-10-16T18:00:00Z", 60], ["2026-10-17T11:00:00Z", 130], ["2026-10-18T10:00:00Z", 90], ["2026-10-18T19:00:00Z", 110],
    ["2026-10-19T13:00:00Z", 240], ["2026-10-19T18:40:00Z", 20], ["2026-10-19T21:00:00Z", 70],
  ] as const;
  const flagged = [["2026-10-20T08:41:00Z", 4200], ["2026-10-20T08:45:00Z", 3500], ["2026-10-20T08:49:00Z", 3000], ["2026-10-20T08:53:00Z", 2800], ["2026-10-20T08:58:00Z", 2000], ["2026-10-20T09:03:00Z", 2900]] as const;
  const transfers = [
    ...normal.map(([at, c]) => ({ at, amount: GHS(c), flagged: false })),
    ...flagged.map(([at, c]) => ({ at, amount: GHS(c), flagged: true })),
  ].filter((t) => t.amount.amount_minor >= min && t.amount.amount_minor <= max);
  return {
    transfers,
    normal_max: GHS(300),
    cluster: { from: "2026-10-20T08:41:00Z", to: "2026-10-20T09:03:00Z", count: 6, total: GHS(18400), minutes: 22 },
    findings: [
      { kind: "burst", title: "Burst", headline: "6 transfers in 22 min", detail: "He usually sends 1-2 a day." },
      { kind: "fanout", title: "Fan-out", headline: "4 recipients, all new", detail: "Money split to wallets he has never paid." },
      { kind: "drain", title: "Drain", headline: "98% of balance gone", detail: "Only GHS 312.40 left after 3 hours." },
    ],
  };
}

/** PROPOSED: GET /subscribers/{id}/transactions — the wallet’s history (same shape as the case’s). */
const TX: Array<[string, number, string, string, string, boolean, string]> = [
  ["2026-10-20T09:03:00Z", 2900, "Agent 557210", "New, in FD-3047", "agent_cash_out", true, "agent_holds"],
  ["2026-10-20T08:58:00Z", 2000, "027 *** 4471", "New", "transfer", true, "cashed_out"],
  ["2026-10-20T08:53:00Z", 2800, "020 *** 6634", "New", "transfer", true, "cashed_out"],
  ["2026-10-20T08:49:00Z", 3000, "024 *** 8812", "New, in FD-2998", "transfer", true, "in_wallet"],
  ["2026-10-20T08:45:00Z", 3500, "055 *** 2093", "New", "transfer", true, "in_wallet"],
  ["2026-10-20T08:41:00Z", 4200, "024 *** 8812", "New, in FD-2998", "transfer", true, "in_wallet"],
  ["2026-10-19T18:40:00Z", 20, "Self", "", "airtime", false, "in_wallet"],
  ["2026-10-19T12:05:00Z", 145, "Melcom Adum", "", "merchant", false, "in_wallet"],
];
const TRANSACTIONS = {
  data: TX.map(([at, cedis, counterparty, counterparty_note, type, flagged, where_now], i) => ({
    id: `MP${2010 + i}.${9031 - i * 4}`, at, amount: GHS(cedis), counterparty, counterparty_note, direction: "out", flagged, type, where_now,
  })),
  totals: { balance: GHS(312.4), flagged: 6, total: 118, out_since_swap: GHS(18400) },
};

/** RICHER: audit trail for a subscriber (GET /audit/events?object=…). */
const AUDIT = {
  next_cursor: null,
  data: [
    { id: "au3", at: "2026-10-20T09:41:00Z", actor: { id: "usr_ama", name: "Ama Mensah", initials: "AM" }, action: "wallet.frozen", object: "sub_8KQ2", reason: "FD-3050" },
    { id: "au2", at: "2026-10-20T09:33:00Z", actor: { id: "usr_ama", name: "Ama Mensah", initials: "AM" }, action: "pii.revealed", object: "sub_8KQ2", reason: "Investigating FD-3050" },
    { id: "au1", at: "2026-10-20T09:31:00Z", actor: { id: "usr_ama", name: "Ama Mensah", initials: "AM" }, action: "profile.viewed", object: "sub_8KQ2", reason: "FD-3050" },
  ],
};

export function mockSubscriberFixture(method: string, path: string, search: URLSearchParams): Fixture | undefined {
  if (method === "GET" && path === "audit/events" && search.get("object")?.startsWith("sub_")) return { status: 200, body: AUDIT };
  const m = path.match(/^subscribers\/([^/]+)(?:\/(.+))?$/);
  if (!m || method !== "GET") return undefined;
  const [, id, sub] = m;
  if (id === "sub_9101" && !sub) {
    return { status: 504, body: { status: 504, code: "sources_timeout", title: "Couldn’t load this subscriber", detail: "MoMo, KYC and the network all timed out. This is usually a connection problem on our side, not this number.", request_id: "SUB-504-7F21" } };
  }
  if (!sub) {
    return {
      status: 200,
      body: id === "sub_4410" ? { ...KOJO, id, unavailable: ["wallet"], wallet_as_of: "2026-10-20T09:12:00Z", wallet_last_try: "2026-10-20T09:44:00Z" } : { ...KOJO, id },
    };
  }
  if (sub === "recent") return { status: 200, body: { data: RECENT } };
  if (sub === "outflow") return { status: 200, body: outflow(Number(search.get("days") ?? 30)) };
  if (sub === "behaviour") return { status: 200, body: BEHAVIOUR };
  if (sub === "sim-check") return { status: 200, body: id === "sub_1234" ? SIM_CHECK_CLEAR : SIM_CHECK_DUP };
  if (sub === "device-check") return { status: 200, body: id === "sub_1234" ? DEVICE_VALID : id === "sub_2210" ? DEVICE_PARTIAL : DEVICE_INVALID };
  if (sub === "patterns") return { status: 200, body: patterns(search) };
  if (sub === "transactions") return { status: 200, body: TRANSACTIONS };
  return undefined;
}
