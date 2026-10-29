"use client";

import type { CaseDetail, Transaction } from "@/lib/api/cases";
import type { ProtectiveAction } from "@/lib/api/fd";
import { useState } from "react";
import { AgentSuspensionModal, CallLogModal, EscalateModal, HandToColleagueModal, ReversalModal } from "./ActionDialogs";
import { ApplyingModal, BarSimsModal, ProtectCaseModal, type ProtectKind } from "./ProtectDialogs";
import { MonitorModal, ReopenModal, ResolveModal, ResubmitModal } from "./ResolveDialogs";

export type CaseDialog =
  | { kind: "protect"; parts: ProtectKind[]; targets?: string[] }
  | { kind: "bar_sims" }
  | { kind: "call" }
  | { kind: "reversal"; transactions?: Transaction[] }
  | { kind: "escalate"; prefill?: string }
  | { kind: "suspend_agent" }
  | { kind: "handover" }
  | { kind: "resolve"; outcome?: "false_positive" }
  | { kind: "resubmit" }
  | { kind: "reopen" }
  | { kind: "monitor" };

/** The case actions (Section D), one at a time; protect hands over to the “applying” progress. */
export function CaseDialogs({
  detail,
  dialog,
  onClose,
  onOpen,
}: {
  detail: CaseDetail;
  dialog: CaseDialog;
  onClose: () => void;
  onOpen: (dialog: CaseDialog) => void;
}) {
  const [applying, setApplying] = useState<ProtectiveAction | null>(null);
  // The swap agent (“Agent AG-2231, Adum”), or the agent the recommended step names (“Ask to suspend agent 557210”).
  const agent =
    detail.what_happened.find((s) => s.kind === "sim_swap")?.detail?.match(/AG-\d+/)?.[0] ??
    detail.next_steps.recommended?.title.match(/agent ([A-Z]{2}-\d+|\d{6})/i)?.[1] ??
    "AG-2231";

  if (applying) return <ApplyingModal action={applying} caseId={detail.id} onClose={onClose} />;

  switch (dialog.kind) {
    case "protect":
      return (
        <ProtectCaseModal
          detail={detail}
          initial={dialog.parts}
          targets={dialog.targets}
          onClose={onClose}
          onApplying={setApplying}
        />
      );
    case "bar_sims":
      return <BarSimsModal detail={detail} onClose={onClose} onApplying={setApplying} onEscalate={(prefill) => onOpen({ kind: "escalate", prefill })} />;
    case "call":
      return <CallLogModal detail={detail} onClose={onClose} />;
    case "reversal":
      return <ReversalModal detail={detail} preselect={dialog.transactions} onClose={onClose} />;
    case "escalate":
      return <EscalateModal detail={detail} prefill={dialog.prefill} onClose={onClose} />;
    case "suspend_agent":
      return <AgentSuspensionModal detail={detail} agentCode={agent} onClose={onClose} />;
    case "handover":
      return <HandToColleagueModal detail={detail} onClose={onClose} />;
    case "resolve":
      return <ResolveModal detail={detail} initial={dialog.outcome} onClose={onClose} />;
    case "resubmit":
      return <ResubmitModal detail={detail} onClose={onClose} />;
    case "reopen":
      return <ReopenModal detail={detail} onClose={onClose} />;
    case "monitor":
      return <MonitorModal detail={detail} onClose={onClose} />;
  }
}
