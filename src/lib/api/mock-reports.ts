import "server-only";

/**
 * Reports (FD_API_MOCK=1 only). GET/POST /reports and GET /reports/{id}/download
 * are in the collection; preview, share, schedule control and retry are proposed.
 */

type Fixture = { status: number; body: unknown };
type Report = {
  id: string;
  name: string;
  template: string;
  template_label: string;
  schedule: string | null;
  next_run_at: string | null;
  status: "ready" | "building" | "failed";
  progress_pct?: number;
  last_run_at: string;
  format: "PDF" | "CSV" | "XLSX";
  shared_with: string[];
  owner: "me" | "other";
  paused?: boolean;
  error?: { title: string; detail: string; suggest_format: string };
  polls?: number;
};

const TEMPLATE_LABEL: Record<string, string> = { case_list: "Case list", fraud_summary: "Summary", fraud_type: "Fraud type", regulator_return: "Regulatory", rule_performance: "Rules" };

const seed = (): Report[] => [
  { id: "rp_weekly", name: "Weekly fraud summary · Kasa Mobile", template: "fraud_summary", template_label: "Summary", schedule: "Every Mon 07:00", next_run_at: "2026-10-26T07:00:00Z", status: "ready", last_run_at: "2026-10-20T07:02:00Z", format: "PDF", shared_with: ["Efua O.-A.", "+3"], owner: "me" },
  { id: "rp_closed_oct", name: "My closed cases · October", template: "case_list", template_label: "Case list", schedule: null, next_run_at: null, status: "ready", last_run_at: "2026-10-20T09:12:00Z", format: "CSV", shared_with: [], owner: "me" },
  { id: "rp_ashanti", name: "SIM swap to MoMo · Ashanti · 30d", template: "fraud_type", template_label: "Fraud type", schedule: null, next_run_at: null, status: "ready", last_run_at: "2026-10-19T15:00:00Z", format: "PDF", shared_with: [], owner: "me" },
  { id: "rp_bog", name: "BoG monthly regulator return", template: "regulator_return", template_label: "Regulatory", schedule: "1st of month", next_run_at: "2026-11-01T06:00:00Z", status: "ready", last_run_at: "2026-10-01T06:00:00Z", format: "XLSX", shared_with: ["Compliance"], owner: "other" },
  { id: "rp_fp_q3", name: "False positives by rule · Q3", template: "rule_performance", template_label: "Rules", schedule: null, next_run_at: null, status: "ready", last_run_at: "2026-09-30T10:00:00Z", format: "CSV", shared_with: ["Rules team"], owner: "other" },
];
const SCHEDULED_EXTRA: Report[] = [
  { id: "rp_sla", name: "My SLA week", template: "case_list", template_label: "Case list", schedule: "Every Fri 17:00", next_run_at: "2026-10-23T17:00:00Z", status: "ready", last_run_at: "2026-10-16T17:00:00Z", format: "PDF", shared_with: [], owner: "me" },
  { id: "rp_ashanti_m", name: "SIM swap · Ashanti", template: "fraud_type", template_label: "Fraud type", schedule: "1st of month", next_run_at: null, status: "ready", last_run_at: "2026-10-01T06:00:00Z", format: "PDF", shared_with: [], owner: "me", paused: true },
];

let reports = seed();
let counter = 100;

/** Who can be sent case data — Esi (marketing) can’t (H14). */
const PEOPLE = [
  { id: "usr_efua", name: "Efua Owusu-Ansah", initials: "EO", role: "Supervisor", can_view_cases: true },
  { id: "usr_kofi", name: "Kofi Boateng", initials: "KB", role: "Same team", can_view_cases: true },
  { id: "usr_kwame", name: "Kwame Asante", initials: "KA", role: "Head of Fraud", can_view_cases: true },
  { id: "usr_esi", name: "Esi Ampofo", initials: "EA", role: "Marketing", can_view_cases: false },
];

const PREVIEW = {
  kpis: [
    ["Cases", "31", "23 closed · 8 open", null],
    ["Confirmed fraud", "17", "GHS 112,900 lost", null],
    ["False positive", "6", "19% of closed", null],
    ["Recovered", "GHS 48,300", "43% of loss", "success"],
  ],
  columns: 14,
  rows: [
    { case_id: "FD-3050", type: "SIM swap to MoMo", status: "closed", outcome: "confirmed_fraud", loss: 18400, closed: "20 Oct" },
    { case_id: "FD-3047", type: "SIM swap to MoMo", status: "investigating", outcome: null, loss: 9200, closed: null },
    { case_id: "FD-3036", type: "Account takeover", status: "closed", outcome: "false_positive", loss: 0, closed: "20 Oct" },
    { case_id: "FD-3029", type: "Agent fraud", status: "closed", outcome: "confirmed_fraud", loss: 4750, closed: "18 Oct" },
    { case_id: "FD-3021", type: "Wangiri", status: "closed", outcome: "inconclusive", loss: 0, closed: "16 Oct" },
    { case_id: "FD-3012", type: "Device farm", status: "investigating", outcome: null, loss: 22100, closed: null },
  ],
  total_rows: 31,
};

const shape = (r: Report) => {
  // A new report generates over a couple of looks (H10), then it’s ready.
  if (r.status === "building") {
    r.polls = (r.polls ?? 0) + 1;
    if (r.polls > 3) {
      r.status = "ready";
      delete r.progress_pct;
    } else r.progress_pct = 62 + (r.polls - 1) * 15;
  }
  const { polls: _p, ...rest } = r;
  return rest;
};

