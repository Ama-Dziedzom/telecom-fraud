"use client";

import { EmptyState, ErrorId } from "@/components/app/EmptyState";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import type { ReactNode } from "react";

/**
 * I15–I18, I21 · Problems you can hit anywhere — presentation only; the
 * caller fetches, decides which one applies and wires the actions.
 * Full-page states fill the page body with one white card (Empty state /
 * Error state, neutral, never red).
 */

const PAGE = "min-h-[640px] flex-1";

/** I16 · No access · restricted case. */
export function NoAccessState({
  caseId,
  detail,
  requested,
  onRequest,
}: {
  caseId: string;
  /** From the API’s problem detail, or the app’s fallback. */
  detail?: ReactNode;
  requested?: boolean;
  onRequest: () => void;
}) {
  return (
    <EmptyState
      icon="app/icon-lock-secondary-18"
      title={`You don’t have access to ${caseId}`}
      className={PAGE}
      actions={
        <Button variant="secondary" size="md" disabled={requested} onClick={onRequest}>
          {requested ? "Access requested" : "Request access"}
        </Button>
      }
    >
      {detail ?? "This case is restricted. Ask for access and your supervisor is told."}
    </EmptyState>
  );
}

/** I17 · Case not found — or merged into another case, with the way there. */
export function NotFoundState({
  caseId,
  mergedInto,
  detail,
  searchHref = "/cases",
}: {
  caseId: string;
  mergedInto?: string;
  detail?: ReactNode;
  searchHref?: string;
}) {
  return (
    <EmptyState
      icon="app/icon-search-18"
      title={mergedInto ? `${caseId} was merged into ${mergedInto}` : `We can’t find case ${caseId}`}
      className={PAGE}
      actions={
        mergedInto ? (
          <>
            <ButtonLink href={searchHref} variant="secondary" size="md">
              Search cases
            </ButtonLink>
            <ButtonLink href={`/cases/${mergedInto}`} size="md">
              Open {mergedInto}
            </ButtonLink>
          </>
        ) : (
          <ButtonLink href={searchHref} variant="secondary" size="md">
            Search cases
          </ButtonLink>
        )
      }
    >
      {detail ?? "It may have been merged into another case, or the ID is mistyped."}
    </EmptyState>
  );
}

/** I18 · Something went wrong — one Retry, and the error ID to quote. */
export function LoadErrorState({
  what,
  detail,
  onRetry,
  errorId,
  at,
}: {
  /** “case FD-3050” → “We couldn’t load case FD-3050”. */
  what: string;
  detail?: ReactNode;
  onRetry: () => void;
  errorId?: string;
  /** “28 Oct, 09:42” */
  at?: string;
}) {
  return (
    <EmptyState
      icon="app/icon-alert-circle-tertiary-20"
      title={`We couldn’t load ${what}`}
      className={PAGE}
      actions={
        <Button variant="secondary" size="md" onClick={onRetry} iconLeft={<Icon name="app/icon-refresh-16" size={16} />}>
          Retry
        </Button>
      }
      meta={errorId ? <ErrorId id={errorId} at={at} /> : null}
    >
      {detail ?? "Something went wrong on our side."}
    </EmptyState>
  );
}

export type ConflictChange = { field: string; before: ReactNode; now: ReactNode };

/** I15 · Conflict · case changed while you were writing — what changed, and your note, kept. */
export function ConflictDialog({
  title,
  detail,
  changes,
  note,
  postLabel,
  busy,
  onPost,
  onDiscard,
  onClose,
}: {
  title: string;
  detail?: ReactNode;
  changes: ConflictChange[];
  note: string;
  /** “Post note for Kofi” */
  postLabel: string;
  busy?: boolean;
  onPost: () => void;
  onDiscard: () => void;
  onClose: () => void;
}) {
  const th = "h-10 px-4 text-caption font-normal text-text-secondary";
  return (
    <Modal
      open
      onClose={onClose}
      width={520}
      title={title}
      description={detail}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onDiscard}>
            Discard note
          </Button>
          <Button size="md" onClick={onPost} loading={busy}>
            {postLabel}
          </Button>
        </>
      }
    >
      <div className="overflow-hidden rounded-lg border border-border-default">
        <table className="w-full table-fixed text-left">
          <thead className="border-b border-border-default bg-surface-raised">
            <tr>
              <th scope="col" className={`${th} w-[40%]`}>Field</th>
              <th scope="col" className={`${th} w-[30%]`}>Before</th>
              <th scope="col" className={th}>Now</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => (
              <tr key={c.field} className="border-b border-border-default last:border-b-0">
                <td className="px-4 py-3 text-body-s text-text-secondary">{c.field}</td>
                <td className="px-4 py-3 text-body-s text-text-tertiary">
                  {c.before === "—" ? c.before : <s>{c.before}</s>}
                </td>
                <td className="px-4 py-3 text-body-s text-text-primary">{c.now}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-1 rounded-lg bg-surface-raised px-3 py-3">
        <p className="text-caption text-text-secondary">Your unsaved note · kept</p>
        <p className="text-body-s text-text-primary">{note}</p>
      </div>
    </Modal>
  );
}

/** I21 · Signed out — the session ended; drafts stay on this device. */
export function SignedOutDialog({ onSignIn }: { onSignIn: () => void }) {
  return (
    <Modal
      open
      onClose={onSignIn}
      width={420}
      title="You’re signed out"
      description="For your security, sign in again to carry on. Drafts you were writing are saved on this device."
      actions={
        <Button size="md" fullWidth onClick={onSignIn}>
          Sign in again
        </Button>
      }
    />
  );
}
