import "server-only";

/**
 * Case lists, the stage board, pick-up, saved views and prospects
 * (FD_API_MOCK=1 only). GET /cases and POST /cases/pick-up are in the
 * collection; counts, views and prospects are proposed additions.
 */

type Fixture = { status: number; body: unknown };
const GHS = (cedis: number) => ({ amount_minor: Math.round(cedis * 100), currency: "GHS" });
const AMA = { id: "usr_ama", initials: "AM", name: "Ama Mensah" };
const KB = { id: "usr_kofi", initials: "KB", name: "Kofi Boateng" };
const YD = { id: "usr_yaw", initials: "YD", name: "Yaw Dankwa" };
const EO = { id: "usr_efua", initials: "EO", name: "Efua Owusu-Ansah" };
const clock = () => Date.parse(process.env.NEXT_PUBLIC_FD_DEMO_NOW ?? "") || Date.now();
const iso = (minutesFromNow: number) => new Date(clock() + minutesFromNow * 60_000).toISOString();

type Row = {
  id: string;
  title: string;
  fraud_type: string;
  stage: string;
  status: string;
  risk_score: number;
  alerts: number;
  sla_due_at: string | null;
  waiting_since: string;
  money_at_stake: ReturnType<typeof GHS>;
  assignee: typeof AMA | null;
  subscriber: { msisdn: string; msisdn_ref: string; name: string; subscriber_id: string };
  region: string;
  /** Board card extras (proposed). */
  card?: { note?: string; badge?: string; badge_tone?: string };
};

const sub = (msisdn: string, name: string, id: string) => ({ msisdn, msisdn_ref: `pii_${id.slice(4)}`, name, subscriber_id: id });

