"use client";

/**
 * Client-side markers for the (mock) signed-in session. A real backend would
 * set an httpOnly session cookie instead; these only drive UI: the E4
 * “Welcome back” toast and the account chip on E3 after an idle sign-out.
 * sessionStorage is per tab and cleared when the tab closes.
 */
import { useSyncExternalStore } from "react";

const WELCOME_KEY = "fd:show-welcome";
const ACCOUNT_KEY = "fd:account";

function safely<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback; // Storage unavailable (private mode, blocked site data).
  }
}

const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const notify = () => listeners.forEach((l) => l());

/** Read once per sign-in, so the toast shows on the first signed-in page only. */
let welcomeSnapshot: boolean | null = null;

export function completeSignIn(email?: string) {
  safely(() => {
    sessionStorage.setItem(WELCOME_KEY, "1");
    if (email) sessionStorage.setItem(ACCOUNT_KEY, email);
  }, undefined);
  welcomeSnapshot = null;
}

function readWelcome() {
  if (welcomeSnapshot === null) {
    welcomeSnapshot = safely(() => {
      const value = sessionStorage.getItem(WELCOME_KEY);
      sessionStorage.removeItem(WELCOME_KEY);
      return value === "1";
    }, false);
  }
  return welcomeSnapshot;
}

function dismissWelcome() {
  welcomeSnapshot = false;
  notify();
}

/** [show, dismiss] for the E4 welcome toast. */
export function useWelcomeToast() {
  const show = useSyncExternalStore(subscribe, readWelcome, () => false);
  return [show, dismissWelcome] as const;
}

export function signedInAccount() {
  return safely(() => sessionStorage.getItem(ACCOUNT_KEY), null);
}

export function useSignedInAccount() {
  return useSyncExternalStore(subscribe, signedInAccount, () => null);
}

export function signOut({ keepAccount = false } = {}) {
  safely(() => {
    if (!keepAccount) sessionStorage.removeItem(ACCOUNT_KEY);
  }, undefined);
  notify();
}
