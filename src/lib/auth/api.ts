/**
 * Authentication calls (FraudDetection App API · auth folder).
 * Screens in 01 · Authentication use only these functions.
 *
 * Demo inputs for the Postman mock live in src/lib/api/mock-scenarios.ts.
 */

import { apiFetch } from "@/lib/api/client";

export { ApiError, OfflineError, isProblem } from "@/lib/api/client";

export type Operator = { id: string; name: string; logo_url?: string | null };

export type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  shift?: string;
  last_active_at?: string;
};

/** Signed-in response once the proxy has moved the tokens into cookies. */
export type Session = {
  auth_time: string;
  session_id: string;
  user: User;
  operator: Operator;
  recovery_codes?: string[];
};

export const ROLE_LABELS: Record<string, string> = {
  fraud_analyst: "Fraud Analyst",
  fraud_supervisor: "Fraud Supervisor",
  it_admin: "IT Admin",
  auditor: "Auditor",
  super_admin: "Super Admin",
};

export const roleLabel = (role: string) => ROLE_LABELS[role] ?? role.replace(/_/g, " ");

// Step 1 ─ who are you?
export type IdentifyResult = {
  flow_id: string;
  next: "password" | "sso";
  operator: Operator;
  email: string;
  /** SSO only: where to send the person to sign in with their company. */
  redirect_url?: string;
};

export const identify = (email: string) =>
  apiFetch<IdentifyResult>("POST", "/auth/identify", { email });

// Step 2 ─ password (never signs in on its own)
export type PasswordResult = { flow_id: string; next: "mfa" | "mfa_enroll" };

export const checkPassword = (flowId: string, password: string) =>
  apiFetch<PasswordResult>("POST", "/auth/password", { flow_id: flowId, password });

// Step 3 ─ authenticator code or recovery code
export const verifyMfa = (flowId: string, code: string) =>
  apiFetch<Session>("POST", "/auth/mfa/verify", { flow_id: flowId, code });

// Authenticator setup (first sign-in, or after an IT Admin reset)
export type Enrolment = {
  flow_id: string;
  secret: string;
  otpauth_url: string;
  issuer: string;
  account: string;
};

export const startEnrolment = (flowId: string) =>
  apiFetch<Enrolment>("POST", "/auth/mfa/enroll", { flow_id: flowId });

export const confirmEnrolment = (flowId: string, code: string) =>
  apiFetch<Session>("POST", "/auth/mfa/enroll/confirm", { flow_id: flowId, code });

// Company SSO return page
export const completeSso = (code: string, state: string) =>
  apiFetch<Session>("POST", "/auth/sso/complete", { code, state });

// Recovery
export const forgotPassword = (email: string) =>
  apiFetch<{ sent_to: string; expires_in_minutes: number }>("POST", "/auth/password/forgot", { email });

export const resetPassword = (token: string, newPassword: string) =>
  apiFetch<{ next: "sign_in"; email: string }>("POST", "/auth/password/reset", {
    token,
    new_password: newPassword,
  });

// Invites
export type Invite = {
  invite_token: string;
  email: string;
  role: string;
  operator: Operator;
  invited_by: { id: string; name: string; initials: string };
  expires_at: string;
  sign_in_method: "password" | "sso";
};

export const getInvite = (token: string) =>
  apiFetch<Invite>("GET", `/auth/invites/${encodeURIComponent(token)}`);

export const acceptInvite = (token: string, name: string, password: string) =>
  apiFetch<{ flow_id: string; next: "mfa_enroll" }>(
    "POST",
    `/auth/invites/${encodeURIComponent(token)}/accept`,
    { name, password },
  );

// Session
export const getMe = () => apiFetch<User>("GET", "/me");
export const logout = () => apiFetch<void>("POST", "/auth/logout");

// ─── Not in the API yet ────────────────────────────────────────────────────
// These screens have no endpoint in the collection. They resolve locally so
// the flows stay clickable; replace them when the endpoints exist.

const wait = (ms = 600) => new Promise((r) => setTimeout(r, ms));

/** B4 · request access after SSO without an account. TODO: endpoint. */
export async function requestAccess(_email: string, _reason: string) {
  await wait();
}

/** D6 → D7 · ask the IT admin to reset the authenticator. TODO: endpoint. */
export async function requestAuthenticatorReset(_email: string) {
  await wait();
  return { reference: "MFA-RESET-0192" };
}

/** C7 · ask the inviter for a new invite. TODO: endpoint. */
export async function requestNewInvite(_token: string) {
  await wait();
}

/** F1–F4 · staff console sign-in. TODO: endpoints. */
export async function verifyStaffCode(code: string) {
  await wait();
  return code !== "000000";
}

export async function requestSupportAccess(_reason: string) {
  await wait();
}
