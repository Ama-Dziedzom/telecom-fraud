import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Demo triggers for the Postman mock (FD_API_MOCK=1 only).
 *
 * Every example in the collection uses the same request body, so the mock
 * always answers with the success example. These rules pick the matching
 * error example with Postman’s `x-mock-response-code` header, so every
 * screen can be reached. They never run against the real API.
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
 */

type Body = Record<string, unknown> | null;

const domainOf = (email: unknown) => String(email ?? "").split("@")[1]?.toLowerCase() ?? "";
const localOf = (email: unknown) => String(email ?? "").split("@")[0]?.toLowerCase() ?? "";
const KNOWN_DOMAINS = ["kasamobile.com.gh", "voltatelecom.com.gh"];

export function mockResponseCode(method: string, path: string, body: Body): number | undefined {
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
  return undefined;
}

/**
 * The mock only reliably answers for the collection’s example IDs, so route
 * every ID in the path to that example (after mockResponseCode has looked at
 * the original). Screens still show the IDs they asked for where it matters.
 */
const EXAMPLE_IDS: Array<[RegExp, string]> = [
  [/^(auth\/invites\/)[^/]+/, "$1inv_demo"],
  [/^(cases\/)(?!pick-up)[^/]+/, "$1FD-3050"],
  [/^(alerts\/)(?!stream)[^/]+/, "$1AL-88213"],
  [/^(subscribers\/)[^/]+/, "$1sub_8KQ2"],
  [/^(agents\/)[^/]+/, "$1AG-2231"],
  [/^(actions\/)[^/]+/, "$1act_5Rk1"],
  [/^(reversals\/)[^/]+/, "$1RV-0921"],
  [/^(handovers\/)[^/]+\/[^/]+/, "$1string/decline"],
  [/^(evidence\/)[^/]+/, "$1string"],
  [/^(escalations\/)[^/]+/, "$1string"],
  [/^(reports\/)[^/]+(?=\/)/, "$1string"],
  [/^(samples\/)[^/]+/, "$1string"],
  [/^(jobs\/)[^/]+/, "$1string"],
  [/^(admin\/users\/)[^/]+/, "$1string"],
  [/^(admin\/rules\/)[^/]+\/versions\/[^/]+\/[^/]+/, "$1R-104/versions/3/backtest"],
];

export function mockUpstreamPath(path: string) {
  for (const [pattern, example] of EXAMPLE_IDS) {
    if (pattern.test(path)) return path.replace(pattern, example);
  }
  return path;
}

/**
 * The collection names an “SSO sign-in” example for /auth/identify but has no
 * body for it, so the mock can’t return one. Until it does, answer here with
 * the shape the app expects. TODO: confirm `next: "sso"` + `redirect_url`.
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
        // A real IdP URL; here it skips straight to the app’s return page.
        redirect_url: `/sign-in/sso/callback?code=${code}&state=flw_sso_01`,
      },
    };
  }
  return undefined;
}

/**
 * Some collection examples have no status code; the mock serves those (a
 * Problem body with HTTP 200) when no code is asked for. Ask for each
 * request’s own success example instead, read from the collection itself.
 */
type Item = { item?: Item[]; request?: { method: string; url: { path?: string[] } }; response?: Array<{ code?: number }> };
let successCodes: Array<{ method: string; pattern: RegExp; code: number; params: number }> | null = null;

function loadSuccessCodes() {
  const out: NonNullable<typeof successCodes> = [];
  try {
    const file = join(process.cwd(), "FraudDetection App API.postman_collection.json");
    const walk = (items: Item[]) => {
      for (const it of items) {
        if (it.item) walk(it.item);
        const req = it.request;
        const code = it.response?.find((r) => r.code && r.code >= 200 && r.code < 300)?.code;
        if (!req || !code || !req.url.path) continue;
        const segments = req.url.path.filter((seg) => seg !== "app" && seg !== "v1" && !seg.startsWith("{{"));
        const pattern = new RegExp(`^${segments.map((seg) => (seg.startsWith(":") ? "[^/]+" : seg)).join("/")}$`);
        out.push({ method: req.method, pattern, code, params: segments.filter((seg) => seg.startsWith(":")).length });
      }
    };
    walk((JSON.parse(readFileSync(file, "utf8")) as Item).item ?? []);
  } catch {
    // No collection next to the app: let the mock choose.
  }
  // Literal paths before parameterised ones (alerts/stream before alerts/:id).
  return out.sort((a, b) => a.params - b.params);
}

export function mockSuccessCode(method: string, path: string) {
  successCodes ??= loadSuccessCodes();
  return successCodes.find((r) => r.method === method && r.pattern.test(path))?.code;
}
