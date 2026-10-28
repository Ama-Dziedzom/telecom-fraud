import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Demo triggers for the Postman mock (FD_API_MOCK=1 only).
 *
 * Examples on the same path share one request body, so the mock can’t tell
 * a wrong password from a right one. These rules pick the matching error
 * example by status code, so every screen can be reached. They never run
 * against the real API.
 *
 *   Email @kasamobile.com.gh        → password sign-in
 *   Email @voltatelecom.com.gh      → company SSO (synthesised, see below)
 *   Any other domain                → 404 domain_not_recognised (A3)
 *   Email deactivated.*@…           → 403 account_deactivated (A7)
 *   Password “wrong”                → 401 invalid_credentials (A5)
 *   Password “locked”               → 423 account_locked (A6)
 *   Password “expired”              → 403 password_expired (E1)
 *   Password “timeout”              → 410 flow_expired
 *   Code 000000                     → 401 invalid_code (A9)
 *   Code 999999                     → 429 too_many_attempts
 *   SSO for noaccess.*@…            → 403 sso_not_assigned (B3)
 *   Reset token “expired”           → 410 link_expired (D4)
 *   Invite token “expired” / “used” → 410 / 409 (C7)
 *   Forgot password @voltatelecom   → 409 sso_managed
 *   Case action barring over 10 SIMs → 403 limit_exceeded (D6); any other action → 202
 *   Note on FD-3051                 → 409 case_changed (I15, its own example); `force: true` → 201
 *   Brief export with thumbnails    → 413 export_too_large (E23); without → 200
 *   Alert lock with `take_over: true` → 200 (B20 “Take over” on AL-88195, whose own example is 423)
 *   Pick up more than 2 cases       → 409 capacity_exceeded (G3; My cases has 7 of 9)
 */

type Body = Record<string, unknown> | null;

const domainOf = (email: unknown) => String(email ?? "").split("@")[1]?.toLowerCase() ?? "";
const localOf = (email: unknown) => String(email ?? "").split("@")[0]?.toLowerCase() ?? "";
const KNOWN_DOMAINS = ["kasamobile.com.gh", "voltatelecom.com.gh"];

/** Which example a demo trigger asks for: by status code, or by name when several share one. */
export type MockWant = { code?: number; name?: string };

export function mockWant(method: string, path: string, body: Body): MockWant | undefined {
  const code = demoCode(method, path, body);
  return code ? { code } : undefined;
}

function demoCode(method: string, path: string, body: Body): number | undefined {
  if (method === "POST" && path === "auth/identify") {
    if (localOf(body?.email).startsWith("deactivated.")) return 403;
    if (!KNOWN_DOMAINS.includes(domainOf(body?.email))) return 404;
  }
  if (method === "POST" && path === "auth/password") {
    return { wrong: 401, locked: 423, expired: 403, timeout: 410 }[String(body?.password)];
  }
  if (method === "POST" && (path === "auth/mfa/verify" || path === "auth/mfa/enroll/confirm")) {
    if (body?.code === "000000") return 401;
    if (path === "auth/mfa/verify" && body?.code === "999999") return 429;
  }
  if (method === "POST" && path === "auth/sso/complete" && body?.code === "idp_noaccess") return 403;
  if (method === "POST" && path === "auth/password/reset" && body?.token === "expired") return 410;
  if (method === "POST" && path === "auth/password/forgot" && domainOf(body?.email) === "voltatelecom.com.gh")
    return 409;
  if (method === "GET" && path === "auth/invites/expired") return 410;
  if (method === "GET" && path === "auth/invites/used") return 409;
  if (method === "POST" && /^cases\/[^/]+\/actions$/.test(path)) {
    const parts = (body?.parts as Array<{ kind?: string; count?: number }> | undefined) ?? [];
    return parts.some((p) => p.kind === "bar_sims_on_id" && (p.count ?? 0) > 10) ? 403 : 202;
  }
  if (method === "POST" && /^cases\/[^/]+\/notes$/.test(path) && body?.force) return 201;
  if (method === "POST" && /^cases\/[^/]+\/brief\/export$/.test(path)) return body?.include_thumbnails ? 413 : 200;
  if (method === "POST" && /^alerts\/[^/]+\/lock$/.test(path) && body?.take_over) return 200;
  if (method === "POST" && path === "cases/pick-up" && ((body?.case_ids as unknown[] | undefined)?.length ?? 0) > 2) return 409;
  return undefined;
}

