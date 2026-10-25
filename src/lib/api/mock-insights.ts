import "server-only";

/**
 * Overview (FD_API_MOCK=1 only). GET /insights/overview and /insights/sla are
 * in the collection; the week view’s KPIs, the daily series, rule precision
 * and per-widget errors are proposed additions.
 */

type Fixture = { status: number; body: unknown };

const TODAY = {
  period: "today",
  updated_at: "2026-10-20T09:27:56Z",
  kpis: [
    { key: "alerts_today", label: "Alerts today", value: 128, unit: "count", sub: "23 open · 9 critical", tone: "high", spark: [6, 8, 7, 9, 8, 10, 9, 11, 10, 12, 11, 14] },
    { key: "money_protected", label: "Money protected", value: 41200, unit: "GHS", sub: "frozen or recovered today", tone: "success", spark: [1, 2, 2, 3, 3, 4, 3, 4, 3] },
    { key: "confirmed_fraud", label: "Confirmed fraud", value: 9, unit: "cases", sub: "cases closed as fraud", tone: "critical", spark: [1, 2, 1, 2, 3, 2, 3, 2, 3, 2, 4] },
    { key: "response_time", label: "Response time", value: 6, unit: "min", sub: "median, alert to picked up", tone: "neutral", spark: [8, 8, 7, 7, 6, 7, 6, 6, 6, 5, 6] },
  ],
  right_now: [
    { id: "AL-88240", at: "2026-10-20T10:12:00Z", title: "SIM swap to MoMo", where: "Obuasi · +233 24 *** 1290", money: 9200, risk: 97 },
    { id: "AL-88236", at: "2026-10-20T10:09:00Z", title: "MoMo PIN reset after swap", where: "Takoradi", money: 4100, risk: 91 },
    { id: "AL-88233", at: "2026-10-20T10:04:00Z", title: "MoMo velocity spike", where: "Kumasi", money: 7350, risk: 88 },
    { id: "AL-88229", at: "2026-10-20T09:58:00Z", title: "SIM-box call pattern", where: "Tema", money: null, risk: 84 },
    { id: "AL-88224", at: "2026-10-20T09:51:00Z", title: "Wangiri missed-call burst", where: "Accra", money: null, risk: 62 },
  ],
  open_alerts: 23,
  fraud_mix: [
    { fraud_type: "sim_swap_to_momo", label: "SIM swap to MoMo", share_pct: 46 },
    { fraud_type: "sim_box_bypass", label: "SIM box", share_pct: 21 },
    { fraud_type: "agent_cash_out", label: "Agent cash-out", share_pct: 14 },
    { fraud_type: "wangiri", label: "Wangiri / IRSF", share_pct: 11 },
    { fraud_type: "other", label: "Other", share_pct: 8 },
  ],
  hotspots: [
    { area: "Kumasi", alerts: 38 },
    { area: "Accra", alerts: 31 },
    { area: "Kasoa", alerts: 17 },
    { area: "Tema", alerts: 12 },
    { area: "Takoradi", alerts: 9 },
  ],
};

const WEEK = {
  period: "7d",
  kpis: [
    { key: "cases_closed", label: "Cases closed", value: "23", sub: "▲ 5 vs last week", tone: "success", icon: "check" },
    { key: "time_to_close", label: "Median time to close", value: "2h 41m", sub: "▼ 18 min · faster", tone: "success", icon: "timer" },
    { key: "fp_rate", label: "False-positive rate", value: "31%", sub: "▲ 4 pts · R-118 noisy", tone: "medium", icon: "filter" },
    { key: "recovered", label: "Recovered", value: "GHS 48,300", sub: "of GHS 112,900 lost · 43%", tone: "neutral", icon: "wallet" },
  ],
  daily: [
    { day: "Wed", alerts: 38, cases: 9 },
    { day: "Thu", alerts: 35, cases: 7 },
    { day: "Fri", alerts: 48, cases: 11 },
    { day: "Sat", alerts: 27, cases: 6 },
    { day: "Sun", alerts: 22, cases: 4 },
    { day: "Mon", alerts: 41, cases: 10 },
    { day: "Today", alerts: 52, cases: 13 },
  ],
  fraud_mix: [
    { fraud_type: "sim_swap_to_momo", label: "SIM swap to MoMo", share_pct: 46 },
    { fraud_type: "wallet_takeover", label: "Wallet takeover", share_pct: 21 },
    { fraud_type: "agent_fraud", label: "Agent fraud", share_pct: 14 },
    { fraud_type: "wangiri", label: "Wangiri / IRSF", share_pct: 11 },
    { fraud_type: "other", label: "Other", share_pct: 8 },
  ],
  rules: [
    { id: "R-104", catches: "SIM swap + high-value MoMo in 24h", hits: 212, precision: 91, note: null },
    { id: "R-211", catches: "Transfer velocity", hits: 388, precision: 64, note: null },
    { id: "R-118", catches: "New device on wallet", hits: 540, precision: 22, note: "12 of your FP feedback" },
    { id: "R-402", catches: "Paid a wallet in a confirmed ring", hits: 61, precision: 97, note: null },
  ],
};

const SLA = {
  first_response_within_sla_pct: 96,
  first_response_detail: "46 of 48",
  critical_closed_within_4h_pct: 88,
  critical_closed_detail: "7 of 8",
  sent_back: 2,
  sent_back_cases: ["FD-3050", "FD-3029"],
};

export function mockInsightsFixture(method: string, path: string, search: URLSearchParams): Fixture | undefined {
  if (method !== "GET") return undefined;
  if (path === "insights/overview") {
    const period = search.get("period") ?? "today";
    const scope = search.get("scope") ?? "org";
    if (period === "today") {
      const failed = search.get("demo") === "widget-error";
      return {
        status: 200,
        body: {
          ...TODAY,
          scope,
          hotspots: failed ? null : TODAY.hotspots,
          // Proposed: one widget can fail without failing the page (H3).
          widget_errors: failed ? { hotspots: { code: "upstream_timeout", title: "Couldn’t load hotspots", detail: "The location service timed out. Other widgets are fine." } } : {},
        },
      };
    }
    const k = scope === "team" ? 3.4 : scope === "org" ? 9.1 : 1;
    return {
      status: 200,
      body: {
        ...WEEK,
        period,
        scope,
        kpis: scope === "me" ? WEEK.kpis : WEEK.kpis.map((x) => (x.key === "cases_closed" ? { ...x, value: String(Math.round(23 * k)) } : x)),
        daily: WEEK.daily.map((d) => ({ ...d, alerts: Math.round(d.alerts * k), cases: Math.round(d.cases * k) })),
      },
    };
  }
  if (path === "insights/sla") return { status: 200, body: SLA };
  return undefined;
}
