"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AuthWorkflowPanel, type WorkflowStep } from "./AuthWorkflowPanel";

/** Workflow panel step per auth route (Figma 01 · Authentication, A–F). */
const STEPS: [RegExp, WorkflowStep][] = [
  [/^\/invite\/[^/]+\/done$/, 4], // C6
  [/^\/reset-password\/done$/, 4], // D5
  [/^\/staff\/workspaces$/, 4], // F3
  [/^\/sign-in\/(verify|backup-code|backup-codes|set-up-authenticator)$/, 3], // A8–A10
  [/^\/invite\/[^/]+\/(authenticator|backup-codes)$/, 3], // C4, C5
  [/^\/staff\/verify$/, 3], // F2
  [/^\/sign-in\/(password|locked|deactivated|cant-use-authenticator|reset-requested)$/, 2], // A4–A7, D6, D7
  [/^\/sign-in\/sso(\/(redirecting|callback|error))?$/, 2], // B1–B3
  [/^\/invite\/[^/]+$/, 2], // C2, C3
  [/^\/(reset-password|password-expired|staff\/request-access)$/, 2], // D3, E1, F4
];

const Override = createContext<(step: WorkflowStep | null) => void>(() => {});

/**
 * Auth frame — form column left, Auth / Workflow panel right (equal halves at
 * 1728). Screens can override the route's step with `useAuthStep`.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<WorkflowStep | null>(null);
  const pathname = usePathname();
  const step = override ?? STEPS.find(([re]) => re.test(pathname))?.[1] ?? 1;
  return (
    <Override value={setOverride}>
      <div className="grid min-h-dvh bg-surface-base lg:grid-cols-2">
        {children}
        <div className="sticky top-0 hidden h-dvh lg:block">
          <AuthWorkflowPanel step={step} />
        </div>
      </div>
    </Override>
  );
}

/** Rendered by a screen to show a different step than its route implies. */
export function useAuthStep(step: WorkflowStep | undefined) {
  const set = useContext(Override);
  useEffect(() => {
    if (!step) return;
    set(step);
    return () => set(null);
  }, [step, set]);
}
