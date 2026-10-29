"use client";

import { CaseStatusBadge, RiskScore, SlaLabel } from "@/components/app/indicators";
import { Avatar } from "@/components/ui/Avatar";
import { fraudTypeLabel, type CaseSummary } from "@/lib/api/fd";
import { formatSpan } from "@/lib/time";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useToast } from "@/components/ui/Toast";
import { CheckCell, DataTable, RowMenu, SkeletonRows, Td, Th, rowClass, type RowMenuItem } from "./Table";

/** “+233 54 *** 3457” → “054 *** 3457”; agents and wallets pass through. */
export const localMsisdn = (msisdn: string) => msisdn.replace(/^\+233\s?(\d{2})\s?/, "0$1 ");

export type CaseSort = "risk" | "sla";

/**
 * G1/G3/G4/G6 · Cases table — My cases and All cases show status and assignee;
 * the team queue shows waiting time and alerts instead. The body slot takes
 * the loading (G7), empty (G8) and error (G9) states; `footer` is Pagination.
 */
export function CaseTable({
  rows,
  loading,
  team,
  scope,
  now,
  selected,
  onSelect,
  onPickUp,
  onNote,
  onWatch,
  sort,
  onSort,
  state,
  footer,
}: {
  rows: CaseSummary[];
  loading: boolean;
  team: boolean;
  /** Which list the row menu is for (G35–G37). */
  scope: "mine" | "team" | "all";
  now: number;
  selected: Set<string>;
  onSelect: (next: Set<string>) => void;
  onPickUp: (ids: string[]) => void;
  onNote: (ids: string[]) => void;
  onWatch: (c: CaseSummary) => void;
  sort: CaseSort;
  onSort: (s: CaseSort) => void;
  /** Replaces the rows with an empty or error state. */
  state?: (colSpan: number) => ReactNode;
  footer?: ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();

  /** G35 My cases · G36 Team queue · G37 All cases — row actions. Case-page dialogs open there via `?action=`. */
  const rowActions = (c: CaseSummary): RowMenuItem[] => {
    const open: RowMenuItem = { title: "Open case", icon: "app/menu-open-16", onSelect: () => router.push(`/cases/${c.id}`) };
    const copy: RowMenuItem = {
      title: "Copy case ID",
      icon: "app/menu-copy-16",
      onSelect: () =>
        void navigator.clipboard
          .writeText(c.id)
          .then(() => toast({ tone: "success", title: `${c.id} copied` }))
          .catch(() => toast({ title: "Couldn’t copy", body: `Select ${c.id} and copy it instead.` })),
    };
    const exportCase: RowMenuItem = {
      title: "Export case",
      icon: "app/menu-export-16",
      onSelect: () => window.open(`/print/cases/${c.id}`, "_blank"),
    };
    const onCase = (action: string) => () => router.push(`/cases/${c.id}?action=${action}`);
    if (scope === "team") return [{ title: "Assign to me", icon: "app/menu-assign-16", onSelect: () => onPickUp([c.id]) }, open, copy];
    if (scope === "all") return [open, copy, exportCase, { title: "Add to watchlist", icon: "app/menu-watch-16", onSelect: () => onWatch(c) }];
    return [
      open,
      { title: "Add a note", icon: "app/menu-note-16", onSelect: () => onNote([c.id]) },
      { title: "Hand to a colleague", icon: "app/menu-hand-16", onSelect: onCase("handover") },
      { title: "Escalate to supervisor", icon: "app/menu-escalate-16", onSelect: onCase("escalate") },
      copy,
      exportCase,
      ...(c.status === "closed"
        ? []
        : [{ title: "Close as false positive", icon: "app/menu-close-fp-16", tone: "critical" as const, onSelect: onCase("false_positive") }]),
    ];
  };

  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const some = rows.some((r) => selected.has(r.id));
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onSelect(next);
  };
  const cols = 9;

  return (
    <DataTable footer={footer}>
      <colgroup>
        <col className="w-12" />
        <col className="w-[120px]" />
        <col className="w-[160px]" />
        <col />
        <col className="w-[150px]" />
        <col className={team ? "w-[120px]" : "w-[170px]"} />
        <col className={team ? "w-[90px]" : "w-[180px]"} />
        <col className="w-[150px]" />
        <col className="w-14" />
      </colgroup>
      <thead>
        <tr>
          <CheckCell head label="Select all" checked={all} indeterminate={some && !all} onChange={(on) => onSelect(new Set(on ? rows.map((r) => r.id) : []))} />
          <Th>Case</Th>
          <Th>Subscriber</Th>
          <Th>Type</Th>
          <Th align="right" sorted={sort === "risk"} sortable onSort={() => onSort("risk")}>
            Risk
          </Th>
          <Th>{team ? "Waiting" : "Status"}</Th>
          <Th align={team ? "right" : "left"}>{team ? "Alerts" : "Assignee"}</Th>
          <Th sorted={sort === "sla"} sortable onSort={() => onSort("sla")}>
            SLA
          </Th>
          <Th>
            <span className="sr-only">Actions</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <SkeletonRows widths={[52, [160, 52], 120, "pill", 80, "person", 52, 0]} />
        ) : state ? (
          state(cols)
        ) : (
          rows.map((c) => {
            const on = selected.has(c.id);
            return (
              <tr key={c.id} onClick={() => router.push(`/cases/${c.id}`)} className={rowClass(on)}>
                <CheckCell label={`Select ${c.id}`} checked={on} onChange={(v) => toggle(c.id, v)} />
                <Td>
                  <Link href={`/cases/${c.id}`} onClick={(e) => e.stopPropagation()} className="rounded font-mono text-mono-m text-text-primary">
                    {c.id}
                  </Link>
                </Td>
                <Td>{localMsisdn(c.subscriber.msisdn)}</Td>
                <Td>{c.title || fraudTypeLabel(c.fraud_type)}</Td>
                <Td clip={false}>
                  <span className="flex justify-end">
                    <span className="w-[104px]">
                      <RiskScore score={c.risk_score} />
                    </span>
                  </span>
                </Td>
                {team ? (
                  <Td>
                    {formatSpan(now - Date.parse(c.waiting_since))
                      .replace(/^(\d+)m$/, "$1 min")
                      .replace(/^(\d+)h 00m$/, "$1 h")}
                  </Td>
                ) : (
                  <Td clip={false}>
                    <CaseStatusBadge status={c.status} />
                  </Td>
                )}
                {team ? (
                  <Td align="right">{c.alerts}</Td>
                ) : (
                  <Td>
                    {c.assignee ? (
                      <span className="flex items-center gap-2">
                        <Avatar initials={c.assignee.initials} />
                        <span className="truncate">{c.assignee.name}</span>
                      </span>
                    ) : (
                      <span className="text-text-tertiary">Unassigned</span>
                    )}
                  </Td>
                )}
                <Td>{c.sla_due_at ? <SlaLabel dueAt={c.sla_due_at} now={now} /> : <span className="text-text-tertiary">–</span>}</Td>
                <Td clip={false} className="pr-3">
                  <RowMenu label={`Actions for ${c.id}`} items={rowActions(c)} />
                </Td>
              </tr>
            );
          })
        )}
      </tbody>
    </DataTable>
  );
}
