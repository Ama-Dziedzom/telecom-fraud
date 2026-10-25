import "server-only";

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
 * The mock only knows the collection’s example IDs, so route any invite
 * token to inv_demo (after mockResponseCode has looked at the original).
 */
export function mockUpstreamPath(path: string) {
  return path.replace(/^auth\/invites\/[^/]+/, "auth/invites/inv_demo");
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
