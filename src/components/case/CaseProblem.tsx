"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody } from "@/components/app/AppShell";
import { EmptyState, ErrorId } from "@/components/app/EmptyState";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiFetch } from "@/lib/api/client";
import { formatClock, formatDate, formatDay, useNow } from "@/lib/time";
import { useState } from "react";
import { useSWRConfig } from "swr";

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
      <EmptyState
        icon="app/icon-lock-medium-26"
        tone="medium"
        title={`You don’t have access to ${caseId}`}
        className="h-[720px]"
        actions={
          <>
            <ButtonLink href="/cases" variant="secondary" size="md" iconLeft={<Icon name="app/icon-arrow-left-18" size={18} />}>
              Back to my cases
            </ButtonLink>
            <Button
              size="md"
              disabled={requested}
              onClick={async () => {
                // TODO(api): proposed POST /cases/{id}/access-requests.
                await apiFetch("POST", `/cases/${caseId}/access-requests`).catch(() => undefined);
                setRequested(true);
                toast({ tone: "success", title: "Access requested", body: "Your supervisor has been notified." });
              }}
              iconLeft={<Icon name="app/icon-send-white-18" size={18} />}
            >
              {requested ? "Access requested" : "Request access"}
            </Button>
          </>
        }
      >
        {problem?.detail ?? "This case is restricted. Ask for access and your supervisor will be notified."}
      </EmptyState>
    );
  } else if (status === 404) {
    const merged = problem?.merged_into as string | undefined;
    body = (
      <EmptyState
        icon="app/icon-search-secondary-26"
        tone="neutral"
        title={merged ? `${caseId} doesn’t exist any more` : `We can’t find ${caseId}`}
        className="h-[720px]"
        actions={
          <>
            <ButtonLink href="/cases" variant="secondary" size="md" iconLeft={<Icon name="app/icon-search-primary-18" size={18} />}>
              Search cases
            </ButtonLink>
            {merged && (
              <ButtonLink href={`/cases/${merged}`} size="md" iconRight={<Icon name="app/icon-arrow-right-white-16" size={16} />}>
                Open {merged}
              </ButtonLink>
            )}
          </>
        }
      >
        {merged
          ? `It was merged into ${merged} on ${formatDate(String(problem?.merged_at)).replace(/ \d{4}$/, "")} by ${problem?.merged_by}. Everything from it, alerts, notes and evidence, is now on ${merged}.`
          : "Check the case ID. It may have been typed wrong, or deleted under the retention policy."}
      </EmptyState>
    );
  } else {
    body = (
      <EmptyState
        icon="app/icon-alert-triangle-critical-26"
        tone="critical"
        title={`We couldn’t load case ${caseId}`}
        className="h-[620px]"
        actions={
          <>
            <Button size="md" onClick={() => mutate(`/cases/${caseId}`)} iconLeft={<Icon name="app/icon-refresh-white-18" size={18} />}>
              Try again
            </Button>
            <ButtonLink href="/queue" variant="secondary" size="md">
              Back to my queue
            </ButtonLink>
          </>
        }
        meta={problem?.request_id ? <ErrorId id={problem.request_id} at={`${formatDay(now)} ${formatClock(now)}`} /> : null}
      >
        Something went wrong on our side, not yours. Your draft note on this case was saved on this device and will come back when the page loads.
      </EmptyState>
    );
  }

  return (
    <>
      <AppHeader section="Cases" title={caseId} />
      <PageBody>{body}</PageBody>
    </>
  );
}

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
  const toast = useToast();
  const p = problem.problem as unknown as { title: string; detail: string; changes: Array<{ field: string; from: string; to: string }>; new_assignee?: { name: string } };
  const first = p.new_assignee?.name.split(" ")[0];
  return (
    <Modal
      open
      onClose={onClose}
      width={560}
      icon="app/icon-users-brand-18"
      tone="brand"
      title={p.title}
      description={p.detail}
      actions={
        <>
          <Button variant="ghost" size="md" onClick={onDiscard}>
            Discard note
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              void navigator.clipboard?.writeText(note);
              toast({ title: "Note copied" });
            }}
            iconLeft={<Icon name="app/icon-copy-primary-20" size={16} />}
          >
            Copy note
          </Button>
          <Button size="md" onClick={onPost} loading={busy} iconLeft={<Icon name="app/icon-send-white-18" size={16} />}>
            Post note{first ? ` for ${first}` : ""}
          </Button>
        </>
      }
    >
      <dl className="overflow-hidden rounded-[10px] border border-border-subtle bg-surface-raised">
        {p.changes.map((c) => (
          <div key={c.field} className="flex items-center gap-3 border-b border-border-subtle px-3.5 py-2.5 text-body-s last:border-b-0">
            <dt className="flex-1 text-text-secondary">{c.field}</dt>
            <dd className="flex items-center gap-2">
              <span className="text-text-tertiary">{c.from}</span>
              <Icon name="app/icon-arrow-right-tertiary-16" size={14} />
              <span className="text-label-m text-text-primary">{c.to}</span>
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-1 rounded-[10px] border border-border-subtle px-3.5 py-3">
        <p className="flex items-center gap-1.5 text-overline text-text-tertiary uppercase">
          <Icon name="app/icon-file-secondary-18" size={12} />
          Your unsaved note · kept
        </p>
        <p className="text-body-s text-text-primary">{note}</p>
      </div>
    </Modal>
  );
}
