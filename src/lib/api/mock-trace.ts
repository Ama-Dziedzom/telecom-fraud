import "server-only";

/**
 * Terminating number trace (FD_API_MOCK=1 only) — all proposed:
 * POST /traces {subscriber_id, period} starts one, GET /traces/{id} polls it.
 */

type Fixture = { status: number; body: unknown };

const polls = new Map<string, number>();

const READY = {
  status: "ready",
  verdict: {
    kind: "sim_box",
    title: "Looks like a SIM box",
    detail: "International calls arrive, then leave through this local SIM to 860 different numbers. It never moves and nobody calls it back. That dodges international call fees.",
  },
  flow: {
    in: [
      { id: "international", label: "International route", detail: "1,180 calls in", calls: 1180, tone: "high", icon: "globe" },
      { id: "local", label: "Local numbers", detail: "60 calls in", calls: 60, tone: "neutral", icon: "phone" },
    ],
    sim: { label: "This SIM", detail: "1,240 calls out · 1 cell" },
    out: [
      { id: "kasa", label: "Kasa Mobile numbers", detail: "612 numbers · 905 calls", calls: 905, icon: "phone" },
      { id: "volta", label: "Volta Telecom numbers", detail: "248 numbers · 335 calls", calls: 335, icon: "phone" },
      { id: "callback", label: "Contacts who call back", detail: "0 numbers", calls: 0, icon: "users" },
    ],
  },
  hourly: [52, 55, 50, 51, 53, 50, 54, 52, 50, 55, 52, 53, 52, 50, 54, 53, 55, 50, 52, 51, 52, 50, 52, 53],
  hourly_note: "Flat all day and night: people don’t call like this.",
  signs: [
    { value: "47 s", label: "Average call", tone: "high" },
    { value: "1", label: "Cell it uses", tone: "high" },
    { value: "0", label: "Calls back", tone: "critical" },
    { value: "3 days", label: "SIM age", tone: "high" },
  ],
  case_id: "FD-3061",
  gaps: null as null | { title: string; detail: string; missing_hours: number[] },
};

export function mockTraceFixture(method: string, path: string, search: URLSearchParams): Fixture | undefined {
  const m = path.match(/^traces\/([^/]+)$/);
  if (method === "POST" && path === "traces") return { status: 202, body: { id: "TR-4471", status: "running" } };
  if (method !== "GET" || !m) return undefined;
  const id = m[1];
  const subject = { msisdn: id === "TR-8820" ? "+233 24 *** 8820" : "+233 20 *** 4471", period: search.get("period") ?? "24h" };

  if (id === "TR-8820" && subject.period === "24h") {
    return { status: 200, body: { id, subject, status: "no_calls" } };
  }
  // The first look is still tracing (G36); the next is ready.
  const n = (polls.get(id) ?? 0) + 1;
  polls.set(id, n);
  if (n === 1) {
    return {
      status: 200,
      body: {
        id,
        subject,
        status: "running",
        progress_pct: 62,
        steps: [
          { label: "Fetched call records", detail: "1,300 records from our call records and interconnect feeds", state: "done" },
          { label: "Matching numbers to operators", detail: "806 of 1,300 done", state: "running" },
          { label: "Spotting patterns", detail: "Usually under 20 seconds", state: "waiting" },
        ],
      },
    };
  }
  if (search.get("demo") === "partial") {
    return {
      status: 200,
      body: {
        id,
        subject,
        ...READY,
        flow: { ...READY.flow, out: READY.flow.out.map((o) => (o.id === "volta" ? { ...o, detail: "248+ numbers · 335+ calls" } : o)) },
        gaps: {
          title: "Missing 8 hours of interconnect records",
          detail: "The interconnect feed is delayed since 07:40, so this trace covers 16 of 24 hours. Figures update when the records arrive.",
          missing_hours: [8, 9, 10, 11, 12, 13, 14, 15],
        },
        hourly_note: "Grey hours: interconnect records not in yet. The rest is flat all day and night. People don’t call like this.",
      },
    };
  }
  return { status: 200, body: { id, subject, ...READY } };
}
