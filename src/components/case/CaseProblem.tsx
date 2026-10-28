"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody } from "@/components/app/AppShell";
import { ConflictDialog, LoadErrorState, NoAccessState, NotFoundState } from "@/components/app/ProblemStates";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiFetch } from "@/lib/api/client";
import { caseStatusLabel } from "@/components/app/indicators";
import type { CaseChangedProblem } from "@/lib/api/cases";
import type { CaseStatus, PersonRef } from "@/lib/api/fd";
import { formatClock, formatDay, useNow } from "@/lib/time";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { firstName } from "./parts";

/** I16 · No access · I17 · Case not found (or merged) · I18 · Something went wrong */
export function CaseProblem({ caseId, error }: { caseId: string; error: unknown }) {
  const toast = useToast();
  const { mutate } = useSWRConfig();
  const [requested, setRequested] = useState(false);
  const now = useNow();
  const problem = error instanceof ApiError ? error.problem : null;
  const status = error instanceof ApiError ? error.status : 0;

  let body;
  if (status === 403) {
    body = (
      <NoAccessState
        caseId={caseId}
        detail={problem?.detail}
        requested={requested}
        onRequest={async () => {
          const r = await apiFetch<{ approver: PersonRef }>("POST", `/cases/${caseId}/access-requests`, { reason: `Asked from the case page for ${caseId}.` }).catch(() => null);
          setRequested(true);
          toast({ tone: "success", title: "Access requested", body: `${r ? r.approver.name : "Your supervisor"} has been notified.` });
        }}
      />
    );
  } else if (status === 404) {
    body = <NotFoundState caseId={caseId} mergedInto={problem?.merged_into as string | undefined} detail={problem?.detail} />;
  } else {
    body = (
      <LoadErrorState
        what={`case ${caseId}`}
        onRetry={() => void mutate(`/cases/${caseId}`)}
        errorId={problem?.request_id}
        at={`${formatDay(now)}, ${formatClock(now)}`}
      />
    );
  }

  return (
    <>
      <AppHeader section="Cases" title={caseId} />
      <PageBody>{body}</PageBody>
    </>
  );
}

const FIELD_LABEL: Record<string, string> = { assignee: "Assignee", status: "Status", stage: "Stage", severity: "Severity" };
const changeValue = (field: string, v: CaseChangedProblem["changes"][number]["from"]) =>
  v === null ? "—" : typeof v === "object" ? v.name : field === "status" ? caseStatusLabel(v as CaseStatus) : v.replace(/_/g, " ");

/** I15 · Conflict — the case changed while you were writing. Your note is kept. */
export function ConflictModal({
  problem,
  note,
  onPost,
  onDiscard,
  onClose,
  busy,
}: {
  problem: ApiError;
  note: string;
  onPost: () => void;
  onDiscard: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const p = problem.problem as unknown as CaseChangedProblem;
  const assignee = p.changes.find((c) => c.field === "assignee")?.to;
  const first = assignee && typeof assignee === "object" ? firstName(assignee.name) : undefined;
  return (
    <ConflictDialog
      title={p.title}
      detail={p.detail}
      changes={[
        ...p.changes.map((c) => ({ field: FIELD_LABEL[c.field] ?? c.field, before: changeValue(c.field, c.from), now: changeValue(c.field, c.to) })),
        { field: "Changed by", before: "—", now: `${p.changed_by.name} · ${formatClock(p.changed_at)}` },
      ]}
      note={note}
      postLabel={`Post note${first ? ` for ${first}` : ""}`}
      onPost={onPost}
      onDiscard={onDiscard}
      onClose={onClose}
      busy={busy}
    />
  );
}