export function mockReportsFixture(method: string, path: string, body: Record<string, unknown> | null, search: URLSearchParams): Fixture | undefined {
  if (method === "GET" && path === "reports") {
    if (search.get("demo") === "empty") return { status: 200, body: { data: [], counts: { all: 0, scheduled: 0, shared: 0 } } };
    if (search.get("demo") === "reset") reports = seed();
    const tab = search.get("tab") ?? "all";
    const q = (search.get("q") ?? "").toLowerCase();
    let list: Report[] = reports;
    if (search.get("demo") === "failed" && !reports.some((r) => r.id === "rp_all_2026")) {
      reports.unshift({
        id: "rp_all_2026",
        name: "Kasa Mobile · all cases · 2026",
        template: "case_list",
        template_label: "Case list",
        schedule: null,
        next_run_at: null,
        status: "failed",
        last_run_at: "2026-10-20T09:52:00Z",
        format: "XLSX",
        shared_with: [],
        owner: "me",
        error: { title: "“Kasa Mobile · all cases · 2026” couldn’t be generated", detail: "It has 48,210 rows. Over the 25,000-row limit for Excel. Retry as CSV (no limit), or narrow the date range.", suggest_format: "CSV" },
      });
    }
    if (tab === "scheduled") list = [...reports.filter((r) => r.schedule && r.owner === "me"), ...SCHEDULED_EXTRA].filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i);
    if (tab === "shared") list = reports.filter((r) => r.owner === "other").concat(reports.filter((r) => r.id === "rp_weekly"));
    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q));
    return { status: 200, body: { data: list.map(shape), counts: { all: reports.filter((r) => r.status !== "failed").length, scheduled: 3, shared: 3 } } };
  }
  if (method === "POST" && path === "reports") {
    const from = String((body?.filters as Record<string, unknown>)?.from ?? "");
    const to = String((body?.filters as Record<string, unknown>)?.to ?? "");
    if (from && to && to < from) {
      return { status: 422, body: { status: 422, code: "validation_failed", title: "Check the dates", errors: [{ field: "filters.to", message: "End date is before the start date." }] } };
    }
    const r: Report = {
      id: `rp_${counter++}`,
      name: String(body?.name ?? "My cases · 1-20 Oct"),
      template: String(body?.template ?? "case_list"),
      template_label: TEMPLATE_LABEL[String(body?.template)] ?? "Case list",
      schedule: (body?.schedule as string) ?? null,
      next_run_at: body?.schedule ? "2026-10-26T07:00:00Z" : null,
      status: body?.schedule ? "ready" : "building",
      progress_pct: body?.schedule ? undefined : 62,
      last_run_at: "2026-10-20T09:48:00Z",
      format: String(body?.format ?? "csv").toUpperCase() as Report["format"],
      shared_with: [],
      owner: "me",
    };
    reports.unshift(r);
    return { status: 201, body: r };
  }
  const m = path.match(/^reports\/([^/]+)(?:\/(download|share|schedule|run|retry))?$/);
  if (!m) return path === "people/report-recipients" && method === "GET" ? { status: 200, body: { data: PEOPLE } } : undefined;
  const r = reports.find((x) => x.id === m[1]) ?? SCHEDULED_EXTRA.find((x) => x.id === m[1]);
  if (!r) return { status: 404, body: { status: 404, code: "not_found", title: "Report not found" } };
  if (method === "GET" && !m[2]) {
    return { status: 200, body: { ...shape(r), generated_by: "Ama Mensah", generated_at: "2026-10-20T09:49:00Z", expires_at: "2027-01-18", rows: 31, preview: PREVIEW } };
  }
  if (method === "GET" && m[2] === "download") return { status: 200, body: { url: `/api/fd/reports/${r.id}/file`, expires_at: "2026-10-20T10:49:00Z" } };
  if (method === "POST" && m[2] === "share") {
    const ids = (body?.user_ids as string[]) ?? [];
    const blocked = PEOPLE.filter((p) => ids.includes(p.id) && !p.can_view_cases);
    if (blocked.length) {
      return { status: 422, body: { status: 422, code: "recipient_cannot_view", title: "Some people can’t see case data", errors: blocked.map((p) => ({ field: p.id, message: `${p.name} can’t see case data.` })) } };
    }
    r.shared_with = PEOPLE.filter((p) => ids.includes(p.id)).map((p) => p.name.split(" ")[0]);
    return { status: 200, body: { shared_with: ids.length, expires_at: body?.expires } };
  }
  if (method === "PATCH" && m[2] === "schedule") {
    r.paused = Boolean(body?.paused);
    return { status: 200, body: shape(r) };
  }
  if (method === "POST" && m[2] === "run") {
    r.status = "building";
    r.polls = 0;
    return { status: 202, body: shape(r) };
  }
  if (method === "POST" && m[2] === "retry") {
    r.format = String(body?.format ?? r.format).toUpperCase() as Report["format"];
    r.status = "building";
    r.polls = 0;
    delete r.error;
    return { status: 202, body: shape(r) };
  }
  if (method === "DELETE" && !m[2]) {
    reports = reports.filter((x) => x.id !== r.id);
    return { status: 204, body: null };
  }
  return undefined;
}
