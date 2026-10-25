"use client";

import { Skeleton } from "@/components/app/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { useApi, type Money, type Person } from "@/lib/api/fd";
import { formatMoney } from "@/lib/time";
import Link from "next/link";

type Card = {
  id: string;
  title: string;
  kind: "case" | "prospect";
  badge: string;
  badge_tone: BadgeTone;
  owner: Person | null;
  money: Money | null;
  note: string;
};
type Stage = { id: string; description: string; total: number; cards: Card[] };

const STAGE: Record<string, { label: string; icon: string }> = {
  prospect: { label: "Prospect", icon: "app/icon-search-brand-20" },
  investigate: { label: "Investigate", icon: "app/icon-folder-high-16" },
  decide: { label: "Decide", icon: "app/icon-check-square-medium-16" },
  monitor: { label: "Monitor", icon: "app/icon-activity-info-22" },
  closed: { label: "Closed", icon: "app/icon-check-circle-success-22" },
};

/** G2 · The stage board. TODO(api): proposed GET /cases?group_by=stage (and PATCH stage on drop). */
export function CaseBoard() {
  const { data, isLoading } = useApi<{ stages: Stage[] }>("/cases?group_by=stage");

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-5 gap-4" aria-busy>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-[110px] w-full rounded-xl" />
            <Skeleton className="h-[110px] w-full rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 items-start gap-4">
      {data.stages.map((s) => (
        <section key={s.id} aria-label={STAGE[s.id]?.label} className="flex min-w-0 flex-col gap-2.5">
          <header className="flex flex-col gap-1">
            <h3 className="flex items-center gap-2 text-title text-text-primary">
              <Icon name={STAGE[s.id]?.icon ?? "app/icon-folder-high-16"} size={16} />
              {s.id === "monitor" ? (
                <Link href="/cases/monitoring" className="rounded hover:underline">
                  {STAGE[s.id].label}
                </Link>
              ) : (
                STAGE[s.id]?.label
              )}
              <span className="rounded-full bg-surface-sunken px-1.5 text-caption font-medium text-text-tertiary">{s.total}</span>
            </h3>
            <p className="min-h-10 text-caption text-text-secondary">{s.description}</p>
          </header>
          {s.cards.map((c) => (
            <Link
              key={c.id}
              href={c.kind === "prospect" ? `/prospect/${c.id}` : `/cases/${c.id}`}
              className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface-base px-3.5 py-3 hover:border-border-default hover:shadow-sm"
            >
              <span className="flex items-center gap-2">
                <span className="font-mono text-mono-s text-text-secondary">{c.id}</span>
                <Badge label={c.badge} tone={c.badge_tone} />
              </span>
              <span className="text-label-m text-text-primary">{c.title}</span>
              <span className="flex items-center gap-2 text-caption text-text-secondary">
                {c.owner && <Avatar initials={c.owner.initials} />}
                <span className="font-mono text-mono-s text-text-primary">{c.money ? formatMoney(c.money.amount_minor, c.money.currency) : "–"}</span>
                {c.note}
              </span>
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}
