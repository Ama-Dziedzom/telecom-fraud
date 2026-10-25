"use client";

import { RequestError } from "@/components/auth/RequestError";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { OtpInput } from "@/components/ui/OtpInput";
import { apiFetch, isProblem } from "@/lib/api/client";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Run = <T>(call: () => Promise<T>) => Promise<T>;
const StepUpContext = createContext<Run>((call) => call());

/**
 * Sensitive calls (protect, reveal) answer 401 step_up_required when the
 * sign-in is too old. `useStepUp()(call)` asks for a fresh authenticator
 * code (POST /auth/step-up), then retries the original call once.
 */
export function StepUpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [errorKey, setErrorKey] = useState(0);
  const pending = useRef<{ resolve: () => void; reject: (e: unknown) => void } | null>(null);

  const run: Run = useCallback(async (call) => {
    try {
      return await call();
    } catch (err) {
      if (!isProblem(err, "step_up_required")) throw err;
      setCode("");
      setFailure(null);
      setOpen(true);
      await new Promise<void>((resolve, reject) => {
        pending.current = { resolve, reject };
      });
      return call();
    }
  }, []);

  const verify = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await apiFetch("POST", "/auth/step-up", { code });
      setOpen(false);
      pending.current?.resolve();
    } catch (err) {
      setFailure(err);
      setErrorKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setOpen(false);
    pending.current?.reject(new Error("step_up_cancelled"));
  };

  return (
    <StepUpContext value={run}>
      {children}
      <Modal
        open={open}
        onClose={cancel}
        icon="icon-shield-info"
        tone="brand"
        title="Confirm it’s you"
        description="This action needs a fresh code from your authenticator app."
        actions={
          <>
            <Button variant="secondary" size="md" onClick={cancel}>
              Cancel
            </Button>
            <Button size="md" onClick={verify} loading={busy} disabled={code.length < 6}>
              Confirm
            </Button>
          </>
        }
      >
        <OtpInput value={code} onChange={setCode} error={Boolean(failure)} errorKey={errorKey} autoFocus />
        <RequestError error={failure} />
      </Modal>
    </StepUpContext>
  );
}

export const useStepUp = () => useContext(StepUpContext);
