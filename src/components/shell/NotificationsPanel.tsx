"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { markAllNotificationsRead, useNotifications, type Notification } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatClockOrDay, useNow } from "@/lib/time";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Icon and tile for notifications without a person behind them, by the first part of `kind`. */
const ICON: Record<string, [string, string]> = {
  case: ["app/icon-folder-brand-16", "bg-brand-primary-subtle"],
  sla: ["app/icon-timer-medium-16", "bg-medium-bg"],
  report: ["app/icon-file-success-16", "bg-success-bg"],
  rule: ["app/icon-sliders-secondary-16", "bg-surface-sunken"],
  connector: ["app/icon-plug-secondary-16", "bg-surface-sunken"],
};
const iconFor = (kind: string) => ICON[kind.split(".")[0]] ?? ICON.case;

const ago = (iso: string, now: number) => {
  const m = Math.max(1, Math.round((now - Date.parse(iso)) / 60_000));
  return m < 60 ? `${m}m` : m < 60 * 12 ? `${Math.round(m / 60)}h` : formatClockOrDay(iso, now);
};

export function NoticeRow({ n, now, onOpen }: { n: Notification; now: number; onOpen: () => void }) {
  const [icon, tile] = iconFor(n.kind);
  return (
    <button type="button" onClick={onOpen} className={cn("flex w-full items-start gap-3 border-t border-border-subtle px-[18px] py-3 text-left hover:bg-surface-raised", !n.read && "bg-[#fbfaff]")}>
      {n.actor ? (
        <Avatar initials={n.actor.initials} />
      ) : (
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", tile)}>
          <Icon name={icon} size={16} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className={cn("text-body-m font-medium", n.read ? "text-text-secondary" : "text-text-primary")}>{n.title}</span>
        {n.body && <span className="text-body-s text-text-secondary">{n.body}</span>}
        <span className="text-caption text-text-tertiary">{ago(n.at, now)}</span>
      </span>
      {!n.read && <span aria-label="Unread" className="mt-2 size-2 shrink-0 rounded-full bg-brand-primary" />}
    </button>
  );
}

/** I3/I4 · Notifications — newest first, unread on top, “Earlier” below. */
export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const now = useNow();
  const [tab, setTab] = useState<"all" | "mentions" | "cases" | "system">("all");
  const { data } = useNotifications();
  const list = (data?.data ?? []).filter((n) => tab === "all" || n.category === tab);
  const fresh = list.filter((n) => !n.read);
  const earlier = list.filter((n) => n.read);
  const mentions = data?.data.filter((n) => n.category === "mentions" && !n.read).length ?? 0;

  const markAll = async () => {
    await markAllNotificationsRead(now).catch(() => undefined);
  };
  const open = (n: Notification) => {
    onClose();
    router.push(n.link);
  };

  return (
    <div role="dialog" aria-label="Notifications" className="absolute top-[calc(100%+8px)] right-0 z-50 flex max-h-[760px] w-[440px] flex-col overflow-hidden rounded-[14px] border border-border-default bg-surface-base shadow-lg">
      <div className="flex items-center justify-between px-[18px] pt-4 pb-2.5">
        <h2 className="flex items-center gap-2 text-title text-text-primary">
          Notifications
          {!!data?.unread && <span className="rounded-full bg-critical-fg px-[7px] py-px text-caption font-medium text-text-inverse">{data.unread}</span>}
        </h2>
        <span className="flex items-center gap-3">
          {!!data?.unread && (
            <button type="button" onClick={markAll} className="rounded text-label-s text-text-brand hover:underline">
              Mark all read
            </button>
          )}
          <Link href="/account/notifications" onClick={onClose} aria-label="Notification preferences" className="flex rounded">
            <Icon name="app/icon-sliders-secondary-16" size={16} />
          </Link>
        </span>
      </div>
      <div role="tablist" aria-label="Notification type" className="mx-[18px] flex gap-5 border-b border-border-default">
        {(
          [
            ["all", "All"],
            ["mentions", "Mentions"],
            ["cases", "Cases"],
            ["system", "System"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn("-mb-px flex items-center gap-2 border-b-2 px-1 py-3 text-label-m", tab === id ? "border-brand-primary text-text-brand" : "border-transparent text-text-secondary")}
          >
            {label}
            {id === "mentions" && mentions > 0 && <span className="rounded-full bg-surface-sunken px-[7px] py-px text-caption">{mentions}</span>}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {data && list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-8 py-9 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-success-bg">
              <Icon name="app/icon-check-circle-success-22" size={20} />
            </span>
            <p className="text-h3 text-text-primary">You’re all caught up</p>
            <p className="text-body-s text-text-secondary">New mentions, sign-off decisions and SLA warnings will show here.</p>
          </div>
        ) : (
          <>
            {fresh.map((n) => (
              <NoticeRow key={n.id} n={n} now={now} onOpen={() => open(n)} />
            ))}
            {earlier.length > 0 && <p className="px-[18px] pt-2.5 pb-1 text-overline text-text-tertiary uppercase">Earlier</p>}
            {earlier.map((n) => (
              <NoticeRow key={n.id} n={n} now={now} onOpen={() => open(n)} />
            ))}
          </>
        )}
      </div>
      <Link href="/notifications" onClick={onClose} className="border-t border-border-subtle bg-surface-raised px-[18px] py-3 text-center text-label-s text-text-brand hover:underline">
        View all notifications
      </Link>
    </div>
  );
}
