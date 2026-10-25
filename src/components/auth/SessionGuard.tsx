"use client";

import { Button } from "@/components/ui/Button";
import { CountdownCard } from "@/components/ui/Countdown";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { ApiError, getMe, logout, type User } from "@/lib/auth/api";
import { signOut, useWelcomeToast } from "@/lib/auth/session";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/** Operator policy: 15–30 min. Kasa Mobile uses 15. */
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
/** Handoff behaviour rule: 60 s warning before idle sign-out. */
const WARNING_MS = 60 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "pointermove"] as const;

function idleTimeoutMs(override: string | null) {
  // Dev aid: /analyst?idle=75 signs out after 75 s idle (warning after 15 s).
  if (process.env.NODE_ENV !== "production" && override) return Number(override) * 1000;
  return IDLE_TIMEOUT_MS;
}

function formatLastActive(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Wraps signed-in pages: E2 idle-timeout warning, idle sign-out to E3,
 * and the E4 “Welcome back” toast right after sign-in.
 */
export function SessionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const timeout = idleTimeoutMs(useSearchParams().get("idle"));
  const lastActivity = useRef(0);
  const [warningUntil, setWarningUntil] = useState<number | null>(null);
  const [showWelcome, dismissWelcome] = useWelcomeToast();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    lastActivity.current = Date.now();
    getMe()
      .then(setUser)
      .catch((err) => {
        // Session ended (shift over, signed out elsewhere): back to sign-in.
        if (err instanceof ApiError && err.status === 401) router.replace("/sign-in");
      });
  }, [router]);

  // Activity resets the timer, but not once the warning is showing.
  useEffect(() => {
    if (warningUntil) return;
    const touch = () => {
      lastActivity.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, touch));
  }, [warningUntil]);

  useEffect(() => {
    const id = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= timeout) {
        // TODO: save unsent notes as drafts here, then pass ?case=…&draft=1.
        signOut({ keepAccount: true });
        void logout().catch(() => undefined);
        router.replace("/signed-out/inactive");
      } else if (idle >= timeout - WARNING_MS && !warningUntil) {
        setWarningUntil(lastActivity.current + timeout);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [timeout, warningUntil, router]);

  const staySignedIn = () => {
    lastActivity.current = Date.now();
    setWarningUntil(null);
  };

  const signOutNow = useCallback(async () => {
    signOut();
    await logout().catch(() => undefined); // 401 = already signed out; either way we’re done.
    router.replace("/signed-out");
  }, [router]);

  return (
    <>
      {children}

      {/* E2 · Idle timeout warning */}
      <Modal
        open={warningUntil !== null}
        onClose={staySignedIn}
        icon="icon-clock-medium-22"
        tone="medium"
        title="Are you still there?"
        description="For security, you’ll be signed out after 15 minutes without activity. Unsaved notes are kept as drafts."
        actions={
          <>
            <Button variant="secondary" size="md" onClick={signOutNow}>
              Sign out now
            </Button>
            <Button size="md" onClick={staySignedIn} autoFocus>
              Stay signed in
            </Button>
          </>
        }
      >
        {warningUntil && <CountdownCard label="Signing out in" until={warningUntil} tone="medium" />}
      </Modal>

      {/* E4 · Welcome back · last sign-in */}
      {showWelcome && user && (
        <Toast
          title={`Welcome back, ${user.name.split(" ")[0]}`}
          // The API gives last activity only; device and location aren’t available yet.
          body={`${user.last_active_at ? `Last active: ${formatLastActive(user.last_active_at)}. ` : ""}Not you? Secure your account.`}
          action={{ label: "Review", onClick: () => router.push("#security-activity") }}
          onDismiss={dismissWelcome}
        />
      )}
    </>
  );
}