/** The collection’s six “mine” cases, then the team queue and the rest of the board. */
export const ROWS: Row[] = [
  { id: "FD-3050", title: "SIM swap to MoMo takeover", fraud_type: "sim_swap_to_momo", stage: "investigate", status: "investigating", risk_score: 97, alerts: 3, sla_due_at: iso(18), waiting_since: "2026-10-20T09:25:00Z", money_at_stake: GHS(18400), assignee: AMA, subscriber: sub("+233 54 *** 3457", "Kojo M.", "sub_8KQ2"), region: "Greater Accra" },
  { id: "FD-3051", title: "MoMo velocity", fraud_type: "momo_velocity", stage: "investigate", status: "investigating", risk_score: 88, alerts: 2, sla_due_at: iso(26), waiting_since: "2026-10-20T09:04:00Z", money_at_stake: GHS(5600), assignee: AMA, subscriber: sub("+233 24 *** 6789", "Yaw B.", "sub_6789"), region: "Ashanti" },
  { id: "FD-3047", title: "Mule ring · Kumasi", fraud_type: "agent_cash_out", stage: "investigate", status: "investigating", risk_score: 84, alerts: 4, sla_due_at: iso(100), waiting_since: "2026-10-19T22:40:00Z", money_at_stake: GHS(22050), assignee: AMA, subscriber: sub("Agent 557210", "Agent 557210", "agt_557210"), region: "Ashanti" },
  { id: "FD-3046", title: "Bypass (SIM box)", fraud_type: "sim_box_bypass", stage: "act", status: "escalated", risk_score: 81, alerts: 2, sla_due_at: iso(-12), waiting_since: "2026-10-20T06:50:00Z", money_at_stake: GHS(0), assignee: AMA, subscriber: sub("+233 55 *** 5678", "Kwesi A.", "sub_5678"), region: "Greater Accra" },
  { id: "FD-3044", title: "Agent cash-out spike", fraud_type: "account_takeover", stage: "decide", status: "sent_back", risk_score: 76, alerts: 1, sla_due_at: iso(125), waiting_since: "2026-10-19T15:12:00Z", money_at_stake: GHS(6200), assignee: AMA, subscriber: sub("+233 27 *** 9101", "Adwoa K.", "sub_9101"), region: "Western", card: { badge: "Pending", badge_tone: "medium", note: "Efua · due 16:00" } },
  { id: "FD-3041", title: "Bypass (SIM box)", fraud_type: "sim_box_bypass", stage: "decide", status: "pending_decision", risk_score: 63, alerts: 2, sla_due_at: iso(330), waiting_since: "2026-10-19T11:05:00Z", money_at_stake: GHS(0), assignee: AMA, subscriber: sub("+233 50 *** 1123", "Fiifi E.", "sub_1123"), region: "Greater Accra" },
  // Team queue: new and unassigned.
  { id: "FD-3053", title: "Bypass (SIM box)", fraud_type: "sim_box_bypass", stage: "investigate", status: "new", risk_score: 84, alerts: 1, sla_due_at: iso(234), waiting_since: iso(-6), money_at_stake: GHS(0), assignee: null, subscriber: sub("+233 55 *** 0418", "Unregistered SIM", "sub_0418"), region: "Greater Accra" },
  { id: "FD-3052", title: "New device + KYC mismatch", fraud_type: "account_takeover", stage: "investigate", status: "new", risk_score: 79, alerts: 1, sla_due_at: iso(229), waiting_since: iso(-11), money_at_stake: GHS(0), assignee: null, subscriber: sub("+233 20 *** 1234", "Esi A.", "sub_1234"), region: "Greater Accra" },
  { id: "FD-3048", title: "Bypass (SIM box)", fraud_type: "sim_box_bypass", stage: "investigate", status: "new", risk_score: 71, alerts: 3, sla_due_at: iso(190), waiting_since: iso(-50), money_at_stake: GHS(0), assignee: null, subscriber: sub("+233 27 *** 3301", "Unregistered SIM", "sub_3301"), region: "Central" },
  { id: "FD-3045", title: "Wangiri", fraud_type: "wangiri", stage: "investigate", status: "new", risk_score: 52, alerts: 4, sla_due_at: iso(420), waiting_since: iso(-60), money_at_stake: GHS(0), assignee: null, subscriber: sub("+233 55 *** 8890", "Kweku N.", "sub_8890"), region: "Central" },
  { id: "FD-3036", title: "Account takeover", fraud_type: "account_takeover", stage: "investigate", status: "new", risk_score: 44, alerts: 1, sla_due_at: iso(705), waiting_since: iso(-240), money_at_stake: GHS(0), assignee: null, subscriber: sub("+233 54 *** 8901", "Abena O.", "sub_8901"), region: "Western" },
  { id: "FD-3049", title: "MoMo velocity spike", fraud_type: "momo_velocity", stage: "investigate", status: "new", risk_score: 92, alerts: 1, sla_due_at: iso(40), waiting_since: iso(-22), money_at_stake: GHS(7350), assignee: null, subscriber: sub("+233 26 *** 4410", "Akua S.", "sub_4410"), region: "Greater Accra" },
  // The rest of the board.
  { id: "FD-3061", title: "SIM box · Tema", fraud_type: "sim_box_bypass", stage: "investigate", status: "investigating", risk_score: 89, alerts: 2, sla_due_at: iso(300), waiting_since: iso(-90), money_at_stake: GHS(0), assignee: AMA, subscriber: sub("+233 55 *** 7712", "Unregistered SIM", "sub_7712"), region: "Greater Accra" },
  { id: "FD-3039", title: "Wangiri burst · Accra", fraud_type: "wangiri", stage: "decide", status: "pending_decision", risk_score: 58, alerts: 5, sla_due_at: null, waiting_since: iso(-1500), money_at_stake: GHS(0), assignee: YD, subscriber: sub("+233 24 *** 3310", "Premium numbers", "sub_3310"), region: "Greater Accra", card: { badge: "Pending", badge_tone: "medium", note: "Efua · due tmrw" } },
  { id: "FD-2998", title: "Mule wallet · Kasoa", fraud_type: "agent_cash_out", stage: "monitor", status: "closed", risk_score: 90, alerts: 7, sla_due_at: null, waiting_since: "2026-10-01T10:00:00Z", money_at_stake: GHS(9800), assignee: AMA, subscriber: sub("024 *** 8812", "Mule wallet", "wal_8812"), region: "Central", card: { badge: "Watching", badge_tone: "info", note: "61 days left" } },
  { id: "FD-2971", title: "Insider · SIM swaps", fraud_type: "sim_swap_to_momo", stage: "monitor", status: "closed", risk_score: 86, alerts: 12, sla_due_at: null, waiting_since: "2026-09-02T10:00:00Z", money_at_stake: GHS(3400), assignee: EO, subscriber: sub("Staff account", "Staff account", "usr_440912"), region: "Ashanti", card: { badge: "Watching", badge_tone: "info", note: "12 days left" } },
  { id: "FD-3021", title: "Velocity · false positive", fraud_type: "momo_velocity", stage: "closed", status: "closed", risk_score: 41, alerts: 1, sla_due_at: null, waiting_since: "2026-10-19T10:00:00Z", money_at_stake: GHS(0), assignee: KB, subscriber: sub("+233 24 *** 2201", "Kwabena A.", "sub_2201"), region: "Ashanti", card: { badge: "Closed", badge_tone: "success", note: "Mon" } },
  { id: "FD-3018", title: "SIM swap to MoMo", fraud_type: "sim_swap_to_momo", stage: "closed", status: "closed", risk_score: 93, alerts: 2, sla_due_at: null, waiting_since: "2026-10-19T09:00:00Z", money_at_stake: GHS(2100), assignee: AMA, subscriber: sub("+233 20 *** 9981", "Yaa P.", "sub_9981"), region: "Greater Accra", card: { badge: "Closed", badge_tone: "success", note: "Mon" } },
];