/**
 * The mock answers each saved example on its exact path and query only
 * (/cases/FD-3047 returns FD-3047). Requests for anything else — IDs the
 * collection has no example for, or extra query parameters — are sent to the
 * closest example on the same endpoint, and the example is named with
 * `x-mock-response-code` (plus `x-mock-response-name` when several share a
 * path and code), so the mock never has to guess.
 */
type Example = { name: string; code: number; path: string; search: string };
type Endpoint = { method: string; pattern: RegExp; params: number; examples: Example[] };
type Item = {
  item?: Item[];
  request?: { method: string; url: { path?: string[] } };
  response?: Array<{ name: string; code?: number; originalRequest?: { url?: { raw?: string } } }>;
};

const COLLECTION = "FraudDetection-mock.postman_collection.json";
let endpoints: Endpoint[] | null = null;

function loadEndpoints() {
  const out: Endpoint[] = [];
  try {
    const walk = (items: Item[]) => {
      for (const it of items) {
        if (it.item) walk(it.item);
        const req = it.request;
        if (!req?.url.path) continue;
        const segments = req.url.path.filter((seg) => seg !== "app" && seg !== "v1");
        const pattern = new RegExp(`^${segments.map((seg) => (seg.startsWith(":") ? "[^/]+" : seg)).join("/")}$`);
        const examples = (it.response ?? []).flatMap((r) => {
          const url = new URL(r.originalRequest?.url?.raw ?? "", "https://mock.invalid");
          const path = url.pathname.replace(/^\/app\/v1\//, "");
          return r.code ? [{ name: r.name, code: r.code, path, search: url.search }] : [];
        });
        out.push({ method: req.method, pattern, params: segments.filter((seg) => seg.startsWith(":")).length, examples });
      }
    };
    walk((JSON.parse(readFileSync(join(process.cwd(), COLLECTION), "utf8")) as Item).item ?? []);
  } catch {
    // No collection next to the app: forward requests as they are.
  }
  // Literal paths before parameterised ones (alerts/stream before alerts/:id).
  return out.sort((a, b) => a.params - b.params);
}

const ok = (code: number) => code >= 200 && code < 300;

/**
 * How well an example's query fits the request. Keys are weighted by how rare
 * they are among the endpoint's examples, so a filter only one example has
 * (`fraud_type`, `became_fraud`) outweighs keys they all share (`area`).
 */
function queryScore(want: URLSearchParams, have: string, examples: Example[]) {
  let score = 0;
  for (const [key, value] of new URLSearchParams(have)) {
    const weight = examples.length / examples.filter((e) => new URLSearchParams(e.search).has(key)).length;
    score += want.get(key) === value ? weight : -weight;
  }
  return score;
}

export type MockRoute = { path: string; search: string; code?: number; name?: string };

export function mockRoute(method: string, path: string, search: URLSearchParams, want?: MockWant): MockRoute {
  endpoints ??= loadEndpoints();
  const endpoint = endpoints.find((e) => e.method === method && e.pattern.test(path));
  // Without a demo trigger, an example saved on this exact path can win whatever
  // its status (FD-3043 answers 404 case_merged; layers for Kumasi answer 504);
  // otherwise a success example.
  const pool = endpoint?.examples.filter((e) => (want?.name ? e.name === want.name : want?.code ? e.code === want.code : true));
  const onPath = want ? [] : (pool ?? []).filter((e) => e.path === path);
  const examples = onPath.length ? onPath : pool?.filter((e) => want || ok(e.code));
  if (!examples?.length) return { path, search: search.size ? `?${search}` : "", code: want?.code };

  const best = examples
    // Path, then query; a success example wins a tie (/auth/identify).
    .map((e, i) => ({ e, score: (e.path === path ? 1000 : 0) + queryScore(search, e.search, endpoint!.examples) + (ok(e.code) ? 0.1 : 0), i }))
    .sort((a, b) => b.score - a.score || a.i - b.i)[0].e;
  const shared = endpoint!.examples.filter((e) => e.path === best.path && e.search === best.search && e.code === best.code);
  // Header values must be plain ASCII; every name that needs sending is.
  const name = shared.length > 1 && /^[\x20-\x7e]*$/.test(best.name) ? best.name : undefined;
  return { path: best.path, search: best.search, code: best.code, name };
}

/**
 * The collection’s “SSO sign-in” example sends people to the real identity
 * provider. The demo company answers here instead, with a redirect that skips
 * straight to the app’s return page.
 */
export function mockSyntheticResponse(
  method: string,
  path: string,
  body: Body,
): { status: number; body: unknown } | undefined {
  if (method === "POST" && path === "auth/identify" && domainOf(body?.email) === "voltatelecom.com.gh") {
    const code = localOf(body?.email).startsWith("noaccess.") ? "idp_noaccess" : "idp_code_9f2";
    return {
      status: 200,
      body: {
        flow_id: "flw_sso_01",
        next: "sso",
        operator: { id: "op_volta", name: "Volta Telecom", logo_url: null },
        email: body?.email,
        sso: {
          provider: "Microsoft Entra ID",
          protocol: "oidc",
          redirect_url: `/sign-in/sso/callback?code=${code}&state=flw_sso_01`,
        },
      },
    };
  }
  return undefined;
}

/**
 * The collection has one example per list (e.g. GET /cases?view=mine), so the
 * mock answers every filter with the same rows. In mock mode the proxy applies
 * the list query here — what the real API does server-side — so filter chips,
 * search and saved views behave. Counts stay as the example gives them
 * (they’re totals per status, not per filter); `total` follows the rows.
 */
/** The mock’s “now”: NEXT_PUBLIC_FD_DEMO_NOW when set (as the app clock in lib/time), else the real time. */
const mockNow = () => (process.env.NEXT_PUBLIC_FD_DEMO_NOW ? Date.parse(process.env.NEXT_PUBLIC_FD_DEMO_NOW) : Date.now());

export function mockFilterList(method: string, path: string, search: URLSearchParams, data: Record<string, unknown> | null) {
  if (method !== "GET" || path !== "cases" || !data || !Array.isArray(data.data)) return data;
  const list = (k: string) =>
    (search.get(k) ?? "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  const level = (score: number) => (score >= 90 ? "critical" : score >= 70 ? "high" : score >= 40 ? "medium" : "low");
  const status = list("status");
  const severity = list("severity");
  const region = list("region");
  const fraudType = list("fraud_type");
  const sla = list("sla");
  const q = (search.get("q") ?? "").trim().toLowerCase();
  type Row = {
    id: string;
    title: string;
    status: string;
    risk_score: number;
    region?: string;
    fraud_type?: string;
    sla_due_at?: string;
    subscriber?: { msisdn?: string; name?: string };
  };
  const rows = (data.data as Row[]).filter(
    (c) =>
      // Saved views use “open” for every status but closed.
      (!status.length || status.includes(c.status) || (status.includes("open") && c.status !== "closed")) &&
      (!severity.length || severity.includes(level(c.risk_score))) &&
      (!region.length || region.includes((c.region ?? "").toLowerCase())) &&
      (!fraudType.length || fraudType.includes((c.fraud_type ?? "").toLowerCase())) &&
      (!sla.includes("breached") || (c.sla_due_at !== undefined && Date.parse(c.sla_due_at) < mockNow())) &&
      (!q || [c.id, c.title, c.subscriber?.msisdn, c.subscriber?.name].some((v) => v?.toLowerCase().replace(/\s/g, "").includes(q.replace(/\s/g, "")))),
  );
  return { ...data, data: rows, total: rows.length };
}
