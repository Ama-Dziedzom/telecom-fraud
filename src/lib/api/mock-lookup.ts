import "server-only";

/**
 * Subscriber lookup, bulk lookup, inter-operator requests and the watchlist
 * (FD_API_MOCK=1 only). GET /search and GET /watchlist are in the collection;
 * the rest are proposed additions.
 */

type Fixture = { status: number; body: unknown };
const clock = () => Date.parse(process.env.NEXT_PUBLIC_FD_DEMO_NOW ?? "") || Date.now();

const SUBSCRIBERS = [
  { id: "sub_8KQ2", kind: "subscriber", title: "+233 54 *** 3457 Kojo M.", subtitle: "Kumasi, Ashanti · Tier 2 wallet", open_cases: 1, digits: "0543457" },
  { id: "sub_3457p", kind: "subscriber", title: "+233 54 *** 3457 (ported out)", subtitle: "Accra · number recycled", note: "Inactive since Mar 2024", open_cases: 0, digits: "0543457" },
  { id: "sub_3457a", kind: "subscriber", title: "+233 54 1** 3457 Akua S.", subtitle: "Tamale, Northern · Tier 1 wallet", open_cases: 0, digits: "05413457" },
  { id: "sub_1188", kind: "subscriber", title: "+233 24 *** 1188 Abena O.", subtitle: "Ghana Card verified · Tier 3 wallet · 1 closed case (2025)", open_cases: 0, digits: "0241188" },
  { id: "sub_5521", kind: "subscriber", title: "+233 24 *** 5521 Abena K.", subtitle: "Kumasi, Ashanti · Tier 2 wallet", open_cases: 1, digits: "0245521" },
  { id: "dev_4417", kind: "device", title: "IMEI 356938…4417 Tecno Spark 20", subtitle: "Seen with 2 SIMs", open_cases: 1, digits: "3569384417" },
];

/** Network prefixes we don’t own: the no-match state says whose number it probably is. */
const OTHER_NETWORKS: Record<string, string> = { "026": "Volta Telecom", "056": "Volta Telecom", "027": "Volta Telecom", "057": "Volta Telecom" };

const RECENT = [
  { identifier: "+233 54 *** 3457", name: "Kojo M.", type: "phone", subscriber_id: "sub_8KQ2", case_id: "FD-3050", risk_score: 97, at: "2026-10-20T09:31:00Z" },
  { identifier: "+233 24 *** 5521", name: "Abena K.", type: "phone", subscriber_id: "sub_5521", case_id: "FD-3047", risk_score: 88, at: "2026-10-20T08:52:00Z" },
  { identifier: "IMEI 356938…4417", name: "Tecno Spark 20", type: "device", subscriber_id: "dev_4417", case_id: "FD-3012", risk_score: 74, at: "2026-10-19T15:10:00Z" },
  { identifier: "024 *** 8812", name: "Wallet · Yaw D.", type: "wallet", subscriber_id: "wal_8812", case_id: "FD-2998", risk_score: 92, at: "2026-10-19T11:02:00Z" },
  { identifier: "+233 20 *** 7781", name: "Esi A.", type: "phone", subscriber_id: "sub_7781", case_id: null, risk_score: 31, at: "2026-10-19T09:00:00Z" },
];

const WATCH = [
  { id: "w_9910", identifier: "+233 54 *** 9910", detail: "Reopened FD-2871 · 30-day watch", status: "watching" },
  { id: "w_2231", identifier: "AG-2231", detail: "Agent · 3 SIM swaps today", status: "active" },
  { id: "w_2093", identifier: "055 *** 2093", detail: "Mule wallet · FD-2998", status: "watching" },
];