const picked = new Set<string>();
const assigneeOf = (r: Row) => (picked.has(r.id) ? AMA : r.assignee);
const statusOf = (r: Row) => (picked.has(r.id) && r.status === "new" ? "investigating" : r.status);
const shape = (r: Row) => ({ ...r, assignee: assigneeOf(r), status: statusOf(r) });

/** PROPOSED: prospects (PR-…) live on the board before they’re cases. */
export const PROSPECTS = [
  { id: "PR-014", title: "Kasoa agents with 5+ SIM swaps a day", hunch: "Kasoa agents doing far more SIM swaps than usual", owner: AMA, started_at: "2026-10-18T09:00:00Z", rule: "SIM swaps per day > 5, Kasoa, last 14 days", note: "3 agents found", look_at: "agents" },
  { id: "PR-012", title: "New wallets paid by FD-2998 mule", hunch: "New wallets paid by FD-2998 mule", owner: KB, started_at: "2026-10-18T10:00:00Z", rule: "Paid by wal_8812, opened < 30 days", note: "opened 2 d", look_at: "wallets" },
];

const STAGE_TEXT: Record<string, string> = {
  prospect: "A hunch, no alert yet. Hunt before it becomes a loss.",
  investigate: "Gathering evidence and protecting money.",
  decide: "Waiting on supervisor sign-off.",
  monitor: "Closed, but we watch for a repeat for 30-90 days.",
  closed: "This week. Outcome final.",
};

/** PROPOSED: saved views (G4/G5). */
const views: Array<{ id: string; name: string; owner: string; filters: Record<string, unknown> }> = [
  { id: "v_mine_1", name: "Critical & high · Greater Accra", owner: "me", filters: { risk: ["critical", "high"], region: ["Greater Accra"], status: ["open"] } },
  { id: "v_mine_2", name: "SIM swaps this week", owner: "me", filters: { fraud_type: ["sim_swap_to_momo"], since: "7d" } },
  { id: "v_team_1", name: "Escalated: waiting on supervisor", owner: "team", filters: { status: ["escalated"] } },
  { id: "v_team_2", name: "Breached SLA", owner: "team", filters: { sla: ["breached"] } },
];

const RISK_BAND: Record<string, [number, number]> = { critical: [90, 101], high: [70, 90], medium: [40, 70], low: [0, 40] };

function list(search: URLSearchParams): Fixture {
  if (search.get("demo") === "error") {
    return { status: 503, body: { status: 503, code: "upstream_unavailable", title: "Case service unavailable", request_id: "CASE-503-1F2" } };
  }
  const view = search.get("view") ?? "all";
  const q = (search.get("q") ?? "").toLowerCase().replace(/\s+/g, "");
  const statuses = search.get("status")?.split(",").filter(Boolean) ?? [];
  const risks = search.get("risk")?.split(",").filter(Boolean) ?? [];
  const regions = search.get("region")?.split(",").filter(Boolean) ?? [];

  const scoped = ROWS.filter((r) => r.stage !== "monitor" && !(r.stage === "closed" && view !== "all")).filter((r) => {
    const a = assigneeOf(r);
    if (view === "mine") return a?.id === AMA.id && statusOf(r) !== "closed";
    if (view === "team") return !a;
    return true;
  });
  const matches = scoped.filter((r) => {
    const s = statusOf(r);
    if (statuses.length && !statuses.some((x) => (x === "open" ? s !== "closed" : x === s))) return false;
    if (risks.length && !risks.some((b) => r.risk_score >= RISK_BAND[b][0] && r.risk_score < RISK_BAND[b][1])) return false;
    if (regions.length && !regions.includes(r.region)) return false;
    if (q && !`${r.id}${r.subscriber.msisdn}${r.subscriber.name}${r.title}`.toLowerCase().replace(/\s+/g, "").includes(q)) return false;
    return true;
  });
  const byStatus = Object.fromEntries(
    ["new", "investigating", "escalated", "sent_back", "pending_decision", "closed"].map((s) => [s, scoped.filter((r) => statusOf(r) === s).length]),
  );
  const mine = ROWS.filter((r) => assigneeOf(r)?.id === AMA.id && statusOf(r) !== "closed" && r.stage !== "monitor").length;
  const team = ROWS.filter((r) => !assigneeOf(r)).length;
  return {
    status: 200,
    body: {
      data: matches.map(shape),
      next_cursor: null,
      // Proposed: counts for the scope switch and status tabs.
      counts: { mine, team, all: 128, by_status: { ...byStatus, closed: view === "mine" ? 48 : byStatus.closed } },
      closed_this_month: 48,
      capacity: { open_cases: mine, limit: 9 },
    },
  };
}

