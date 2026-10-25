"use client";

import { Skeleton } from "@/components/app/Card";
import { CaseStatusBadge, RiskScore, SlaLabel } from "@/components/app/indicators";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { Icon } from "@/components/ui/Icon";
import { fraudTypeLabel, type CaseSummary } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatSpan } from "@/lib/time";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** G1/G3/G4/G6 · Cases table — mine & all show the assignee; the team queue shows waiting time and “Pick up”. */
export function CaseTable({
  rows,
  loading,
  team,
  now,
  selected,
  onSelect,
  onPickUp,
  picking,
}: {
  rows: CaseSummary[];
  loading: boolean;
  team: boolean;
  now: number;
  selected: Set<string>;
  onSelect: (next: Set<string>) => void;
  onPickUp: (ids: string[]) => void;
  picking: string | null;
}) {
  const router = useRouter();
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const some = rows.some((r) => selected.has(r.id));
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onSelect(next);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface-base">
      <table className="w-full table-fixed text-left">
        <thead className="border-b border-border-subtle bg-surface-raised">
          <tr className="text-overline text-text-tertiary uppercase">
            <th className="w-[54px] py-[11px] pl-5">
              <Checkbox
                label="Select all"
                hideLabel
                checked={all}
                indeterminate={some && !all}
                onChange={(e) => onSelect(new Set(e.target.checked ? rows.map((r) => r.id) : []))}
              />
            </th>
            <th className="w-[110px] py-[11px] font-bold">Case</th>
            <th className="w-[190px] py-[11px] font-bold">Subscriber</th>
            <th className="py-[11px] font-bold">Type</th>
            <th className="w-[130px] py-[11px] font-bold">Risk</th>
            <th className="w-[170px] py-[11px] font-bold">Status</th>
            <th className="w-[170px] py-[11px] font-bold">{team ? "Waiting" : "Assignee"}</th>
            <th className="w-[90px] py-[11px] font-bold">Alerts</th>
            <th className="w-[150px] py-[11px] font-bold">SLA</th>
            <th className="w-[100px] py-[11px] pr-5">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: 6 }, (_, i) => (
              <tr key={i} className="border-b border-border-subtle last:border-b-0" aria-hidden>
                <td className="py-4 pl-5">
                  <Skeleton className="size-[18px] rounded-[5px]" />
                </td>
                {[70, 130, 140, 70, 100, 110, 30, 80].map((w, j) => (
                  <td key={j} className="py-4">
                    <span className="block" style={{ width: w }}>
                      <Skeleton className="h-3 w-full" />
                    </span>
                  </td>
                ))}
                <td />
              </tr>
            ))}
          {!loading &&
            rows.map((c) => {
              const on = selected.has(c.id);
              return (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/cases/${c.id}`)}
                  className={cn("cursor-pointer border-b border-border-subtle last:border-b-0", on ? "bg-brand-primary-subtle/50" : "hover:bg-[#fbfaff]")}
                >
                  <td className="py-3.5 pl-5" onClick={(e) => e.stopPropagation()}>
                    <Checkbox label={`Select ${c.id}`} hideLabel checked={on} onChange={(e) => toggle(c.id, e.target.checked)} />
                  </td>
                  <td className="py-3.5">
                    <Link href={`/cases/${c.id}`} onClick={(e) => e.stopPropagation()} className="rounded font-mono text-mono-m font-semibold text-text-primary">
                      {c.id}
                    </Link>
                  </td>
                  <td className="truncate py-3.5 font-mono text-mono-m text-text-secondary">{c.subscriber.msisdn}</td>
                  <td className="truncate py-3.5 pr-3 text-body-m text-text-primary">{c.title || fraudTypeLabel(c.fraud_type)}</td>
                  <td className="py-3.5">
                    <RiskScore score={c.risk_score} />
                  </td>
                  <td className="py-3.5">
                    <CaseStatusBadge status={c.status} />
                  </td>
                  <td className="py-3.5 text-body-s">
                    {team ? (
                      <span className="text-text-secondary">{formatSpan(now - Date.parse(c.waiting_since)).replace(/m$/, " min").replace(/^(\d+)h 00 min$/, "$1 h")}</span>
                    ) : c.assignee ? (
                      <span className="flex items-center gap-2 text-text-primary">
                        <Avatar initials={c.assignee.initials} />
                        {c.assignee.name}
                      </span>
                    ) : (
                      <span className="text-text-tertiary">Unassigned</span>
                    )}
                  </td>
                  <td className="py-3.5 text-body-m text-text-secondary">{c.alerts}</td>
                  <td className="py-3.5">{c.sla_due_at ? <SlaLabel dueAt={c.sla_due_at} now={now} /> : <span className="text-text-tertiary">—</span>}</td>
                  <td className="py-3.5 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
                    {team ? (
                      <Button variant="secondary" size="sm" loading={picking === c.id} onClick={() => onPickUp([c.id])}>
                        Pick up
                      </Button>
                    ) : (
                      <Link href={`/cases/${c.id}`} aria-label={`Open ${c.id}`} className="inline-flex rounded p-1">
                        <Icon name="app/icon-chevron-right-16" size={16} />
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}

/** “‹ 1 2 3 … 13 ›” + rows per page. The mock has one page; the control is real. */
export function Pagination({ summary, page, pages, onPage }: { summary: string; page: number; pages: number; onPage: (p: number) => void }) {
  const items: Array<number | "…"> = pages <= 5 ? Array.from({ length: pages }, (_, i) => i + 1) : [1, 2, 3, "…", pages];
  return (
    <div className="flex items-center justify-between">
      <span className="text-caption text-text-secondary">{summary}</span>
      <nav aria-label="Pages" className="flex items-center gap-1">
        <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => onPage(page - 1)} className="flex size-8 items-center justify-center rounded-lg disabled:opacity-40">
          <Icon name="app/icon-chevron-left-16" size={14} />
        </button>
        {items.map((p, i) =>
          p === "…" ? (
            <span key={i} className="px-1.5 text-caption text-text-tertiary">
              …
            </span>
          ) : (
            <button
              key={i}
              type="button"
              aria-current={p === page ? "page" : undefined}
              onClick={() => onPage(p)}
              className={cn("flex size-8 items-center justify-center rounded-lg text-label-s", p === page ? "bg-brand-primary text-text-inverse" : "text-text-secondary hover:bg-surface-sunken")}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" aria-label="Next page" disabled={page === pages} onClick={() => onPage(page + 1)} className="flex size-8 items-center justify-center rounded-lg disabled:opacity-40">
          <Icon name="app/icon-chevron-right-16" size={14} />
        </button>
      </nav>
      <label className="flex items-center gap-2 text-caption text-text-secondary">
        Rows per page
        <span className="relative flex h-9 items-center rounded-lg border border-border-default bg-surface-base pr-7 pl-3">
          <select defaultValue="25" className="appearance-none bg-transparent text-body-s text-text-primary outline-none focus-visible:shadow-none">
            <option>25</option>
            <option>50</option>
            <option>100</option>
          </select>
          <Icon name="app/icon-chevron-down-16" size={14} className="pointer-events-none absolute right-2" />
        </span>
      </label>
    </div>
  );
}
