"use client";

import { EmptyState } from "@/components/app/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { markAllNotificationsRead, useNotifications, type Notification } from "@/lib/api/fd";
import { cn } from "@/lib/cn";
import { formatAgo, useNow } from "@/lib/time";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Chips } from "./Chips";

/** Neutral icon per `kind` (most specific first), so the row says what happened without colour. */
const ICON: Array<[RegExp, string]> = [
  [/^case\.sent_back|^comment|^note/, "app/icon-message-18"],
  [/^mention/, "app/icon-users-secondary-16"],
  [/^sla/, "app/icon-timer-secondary-18"],
  [/^report/, "app/icon-file-secondary-18"],
  [/^rule/, "app/icon-sliders-secondary-16"],
  [/^connector|^system/, "app/icon-plug-secondary-16"],
  [/^handover/, "app/icon-users-secondary-16"],
];
const iconFor = (kind: string) => ICON.find(([re]) => re.test(kind))?.[1] ?? "app/icon-folder-secondary-16";

/** 2 min ago · 3 h ago · Yesterday · 18 Oct */
function ago(iso: string, now: number) {
  const m = Math.max(1, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 60) return `${m} min ago`;
  const text = formatAgo(iso, now);
  return text.endsWith("h ago") ? text.replace("h ago", " h ago") : text;
}

/** Notification item (1343:269527) — neutral icon, title, body, time; brand dot while unread. */
export function NoticeRow({ n, now, onOpen }: { n: Notification; now: number; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-sunken">
      <span className="icon-tint flex shrink-0 pt-0.5 text-text-secondary">
        <Icon name={iconFor(n.kind)} size={16} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-label-s", n.read ? "text-text-secondary" : "text-text-primary")}>{n.title}</span>
        {n.body && <span className="text-body-s text-text-secondary">{n.body}</span>}
        <span className="text-caption text-text-tertiary">{ago(n.at, now)}</span>
      </span>
      {!n.read ? <span aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-primary" /> : <span className="w-2 shrink-0" />}
    </button>
  );
}

type Tab = "all" | "mentions" | "cases" | "system";

/** I3/I4 · Notifications — unread on top, “Earlier” below; all caught up when there’s nothing. */
export function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const now = useNow();
  const [tab, setTab] = useState<Tab>("all");
  const { data } = useNotifications();
  const all = data?.data ?? [];
  const list = all.filter((n) => tab === "all" || n.category === tab);
  const fresh = list.filter((n) => !n.read);
  const earlier = list.filter((n) => n.read);
  const unreadIn = (c: Tab) => all.filter((n) => !n.read && (c === "all" || n.category === c)).length;

  const open = (n: Notification) => {
    onClose();
    router.push(n.link);
  };

  return (
    <div
      role="dialog"
      aria-label="Notifications"
      className="absolute top-[calc(100%+8px)] right-0 z-50 flex max-h-[720px] w-[400px] flex-col overflow-hidden rounded-xl border border-border-default bg-surface-base shadow-lg"
    >
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-title text-text-primary">Notifications</h2>
          {!!data?.unread && (
            <button
              type="button"
              onClick={() => void markAllNotificationsRead(now).catch(() => undefined)}
              className="rounded text-label-s text-text-brand hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <Chips
          label="Notification type"
          value={tab}
          onChange={setTab}
          options={[
            { id: "all", label: "All", count: unreadIn("all") },
            { id: "mentions", label: "Mentions", count: unreadIn("mentions") },
            { id: "cases", label: "Cases" },
            { id: "system", label: "System" },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {data && list.length === 0 ? (
          <EmptyState bare icon="app/icon-check-circle-tertiary-18" title="You’re all caught up" className="py-12">
            New mentions, sign-off decisions and SLA warnings show up here.
          </EmptyState>
        ) : (
          <>
            {fresh.map((n) => (
              <NoticeRow key={n.id} n={n} now={now} onOpen={() => open(n)} />
            ))}
            {earlier.length > 0 && <p className="px-4 pt-3 pb-1 text-caption text-text-secondary">Earlier</p>}
            {earlier.map((n) => (
              <NoticeRow key={n.id} n={n} now={now} onOpen={() => open(n)} />
            ))}
          </>
        )}
      </div>
      <Link
        href="/notifications"
        onClick={onClose}
        className="border-t border-border-default px-4 py-3 text-center text-label-s text-text-brand hover:underline"
      >
        View all notifications
      </Link>
    </div>
  );
}