function board(): Fixture {
  const stages = ["prospect", "investigate", "decide", "monitor", "closed"];
  const totals: Record<string, number> = { prospect: 3, investigate: 12, decide: 4, monitor: 9, closed: 14 };
  return {
    status: 200,
    body: {
      stages: stages.map((s) => ({
        id: s,
        description: STAGE_TEXT[s],
        total: totals[s],
        cards:
          s === "prospect"
            ? PROSPECTS.map((p) => ({ id: p.id, title: p.title, kind: "prospect", badge: "Hunch", badge_tone: "neutral", owner: p.owner, money: null, note: p.note }))
            : ROWS.filter((r) => (r.stage === "act" ? "investigate" : r.stage) === s && !(s === "investigate" && statusOf(r) === "new"))
                .slice(0, 3)
                .map((r) => ({
                  id: r.id,
                  title: r.title,
                  kind: "case",
                  risk_score: r.risk_score,
                  badge: r.card?.badge ?? String(r.risk_score),
                  badge_tone: r.card?.badge_tone ?? (r.risk_score >= 90 ? "critical" : "high"),
                  owner: assigneeOf(r),
                  money: r.money_at_stake.amount_minor ? r.money_at_stake : null,
                  note: r.card?.note ?? (r.sla_due_at ? `SLA ${Math.max(1, Math.round((Date.parse(r.sla_due_at) - clock()) / 3_600_000))}${Date.parse(r.sla_due_at) - clock() > 86_400_000 ? "d" : "h"}` : ""),
                })),
      })),
    },
  };
}

/** PROPOSED: GET /prospects/{id} — the hunch, the rule and what matches it now (G12). */
function prospect(id: string): Fixture {
  const p = PROSPECTS.find((x) => x.id === id);
  if (!p) return { status: 404, body: { status: 404, code: "not_found", title: "Prospect not found" } };
  const days = (base: number[], spike?: number) => base.map((n, i) => ({ date: new Date(clock() - (13 - i) * 86_400_000).toISOString().slice(0, 10), count: i === 13 && spike ? spike : n }));
  return {
    status: 200,
    body: {
      ...p,
      matches: [
        { id: "KS-0917", name: "Kasoa Market", since: "agent since 2021", today: 14, by_day: days([2, 3, 2, 4, 3, 6, 7, 9, 10, 11, 9, 12, 13, 14]), summary: "14 swaps today · and it cashed out FD-3050 money", tone: "critical", tags: [["Linked to FD-3050", "critical"], ["2 confirmed mules paid", "high"]] },
        { id: "KS-1120", name: "Kasoa Old Barrier", since: "", today: 7, by_day: days([4, 5, 4, 5, 6, 6, 6, 7, 6, 7, 6, 7, 6, 7]), summary: "7 swaps today · steady rise, no fraud links yet", tone: "neutral", tags: [["No links", "neutral"]] },
        { id: "KS-0544", name: "Kasoa New Market", since: "", today: 6, by_day: days([2, 3, 2, 3, 3, 4, 3, 9, 3, 2, 3, 2, 2, 6]), summary: "6 today · one spike on 14 Oct (a promo day)", tone: "neutral", tags: [["Likely promo", "neutral"]] },
      ],
      normal_max: 3,
      verdict: { id: "KS-0917", title: "KS-0917 is worth a case", detail: "Its SIM swaps tripled in a week, and money from FD-3050 was cashed out here. Promote it to start a proper investigation." },
    },
  };
}

let nextCaseId = 3072;

