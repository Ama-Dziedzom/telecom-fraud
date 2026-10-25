"use client";

import { logout } from "@/lib/auth/api";
import { signOut } from "@/lib/auth/session";
import { useRouter } from "next/navigation";

/**
 * Stand-in for screens that aren’t built yet (Fraud Analyst home, staff
 * consoles). Replace with the real pages from Figma.
 */
export function WorkspacePlaceholder({ name }: { name: string }) {
  const router = useRouter();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-surface-canvas p-8 text-center">
      <p className="text-body-m text-text-secondary">Signed in. The {name} workspace comes next.</p>
      <button
        type="button"
        onClick={async () => {
          signOut();
          await logout().catch(() => undefined);
          router.replace("/signed-out");
        }}
        className="rounded text-label-s text-text-brand hover:underline"
      >
        Sign out
      </button>
    </main>
  );
}
