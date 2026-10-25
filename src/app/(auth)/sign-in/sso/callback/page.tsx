"use client";

import { RequestError } from "@/components/auth/RequestError";
import { useFlowExpired } from "@/components/auth/SignInContext";
import { AuthPage } from "@/components/auth/AuthPage";
import { ButtonLink } from "@/components/ui/Button";
import { ApiError, completeSso } from "@/lib/auth/api";
import { completeSignIn } from "@/lib/auth/session";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { SsoProgress } from "@/components/auth/SsoProgress";

function SsoCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const flowExpired = useFlowExpired();
  const [failure, setFailure] = useState<unknown>(null);
  const started = useRef(false);

  useEffect(() => {
    // The IdP code is single-use: never post it twice (e.g. Strict Mode remounts).
    if (started.current) return;
    started.current = true;
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) {
      flowExpired({ title: "This sign-in timed out", detail: "Start again with your email." });
      return;
    }
    completeSso(code, state)
      .then((session) => {
        completeSignIn(session.user.email);
        router.replace("/analyst");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.code === "sso_not_assigned") {
          const ref = err.problem.request_id ? `?ref=${encodeURIComponent(err.problem.request_id)}` : "";
          router.replace(`/sign-in/sso/error${ref}`);
        } else if (err instanceof ApiError && err.code === "flow_expired") {
          flowExpired(err.problem);
        } else {
          setFailure(err);
        }
      });
  }, [params, router, flowExpired]);

  if (failure) {
    return (
      <AuthPage>
        <RequestError error={failure} />
        <ButtonLink href="/sign-in" variant="secondary" fullWidth>
          Back to sign in
        </ButtonLink>
      </AuthPage>
    );
  }
  return <SsoProgress title="Finishing company sign-in…" />;
}

/** SSO return page: the identity provider sends people back here with ?code&state. */
export default function SsoCallbackPage() {
  return (
    <Suspense>
      <SsoCallback />
    </Suspense>
  );
}