export function mockCaseListFixture(method: string, path: string, body: Record<string, unknown> | null, search: URLSearchParams): Fixture | undefined {
  if (method === "GET" && path === "cases") return search.get("group_by") === "stage" ? board() : list(search);
  if (method === "POST" && path === "cases/pick-up") {
    const ids = (body?.case_ids as string[]) ?? [];
    const open = ROWS.filter((r) => assigneeOf(r)?.id === AMA.id && statusOf(r) !== "closed" && r.stage !== "monitor").length;
    const room = Math.max(0, 9 - open);
    if (ids.length > room) {
      return { status: 409, body: { status: 409, code: "capacity_exceeded", title: "Pick-up limit reached", detail: `You have ${open} open cases and room for ${room} more.`, open_cases: open, room } };
    }
    ids.forEach((id) => picked.add(id));
    return { status: 200, body: { assigned: ids, open_cases: open + ids.length, room: room - ids.length } };
  }
  // POST /cases — a case opened by hand (G10) or promoted from a prospect (G13).
  if (method === "POST" && path === "cases") {
    const id = `FD-${nextCaseId++}`;
    return { status: 201, body: { id, stage: "investigate", status: "investigating", assignee: AMA } };
  }
  if (method === "GET" && path === "views") return { status: 200, body: { data: views } };
  if (method === "POST" && path === "views") {
    const v = { id: `v_${Date.now()}`, name: String(body?.name), owner: body?.shared ? "team" : "me", filters: (body?.filters as Record<string, unknown>) ?? {} };
    views.unshift(v);
    return { status: 201, body: v };
  }
  if (method === "POST" && path === "prospects") return { status: 201, body: { ...PROSPECTS[0], id: "PR-014", hunch: body?.hunch ?? PROSPECTS[0].hunch } };
  // PROPOSED: GET /prospects/preview — how many match the rule right now (G11).
  if (method === "GET" && path === "prospects/preview") return { status: 200, body: { matches: 3, look_at: search.get("look_at") ?? "agents" } };
  const pr = path.match(/^prospects\/([^/]+)(?:\/(promote|drop))?$/);
  if (pr && method === "GET" && !pr[2]) return prospect(pr[1]);
  if (pr && method === "POST" && pr[2] === "promote") {
    const id = `FD-${nextCaseId++}`;
    return { status: 201, body: { case_id: id, brought_across: ["Your hunch and rule", "14-day swap chart as evidence", "Link to FD-3050 (cash-out of stolen money)"], remaining: 2 } };
  }
  if (pr && method === "POST" && pr[2] === "drop") return { status: 204, body: null };
  // PROPOSED: GET /watchlist — richer rows for the Monitoring page (F2/F3).
  if (method === "GET" && path === "watchlist") {
    return {
      status: 200,
      body: {
        data: [
          { case_id: "FD-2998", title: "Mule wallet · Kasoa", entities_summary: "4 wallets · 1 agent", days_left: 61, days_total: 90, status: search.get("repeat") === "1" ? "reopened" : "quiet", near_misses: 0, reopened_at: "2026-10-20T08:41:00Z", repeat_detail: "Mule wallet 024 *** 8812 received GHS 4,200 from a new victim (FD-3050). The case is back in Investigate and assigned to you." },
          { case_id: "FD-2971", title: "Insider · SIM swaps", entities_summary: "1 staff account · 12 SIMs", days_left: 12, days_total: 60, status: "quiet", near_misses: 0 },
          { case_id: "FD-2960", title: "Wangiri burst · Accra", entities_summary: "3 premium numbers", days_left: 44, days_total: 60, status: "quiet", near_misses: 0 },
          { case_id: "FD-2952", title: "SIM box · Ashaiman", entities_summary: "2 cells · 1 IMEI", days_left: 20, days_total: 30, status: "quiet", near_misses: 0 },
          { case_id: "FD-2940", title: "Agent cash-out · Tamale", entities_summary: "Agent TM-0221", days_left: 77, days_total: 90, status: "quiet", near_misses: 0 },
          { case_id: "FD-2933", title: "SIM swap to MoMo", entities_summary: "1 wallet · 1 SIM", days_left: 3, days_total: 30, status: "near_miss", near_misses: 2 },
        ],
        totals: { cases: 9, watched: 23 },
        next_cursor: null,
      },
    };
  }
  return undefined;
}

export function findRow(id: string) {
  const r = ROWS.find((x) => x.id === id);
  return r ? shape(r) : undefined;
}
