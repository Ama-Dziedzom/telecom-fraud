"use client";

import { ApiError, getInvite, type Invite } from "@/lib/auth/api";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type InviteState =
  | { status: "loading" }
  | { status: "ready"; invite: Invite }
  /** 410 invite_expired / 409 invite_used — C7 with the API’s wording. */
  | { status: "unusable"; reason: "expired" | "used"; title: string; detail?: string }
  | { status: "failed"; error: unknown };

/** GET /auth/invites/{token} for the C-flow screens. */
export function useInvite() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<InviteState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getInvite(token)
      .then((invite) => !cancelled && setState({ status: "ready", invite }))
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.code === "invite_expired" || err.code === "invite_used")) {
          setState({
            status: "unusable",
            reason: err.code === "invite_used" ? "used" : "expired",
            title: err.problem.title ?? "This invite can’t be used",
            detail: err.problem.detail,
          });
        } else {
          setState({ status: "failed", error: err });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { token, ...state };
}
