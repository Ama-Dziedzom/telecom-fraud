"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody } from "@/components/app/AppShell";
import { Skeleton } from "@/components/app/Card";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useApi } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/time";
import { useSearchParams } from "next/navigation";

type Watch = {
  case_id: string;
  title: string;
  entities_summary: string;
  days_left: number;
  days_total: number;
  status: "quiet" | "near_miss" | "reopened";
  near_misses: number;
  reopened_at?: string;
  repeat_detail?: string;
};

const STEPS = ["Prospect", "Investigate", "Decide", "Monitor", "Closed"];

/** F2/F3 · Monitoring — closed cases still on watch. A repeat reopens the case. */
export default function MonitoringPage() {
  const params = useSearchParams();
  // `?repeat=1` shows the reopened state (F3) in mock mode.
  // TODO(api): GET /watchlist exists; title, entities_summary, days_total, status and near_misses are proposed.
  const { data, isLoading } = useApi<{ data: Watch[]; totals: { cases: number; watched: number } }>(`/watchlist?limit=25${params.get("repeat") ? "&repeat=1" : ""}`);
  const repeat = data?.data.find((w) => w.status === "reopened");

  return (
    <>
      <AppHeader section="Cases" title="Monitoring" />
      <PageBody>
        <ol className="flex items-center gap-2" aria-label="Stage">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden className={cn("h-px w-8", i <= 3 ? "bg-brand-primary" : "bg-border-default")} />}
              <span
                aria-current={s === "Monitor" ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 text-label-s",
                  s === "Monitor" ? "bg-brand-primary text-text-inverse" : i < 3 ? "bg-brand-primary-subtle text-text-brand" : "text-text-tertiary",
                )}
              >
                {i < 3 && <Icon name="app/icon-check-brand-22" size={12} />}
                {s}
              </span>
            </li>
          ))}
        </ol>

        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="flex items-center gap-2.5 text-h2 text-text-primary">
              Monitoring
              {data && <Badge label={`${data.totals.cases} cases · ${data.totals.watched} things watched`} tone="neutral" />}
            </h2>
            <p className="text-body-s text-text-secondary">Closed cases we’re still watching. A repeat reopens the case.</p>
          </div>
          <ButtonLink href="/cases?layout=board" variant="secondary" size="md" iconLeft={<Icon name="app/icon-grid-18" size={18} />}>
            Back to board
          </ButtonLink>
        </div>

        {repeat && (
          <Banner tone="error" title={`${repeat.case_id} reopened at ${formatClock(repeat.reopened_at!)}`}>
            {repeat.repeat_detail}
          </Banner>
        )}

        <ul className="flex flex-col gap-3">
          {isLoading &&
            Array.from({ length: 5 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-[72px] w-full rounded-xl" />
              </li>
            ))}
          {data?.data.map((w) => {
            const hot = w.status === "reopened";
            return (
              <li
                key={w.case_id}
                className={cn("flex items-center gap-4 rounded-xl border px-4 py-3.5", hot ? "border-critical-border bg-critical-bg" : "border-border-subtle bg-surface-base")}
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px]", hot ? "" : "bg-info-bg")}>
                  <Icon name={hot ? "icon-alert-triangle-critical-24" : "app/icon-activity-info-22"} size={18} />
                </span>
                <span className="flex w-[400px] flex-col">
                  <span className="flex items-center gap-2 text-label-m text-text-primary">
                    <span className="font-mono text-mono-s text-text-secondary">{w.case_id}</span>
                    {w.title}
                  </span>
                  <span className="text-caption text-text-secondary">{w.entities_summary}</span>
                </span>
                <span className="flex w-[220px] flex-col gap-1">
                  <span className="h-1.5 w-full rounded-full bg-surface-sunken">
                    <span className={cn("block h-1.5 rounded-full", hot ? "bg-critical-fg" : "bg-brand-highlight")} style={{ width: `${(w.days_left / w.days_total) * 100}%` }} />
                  </span>
                  <span className="text-caption text-text-tertiary">
                    {w.days_left} of {w.days_total} days left
                  </span>
                </span>
                <span className="flex-1" />
                {hot ? (
                  <>
                    <span className="flex items-center gap-1.5 text-caption font-medium text-critical-fg">
                      <span className="size-1.5 rounded-full bg-critical-fg" />
                      Repeat · reopened
                    </span>
                    <ButtonLink href={`/cases/${w.case_id}`} size="sm">
                      Open case
                    </ButtonLink>
                  </>
                ) : (
                  <>
                    <Badge label={w.near_misses ? `${w.near_misses} near-misses` : "No repeats"} tone={w.near_misses ? "medium" : "success"} dot />
                    <ButtonLink href={`/cases/${w.case_id}`} variant="secondary" size="sm">
                      Details
                    </ButtonLink>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </PageBody>
    </>
  );
}