const BULK_ROWS = [
  ["+233 55 *** 5678", "GHA-71…-2", "Aug 2026", 1900, 81, true],
  ["+233 55 *** 5679", "GHA-71…-2", "Aug 2026", 1850, 80, true],
  ["+233 55 *** 5684", "GHA-71…-2", "Aug 2026", 1720, 79, true],
  ["+233 55 *** 5701", "GHA-88…-9", "Aug 2026", 1640, 77, true],
  ["+233 55 *** 5702", "GHA-88…-9", "Aug 2026", 1600, 77, true],
  ["+233 55 *** 5710", "GHA-88…-9", "Aug 2026", 1410, 74, true],
  ["+233 24 *** 0021", "GHA-30…-1", "2019", 12, 8, false],
] as const;

let recentCleared = false;

export function mockLookupFixture(method: string, path: string, body: Record<string, unknown> | null, search: URLSearchParams): Fixture | undefined {
  if (method === "GET" && path === "search") {
    const q = search.get("q") ?? "";
    const digits = q.replace(/\D/g, "").replace(/^233/, "0");
    if (!digits && !/^gha|^ag-|^ks-/i.test(q)) return { status: 200, body: { data: [], detected_type: "unknown" } };
    const data = SUBSCRIBERS.filter((s) => {
      // Masked numbers keep their first 3 and last 4 digits.
      const head = digits.slice(0, 3);
      const tail = digits.slice(-4);
      return s.digits.startsWith(head) && s.digits.endsWith(tail);
    }).map(({ digits: _d, ...s }) => s);
    const detected = /^\d{15}$/.test(digits) || q.toUpperCase().startsWith("IMEI") ? "imei" : /^gha/i.test(q) ? "ghana_card" : "msisdn";
    // Proposed: which operator a number we don’t own probably belongs to.
    const other = OTHER_NETWORKS[digits.slice(0, 3)];
    return { status: 200, body: { data, detected_type: detected, other_operator: data.length ? null : (other ?? null) } };
  }
  if (method === "GET" && path === "lookups/recent") return { status: 200, body: { data: recentCleared ? [] : RECENT } };
  if (method === "DELETE" && path === "lookups/recent") {
    recentCleared = true;
    return { status: 204, body: null };
  }
  if (method === "GET" && path === "watchlist/mine") return { status: 200, body: { data: WATCH } };
  if (method === "POST" && path === "watchlist") {
    const ids = (body?.entity_ids as string[]) ?? [];
    return { status: 201, body: { added: ids.length, until: new Date(clock() + Number(body?.days ?? 30) * 86_400_000).toISOString().slice(0, 10) } };
  }
  if (method === "POST" && path === "lookups/bulk") {
    return { status: 201, body: { id: "BL-0412", rows: 42, valid: 40, skipped: 2 } };
  }
  if (method === "GET" && path.startsWith("lookups/bulk/")) {
    return {
      status: 200,
      body: {
        id: path.split("/")[2],
        file_name: "tema-gateway-sims.csv",
        case_id: "FD-3046",
        total: 40,
        skipped: 2,
        pattern: { title: "Pattern: 34 of 40 SIMs are on 2 Ghana Cards, all activated in August", detail: "Typical of a bypass gateway. 6 are already selected for FD-3046." },
        data: BULK_ROWS.map(([msisdn, card, activated, calls, risk, suggested], i) => ({
          id: `bl_${i}`,
          msisdn,
          ghana_card: card,
          activated,
          recent: activated !== "2019",
          calls_per_day: calls,
          risk_score: risk,
          suggested,
        })),
      },
    };
  }
  // PROPOSED: POST /cases/{id}/entities — add numbers, wallets, devices or agents to a case (G19, G30).
  const ent = path.match(/^cases\/([^/]+)\/entities$/);
  if (method === "POST" && ent) {
    return { status: 200, body: { case_id: ent[1], added: ((body?.entity_ids as string[]) ?? []).length, evidence_id: "ev_net_01" } };
  }
  if (method === "POST" && path === "operator-requests") {
    return { status: 201, body: { id: "OR-0088", operator: body?.operator, case_id: body?.case_id, due_at: new Date(clock() + 86_400_000).toISOString() } };
  }
  return undefined;
}
