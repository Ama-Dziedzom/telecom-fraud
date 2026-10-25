"use client";

import { RequestError } from "@/components/auth/RequestError";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { TextArea } from "@/components/ui/TextField";
import { apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/fd";
import type { User } from "@/lib/auth/api";
import { cn } from "@/lib/cn";
import { formatClock, formatDay, useNow } from "@/lib/time";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const ROLE: Record<string, string> = { fraud_analyst: "Fraud Analyst", fraud_supervisor: "Fraud Supervisor" };

/** “08:00-16:00” → minutes left until the end, or null when off shift. */
function shiftLeft(shift: string | undefined, now: number) {
  const m = shift?.match(/(\d\d):(\d\d)-(\d\d):(\d\d)/);
  if (!m) return null;
  const d = new Date(now);
  const local = (d.getUTCHours() * 60 + d.getUTCMinutes()) % 1440; // Accra is UTC+0
  const start = +m[1] * 60 + +m[2];
  const end = +m[3] * 60 + +m[4];
  return local >= start && local < end ? end - local : null;
}

/** I5 · Profile menu — who you are, your shift, settings and sign-out. */
export function ProfileMenu({
  user,
  operator,
  onHandover,
  onShortcuts,
  onSignOut,
  onClose,
}: {
  user: User | null;
  operator: string;
  onHandover: () => void;
  onShortcuts: () => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const now = useNow();
  const left = shiftLeft((user as (User & { shift?: string }) | null)?.shift, now);
  const shift = (user as (User & { shift?: string }) | null)?.shift ?? "08:00-16:00";
  const base = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-left text-body-m font-medium hover:bg-surface-sunken";
  const item = `${base} text-text-primary`;
  return (
    <div role="menu" aria-label="Account" className="absolute bottom-[calc(100%+8px)] left-0 z-50 flex w-[300px] flex-col gap-0.5 rounded-xl border border-border-default bg-surface-base p-1.5 shadow-lg">
      <div className="flex flex-col gap-2.5 px-2.5 pt-3 pb-2">
        <span className="flex items-center gap-2.5">
          <Avatar initials={user?.name.split(" ").map((p) => p[0]).join("") ?? "–"} />
          <span className="flex min-w-0 flex-col">
            <span className="text-label-m text-text-primary">{user?.name}</span>
            <span className="truncate text-caption text-text-secondary">{user?.email}</span>
          </span>
        </span>
        <span className="flex gap-1.5">
          <Badge label={ROLE[user?.role ?? ""] ?? "Analyst"} tone="neutral" />
          <Badge label={operator} tone="neutral" />
        </span>
      </div>
      <hr className="border-border-subtle" />
      <p className="px-2.5 pt-2 pb-1 text-overline text-text-tertiary uppercase">Shift</p>
      <div className={cn("flex items-start gap-2.5 rounded-lg px-2.5 py-[9px]", left !== null && "bg-surface-sunken")}>
        <Icon name="app/icon-clock-secondary-18" size={18} />
        <span className="flex flex-col gap-0.5">
          <span className="text-body-m font-medium text-text-primary">
            {left !== null ? "On shift" : "Off shift"} · {shift}
          </span>
          {left !== null && (
            <span className="text-caption text-text-secondary">
              Ends in {Math.floor(left / 60)}h {String(left % 60).padStart(2, "0")}m
            </span>
          )}
        </span>
      </div>
      <button type="button" role="menuitem" onClick={onHandover} className={item}>
        <Icon name="app/icon-users-secondary-18" size={18} />
        <span className="flex-1">Hand over shift…</span>
        <span className="font-mono text-mono-s text-text-tertiary">⌘ Shift H</span>
      </button>
      <hr className="my-0.5 border-border-subtle" />
      {(
        [
          ["/account", "app/icon-user-secondary-18", "Account settings"],
          ["/account/security", "app/icon-shield-secondary-18", "Security & sign-in"],
          ["/account/notifications", "app/icon-bell-secondary-18", "Notification preferences"],
        ] as const
      ).map(([href, icon, label]) => (
        <Link key={href} href={href} role="menuitem" onClick={onClose} className={item}>
          <Icon name={icon} size={18} />
          {label}
        </Link>
      ))}
      <button type="button" role="menuitem" onClick={onShortcuts} className={item}>
        <Icon name="app/icon-command-secondary-18" size={18} />
        <span className="flex-1">Keyboard shortcuts</span>
        <span className="font-mono text-mono-s text-text-tertiary">?</span>
      </button>
      <hr className="my-0.5 border-border-subtle" />
      <button type="button" role="menuitem" onClick={onSignOut} className={`${base} text-critical-fg`}>
        <Icon name="app/icon-logout-critical-18" size={18} />
        Sign out
      </button>
    </div>
  );
}

const Kbd = ({ k }: { k: string }) => (
  <kbd className="rounded-md border border-border-default bg-surface-sunken px-[7px] py-[3px] text-caption font-medium text-text-secondary">{k}</kbd>
);

const SHORTCUTS: Array<[string, Array<[string, string[]]>]> = [
  [
    "Anywhere",
    [
      ["Search MSISDN, case or IMEI", ["⌘", "K"]],
      ["Show this list", ["?"]],
      ["Go to my queue", ["G", "then", "Q"]],
      ["Go to live alerts", ["G", "then", "A"]],
      ["Go to cases", ["G", "then", "C"]],
      ["Go to heatmap", ["G", "then", "H"]],
    ],
  ],
  [
    "Live alerts",
    [
      ["Next / previous alert", ["J", "K"]],
      ["Open alert", ["↵"]],
      ["Pick up alert", ["C"]],
      ["Dismiss as false positive", ["D"]],
      ["Escalate", ["E"]],
    ],
  ],
  [
    "Inside a case",
    [
      ["Add a note", ["N"]],
      ["Mention someone", ["@"]],
      ["Request action", ["R"]],
      ["Switch tab", ["1", "–", "6"]],
      ["Close panel or dialog", ["Esc"]],
    ],
  ],
];

/** I11 · Keyboard shortcuts. */
export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const group = ([title, rows]: (typeof SHORTCUTS)[number]) => (
    <div key={title} className="flex flex-col">
      <p className="text-overline text-text-tertiary uppercase">{title}</p>
      {rows.map(([label, keys]) => (
        <div key={label} className="flex items-center gap-2 py-2">
          <span className="flex-1 text-body-s text-text-primary">{label}</span>
          {keys.map((k, i) => (k === "then" ? <span key={i} className="text-caption text-text-tertiary">then</span> : <Kbd key={i} k={k} />))}
        </div>
      ))}
    </div>
  );
  return (
    <Modal
      open
      onClose={onClose}
      width={760}
      icon="app/icon-command-brand-22"
      tone="brand"
      title="Keyboard shortcuts"
      description="Press ? anywhere to open this list."
      actions={
        <Button size="md" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="flex gap-8">
        <div className="flex flex-1 flex-col">{group(SHORTCUTS[0])}</div>
        <div className="flex flex-1 flex-col gap-6">
          {group(SHORTCUTS[1])}
          {group(SHORTCUTS[2])}
        </div>
      </div>
    </Modal>
  );
}

type Help = {
  status: { state: string; summary: string };
  guides: Array<{ id: string; title: string; detail: string; icon: string }>;
  contacts: Array<{ id: string; title: string; detail: string; icon: string }>;
};
const HELP_ICON: Record<string, string> = {
  alert: "app/icon-alert-triangle-brand-16",
  folder: "app/icon-folder-brand-16",
  refresh: "app/icon-refresh-brand-16",
  activity: "app/icon-activity-brand-16",
  command: "app/icon-command-brand-16",
  bell: "app/icon-bell-brand-16",
  lock: "app/icon-lock-brand-16",
  message: "app/icon-message-brand-16",
};

/** I12 · Help & support — guides for your role, system status and who to contact. */
export function HelpDrawer({ onClose, onShortcuts, onFeedback }: { onClose: () => void; onShortcuts: () => void; onFeedback: () => void }) {
  // TODO(api): proposed GET /help (guides for the role + integration status).
  const { data } = useApi<Help>("/help");
  const [q, setQ] = useState("");
  const match = (t: { title: string; detail: string }) => !q || `${t.title} ${t.detail}`.toLowerCase().includes(q.toLowerCase());
  const link = (t: Help["guides"][number]) => {
    const body = (
      <>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-primary-subtle">
          <Icon name={HELP_ICON[t.icon]} size={16} />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-label-m text-text-primary">{t.title}</span>
          <span className="text-caption text-text-secondary">{t.detail}</span>
        </span>
        <Icon name="app/icon-chevron-right-tertiary-16" size={16} />
      </>
    );
    const cls = "flex w-full items-center gap-3 rounded-[10px] border border-border-subtle px-3.5 py-3 text-left hover:border-border-default";
    if (t.id === "shortcuts") return <button key={t.id} type="button" onClick={onShortcuts} className={cls}>{body}</button>;
    if (t.id === "feedback") return <button key={t.id} type="button" onClick={onFeedback} className={cls}>{body}</button>;
    if (t.id === "oncall") return <a key={t.id} href="tel:0302555900" className={cls}>{body}</a>;
    // TODO(api): guide content and the IT ticket form live outside this app.
    return <a key={t.id} href={`https://help.frauddetection.example/${t.id}`} target="_blank" rel="noreferrer" className={cls}>{body}</a>;
  };
  return (
    <Drawer open onClose={onClose} width={480} title="Help & support" subtitle="Guides for your role, system status and who to contact." footer={<span className="text-caption text-text-tertiary">Version 2.0 · Kasa Mobile workspace</span>}>
      <div className="flex flex-col gap-[18px]">
        <input
          type="search"
          aria-label="Search help"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search help"
          className="h-10 rounded-lg border border-border-default px-3.5 text-body-m outline-none focus:border-border-focus focus:shadow-focus"
        />
        {data && (
          <p className={cn("flex items-center gap-2.5 rounded-[10px] px-3.5 py-3 text-label-s", data.status.state === "operational" ? "bg-success-bg text-success-fg" : "bg-medium-bg text-medium-fg")}>
            <span className={cn("size-2 shrink-0 rounded-full", data.status.state === "operational" ? "bg-success-fg" : "bg-medium-fg")} />
            {data.status.summary}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <p className="text-overline text-text-tertiary uppercase">Guides for your work</p>
          {data?.guides.filter(match).map(link)}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-overline text-text-tertiary uppercase">Get a person</p>
          {data?.contacts.filter(match).map(link)}
        </div>
      </div>
    </Drawer>
  );
}

const PAGE: Record<string, string> = { "/queue": "My queue", "/alerts": "Live alerts", "/cases": "Cases", "/lookup": "Subscriber lookup", "/heatmap": "Heatmap", "/network": "Entity network", "/overview": "Overview", "/reports": "Reports" };

/** I13/I14 · Send feedback, then the thank-you. */
export function FeedbackModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const pathname = usePathname();
  const now = useNow();
  const [kind, setKind] = useState<"broken" | "idea" | "data" | "other">("data");
  const [body, setBody] = useState("");
  const [shot, setShot] = useState(true);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [sent, setSent] = useState<string | null>(null);
  const page = PAGE[pathname] ?? (pathname.startsWith("/cases/") ? `Case ${pathname.split("/")[2]}` : pathname);
  const browser = typeof navigator !== "undefined" ? (navigator.userAgent.match(/(Chrome|Firefox|Safari)\/(\d+)/)?.slice(1, 3).join(" ") ?? "Browser") : "Browser";

  const send = async () => {
    setTried(true);
    if (body.trim().length < 10) return;
    setBusy(true);
    setFailure(null);
    try {
      // TODO(api): proposed POST /feedback {kind, body, screenshot, context}.
      const res = await apiFetch<{ reference: string }>("POST", "/feedback", { kind, body, screenshot: shot, context: { page: pathname, browser } });
      setSent(res.reference);
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Modal
        open
        onClose={onClose}
        width={520}
        title={
          <span className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-success-bg">
              <Icon name="app/icon-check-circle-success-22" size={22} />
            </span>
            Thanks, {user?.name.split(" ")[0] ?? "there"}, feedback sent
          </span>
        }
        description={
          <span className="block text-center">
            Reference {sent}. The product team reads every message within two working days. If they reply, it shows under “Updates for you” on your home screen.
          </span>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setSent(null);
                setBody("");
                setTried(false);
              }}
            >
              Send another
            </Button>
            <Button size="md" onClick={onClose}>
              Done
            </Button>
          </>
        }
      >
        {null}
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      width={600}
      icon="app/icon-inbox-brand-22"
      tone="brand"
      title="Send feedback"
      description="Goes to the FraudDetection product team. Your supervisor isn’t copied."
      actions={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button size="md" onClick={send} loading={busy}>
            Send feedback
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-label-s text-text-primary">What is it about?</span>
        <div className="w-fit">
          <Segmented
            label="What is it about?"
            value={kind}
            onChange={setKind}
            options={[
              { id: "broken", label: "Something’s broken" },
              { id: "idea", label: "Idea" },
              { id: "data", label: "Data looks wrong" },
              { id: "other", label: "Other" },
            ]}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <TextArea
          label="Tell us more"
          required
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          error={tried && body.trim().length < 10 ? "Say what happened, or what you’d like." : undefined}
        />
        <p className="text-caption text-text-secondary">Don’t paste full MSISDNs or Ghana Card numbers. We’ll find the case from its ID.</p>
      </div>
      <label className={cn("flex cursor-pointer items-start gap-3 rounded-[10px] border px-3.5 py-3", shot ? "border-[1.5px] border-brand-primary bg-brand-primary-subtle" : "border-border-default")}>
        <Checkbox label="Attach a screenshot of this page" hideLabel checked={shot} onChange={(e) => setShot(e.target.checked)} />
        <span className="flex flex-col">
          <span className="text-label-m text-text-primary">Attach a screenshot of this page</span>
          <span className="text-body-s text-text-secondary">Personal data is blurred before it’s sent.</span>
        </span>
      </label>
      <p className="flex items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2.5 text-caption text-text-secondary">
        <Icon name="app/icon-file-secondary-14" size={14} />
        Sent with: {page} page · {browser} · {formatDay(now).replace(/^\w+ /, "")} {formatClock(now)}
      </p>
      <RequestError error={failure} />
    </Modal>
  );
}
