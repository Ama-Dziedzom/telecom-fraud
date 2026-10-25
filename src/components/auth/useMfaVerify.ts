"use client";

import { useFlowExpired, useRequireFlow } from "@/components/auth/SignInContext";
import { ApiError, verifyMfa } from "@/lib/auth/api";
import { completeSignIn } from "@/lib/auth/session";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useResetOnHide } from "@/lib/useResetOnHide";

/**
 * POST /auth/mfa/verify for A8 (authenticator code) and A10 (recovery code).
 * 401 invalid_code → inline error; 429 too_many_attempts → blocked with the
 * API’s wait time; 410 flow_expired → back to A1.
 */
export function useMfaVerify(invalidMessage: string) {
  const router = useRouter();
  const flow = useRequireFlow();
  const flowExpired = useFlowExpired();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [failures, setFailures] = useState(0);
  const [failure, setFailure] = useState<unknown>(null);
  useResetOnHide(() => setSubmitting(false));

  const verify = async (code: string) => {
    if (!flow.flowId) return;
    setSubmitting(true);
    setFailure(null);
    try {
      const session = await verifyMfa(flow.flowId, code);
      completeSignIn(session.user.email, session.operator?.name);
      router.push("/queue");
    } catch (err) {
      setSubmitting(false);
      if (!(err instanceof ApiError)) return setFailure(err);
      if (err.code === "invalid_code") {
        setError(invalidMessage);
        setFailures((n) => n + 1);
      } else if (err.code === "too_many_attempts") {
        setError(err.problem.detail ?? "Too many tries. Wait a few minutes, then sign in again.");
        setBlocked(true);
      } else if (err.code === "flow_expired") {
        flowExpired(err.problem);
      } else {
        setFailure(err);
      }
    }
  };

  return {
    flow,
    verify,
    submitting,
    error,
    clearError: () => {
      if (!blocked) setError(null);
    },
    blocked,
    failures,
    failure,
  };
}
