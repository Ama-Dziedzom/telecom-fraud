"use client";

import type { Operator, User } from "@/lib/auth/api";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * The in-progress sign-in across the auth screens: the API’s flow_id plus
 * what the screens need to show. Kept in memory rather than the URL so the
 * work email never lands in browser history or server logs. A refresh
 * starts over at /sign-in.
 */
type Flow = {
  email: string;
  flowId: string | null;
  operator: Operator | null;
  method: "password" | "sso" | null;
  /** SSO: where the identity provider sign-in lives. */
  redirectUrl: string | null;
  /** 423 account_locked */
  lockedUntil: number | null;
  /** 403 password_expired */
  resetToken: string | null;
  /** 403 account_deactivated */
  adminContact: string | null;
  /** Shown once after authenticator setup. */
  recoveryCodes: string[];
  /** Set once signed in (C6 greets them by name). */
  user: User | null;
  /** Explains why someone was sent back to A1 (e.g. flow_expired). */
  notice: { title: string; detail?: string } | null;
};

const EMPTY: Flow = {
  email: "",
  flowId: null,
  operator: null,
  method: null,
  redirectUrl: null,
  lockedUntil: null,
  resetToken: null,
  adminContact: null,
  recoveryCodes: [],
  user: null,
  notice: null,
};

type SignInState = Flow & {
  update: (patch: Partial<Flow>) => void;
  /** Start over at A1, optionally explaining why. */
  restart: (notice?: Flow["notice"]) => void;
};

const SignInContext = createContext<SignInState | null>(null);

export function SignInProvider({ children }: { children: ReactNode }) {
  const [flow, setFlow] = useState<Flow>(EMPTY);
  const update = useCallback((patch: Partial<Flow>) => setFlow((f) => ({ ...f, ...patch })), []);
  const restart = useCallback(
    (notice: Flow["notice"] = null) => setFlow((f) => ({ ...EMPTY, email: f.email, notice })),
    [],
  );
  const value = useMemo(() => ({ ...flow, update, restart }), [flow, update, restart]);
  return <SignInContext value={value}>{children}</SignInContext>;
}

export function useSignIn() {
  const ctx = useContext(SignInContext);
  if (!ctx) throw new Error("useSignIn must be used inside <SignInProvider>");
  return ctx;
}

/**
 * For screens that only make sense mid-sign-in (they need the API flow):
 * sends people back to A1 otherwise. Render nothing until `ready`.
 */
export function useRequireFlow() {
  const ctx = useSignIn();
  const router = useRouter();
  const ready = Boolean(ctx.email && ctx.flowId);
  useEffect(() => {
    if (!ready) router.replace("/sign-in");
  }, [ready, router]);
  return { ...ctx, ready };
}

/** Sends a timed-out flow (410 flow_expired) back to A1 with the API’s message. */
export function useFlowExpired() {
  const { restart } = useSignIn();
  const router = useRouter();
  return useCallback(
    (problem: { title?: string; detail?: string }) => {
      restart({ title: problem.title ?? "This sign-in timed out", detail: problem.detail });
      router.replace("/sign-in");
    },
    [restart, router],
  );
}
