import "server-only";

/**
 * Demo data the Postman mock can’t serve (FD_API_MOCK=1 only). API 0.2’s
 * collection has real examples for the analyst screens, so this only answers
 * states it has no example for. Nothing here runs against the real API.
 *
 *   GET /cases?demo=error           → 503, case service down (G9)
 *   GET /cases/FD-9999              → 404 case_not_found (I17)
 *   GET /cases/FD-2864              → 403 case_restricted (I16; its access request is in the collection)
 *   GET /cases/FD-5000              → 500 internal (I18)
 *   GET /audit/events?object=sub_…  → a subscriber’s audit trail; the collection’s
 *                                     example is still a generated Auditor placeholder
 *   GET /alerts/stream              → the 0.1 collection’s SSE example; 0.2 saved none
 */

type Body = Record<string, unknown> | null;
type Fixture = { status: number; body: unknown };

const CASE_PROBLEMS: Record<string, Fixture> = {
  "FD-9999": { status: 404, body: { status: 404, code: "case_not_found", title: "Case not found", request_id: "req_7Qm2xK" } },
  "FD-2864": {
    status: 403,
    body: {
      status: 403,
      code: "case_restricted",
      title: "This case is restricted",
      detail: "This case is restricted to the Internal Investigations team at MTN Ghana. Ask for access and Efua Owusu-Ansah (your supervisor) will be notified.",
      request_id: "req_7Qm2xK",
    },
  },
  "FD-5000": { status: 500, body: { status: 500, code: "internal", title: "Something went wrong", request_id: "ERR-5F2C-0942" } },
};

const ama = { id: "usr_ama", name: "Ama Mensah", initials: "AM" };
const SUBSCRIBER_AUDIT = {
  next_cursor: null,
  data: [
    { id: "au3", at: "2026-10-20T09:41:00Z", actor: ama, action: "wallet.frozen", object: "sub_8KQ2", reason: "FD-3050" },
    { id: "au2", at: "2026-10-20T09:33:00Z", actor: ama, action: "pii.revealed", object: "sub_8KQ2", reason: "Investigating FD-3050" },
    { id: "au1", at: "2026-10-20T09:31:00Z", actor: ama, action: "profile.viewed", object: "sub_8KQ2", reason: "FD-3050" },
  ],
};

export function mockFixture(method: string, path: string, _body: Body, search: URLSearchParams): Fixture | undefined {
  if (method !== "GET") return undefined;
  if (path === "cases" && search.get("demo") === "error") {
    return { status: 503, body: { status: 503, code: "upstream_unavailable", title: "Case service unavailable", request_id: "CASE-503-1F2" } };
  }
  const caseId = path.match(/^cases\/([^/]+)$/)?.[1];
  if (caseId && CASE_PROBLEMS[caseId]) return CASE_PROBLEMS[caseId];
  if (path === "audit/events" && search.get("object")?.startsWith("sub_")) return { status: 200, body: SUBSCRIBER_AUDIT };
  return undefined;
}

/** Events the live alert stream sends on connect (server-sent event text). */
export function mockAlertStream(method: string, path: string): string | undefined {
  if (method !== "GET" || path !== "alerts/stream") return undefined;
  return 'id: 88213\nevent: alert.created\ndata: {"id":"AL-88213","severity":"critical","risk_score":97,"status":"auto_case","case_id":"FD-3050"}\n\n';
}
