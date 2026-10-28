"use client";

import { RequestError } from "@/components/auth/RequestError";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CheckCard } from "@/components/ui/Choice";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { apiFetch } from "@/lib/api/client";
import { useApi } from "@/lib/api/fd";
import { roleLabel, type User } from "@/lib/auth/api";
import { cn } from "@/lib/cn";
import { formatClock, TZ, useNow } from "@/lib/time";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Chips } from "./Chips";

/** A neutral 16 icon, whatever colour the file was exported in. */
function MenuIcon({ name, tone = "text-text-secondary" }: { name: string; tone?: string }) {
  return (
    <span className={cn("icon-tint flex shrink-0", tone)}>
      <Icon name={name} size={16} />
    </span>
  );
}

/** “08:00-16:00” → minutes left until the end, or null when off shift. */
function shiftLeft(shift: string | undefined, now: number) {
  const m = shift?.match(/(\d\d):(\d\d)-(\d\d):(\d\d)/);
  if (!m) return null;
  const d = new Date(now);
  const local = d.getUTCHours() * 60 + d.getUTCMinutes(); // Accra is UTC+0
  const start = +m[1] * 60 + +m[2];
  const end = +m[3] * 60 + +m[4] || 1440;
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
  const left = shiftLeft(user?.shift, now);
  const initials = user?.name.split(" ").map((p) => p[0]).slice(0, 2).join("") ?? "–";
  const item = "flex h-[30px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-body-s hover:bg-surface-sunken";
  return (
    <div role="menu" aria-label="Account" className="absolute top-[calc(100%+8px)] right-0 z-50 flex w-[300px] flex-col overflow-hidden rounded-xl border border-border-default bg-surface-base shadow-lg">
      <div className="flex flex-col gap-2.5 px-4 pt-4 pb-3">
        <span className="flex items-center gap-2.5">
          <Avatar initials={initials} size={32} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-label-s text-text-primary">{user?.name}</span>
            <span className="truncate text-caption text-text-secondary">{user?.email}</span>
          </span>
          {user?.shift && <Badge label={left !== null ? "On shift" : "Off shift"} tone={left !== null ? "success" : "neutral"} />}
        </span>
        <span className="flex flex-wrap gap-1.5">
          {user && <Badge label={roleLabel(user.role)} tone="neutral" />}
          <Badge label={operator} tone="neutral" />
        </span>
      </div>
      {user?.shift && (
        <div className="flex flex-col bg-surface-raised px-4 py-2.5">
          <span className="text-label-s text-text-primary">
            {left !== null ? "On shift" : "Off shift"} · {user.shift}
          </span>
          {left !== null && (
            <span className="text-caption text-text-secondary">
              Ends in {Math.floor(left / 60)} h {left % 60} min
            </span>
          )}
        </div>
      )}
      <div className="flex flex-col p-1.5">
        {user?.next_shift && (
          <button type="button" role="menuitem" onClick={onHandover} className={cn(item, "text-text-primary")}>
            <MenuIcon name="app/icon-users-secondary-16" />
            Hand over shift
          </button>
        )}
        {(
          [
            ["/account", "app/icon-user-secondary-16", "Account settings"],
            ["/account/security", "app/icon-shield-secondary-18", "Security and sign-in"],
            ["/account/notifications", "app/icon-bell-secondary-18", "Notification preferences"],
          ] as const
        ).map(([href, icon, label]) => (
          <Link key={href} href={href} role="menuitem" onClick={onClose} className={cn(item, "text-text-primary")}>
            <MenuIcon name={icon} />
            {label}
          </Link>
        ))}
        <button type="button" role="menuitem" onClick={onShortcuts} className={cn(item, "text-text-primary")}>
          <MenuIcon name="app/icon-command-secondary-18" />
          Keyboard shortcuts
        </button>
      </div>
      <div className="border-t border-border-default p-1.5">
        <button type="button" role="menuitem" onClick={onSignOut} className={cn(item, "text-critical-fg")}>
          <MenuIcon name="app/icon-logout-critical-18" tone="text-critical-fg" />
          Sign out
        </button>
      </div>
    </div>
  );
}

const Kbd = ({ k }: { k: string }) => (
  <kbd className="flex h-[22px] min-w-[22px] items-center justify-center rounded border border-border-default bg-surface-raised px-1.5 font-sans text-caption text-text-primary">{k}</kbd>
);

const SHORTCUTS: Array<[string, Array<[string, string[]]>]> = [
  [
    "Anywhere",
    [
      ["Search MSISDN, case or IMEI", ["Ctrl", "K"]],
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
      ["Next or previous alert", ["J", "K"]],
      ["Open alert", ["Enter"]],
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
      ["Switch tab", ["1", "to", "6"]],
      ["Close panel or dialog", ["Esc"]],
    ],
  ],
];

/** I11 · Keyboard shortcuts. */
export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const group = ([title, rows]: (typeof SHORTCUTS)[number]) => (
    <div key={title} className="flex flex-col">
      <p className="pb-1 text-caption text-text-secondary">{title}</p>
      {rows.map(([label, keys]) => (
        <div key={label} className="flex h-[38px] items-center gap-1.5 border-b border-border-default">
          <span className="flex-1 text-body-s text-text-primary">{label}</span>
          {keys.map((k, i) =>
            k === "then" || k === "to" ? (
              <span key={i} className="px-1 text-caption text-text-tertiary">
                {k}
              </span>
            ) : (
              <Kbd key={i} k={k} />
            ),
          )}
        </div>
      ))}
    </div>
  );
  return (
    <Modal
      open
      onClose={onClose}
      width={740}
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
        <div className="flex flex-1 flex-col gap-5">
          {group(SHORTCUTS[1])}
          {group(SHORTCUTS[2])}
        </div>
      </div>
    </Modal>
  );
}

type Guide = { id: string; title: string; detail: string; read_minutes: number | null; url: string | null };
type Contact = { id: string; kind: "phone" | "ticket" | "feedback"; title: string; value: string | null; hours?: string; reply_within_hours?: number };
type Help = { guides: Guide[]; contacts: Contact[] };
/** GET /status/integrations. */
type Integration = { id: string; name: string; state: "operational" | "degraded" | "down"; since: string | null; lag_seconds: number | null };

/** Neutral icons by guide or contact id. */
const HELP_ICON: Record<string, string> = {
  triage: "app/icon-alert-triangle-secondary-18",
  close: "app/icon-folder-secondary-16",
  reversal: "app/icon-refresh-16",
  playbooks: "app/icon-activity-secondary-18",
  shortcuts: "app/icon-command-secondary-18",
  oncall: "app/icon-phone-secondary-16",
  it: "app/icon-lock-secondary-18",
  feedback: "app/icon-message-18",
};
const KIND_ICON: Record<Contact["kind"], string> = { phone: "app/icon-phone-secondary-16", ticket: "app/icon-lock-secondary-18", feedback: "app/icon-message-18" };

/** The line under a contact, in the app’s words. */
function contactDetail(c: Contact) {
  if (c.kind === "phone") return `Live incident? Call ${c.value}${c.hours ? ` · ${c.hours}` : ""}`;
  if (c.kind === "ticket") return `Access, sign-in or system problems${c.reply_within_hours ? ` · replies within ${c.reply_within_hours} h` : ""}`;
  return "Ideas, or something that got in your way";
}

const STATE: Record<Integration["state"], string> = { operational: "working", degraded: "slow", down: "down" };

/** I12 · Help and support — guides for your role, system status and who to contact. */
export function HelpDrawer({ onClose, onShortcuts, onFeedback }: { onClose: () => void; onShortcuts: () => void; onFeedback: () => void }) {
  const { data } = useApi<Help>("/help");
  const { data: status } = useApi<{ data: Integration[] }>("/status/integrations");
  const [q, setQ] = useState("");
  const guides = data?.guides.map((g) => ({ ...g, detail: g.read_minutes ? `${g.detail} · ${g.read_minutes} min read` : g.detail }));
  const contacts = data?.contacts.map((c) => ({ ...c, detail: contactDetail(c) }));
  const match = (t: { title: string; detail: string }) => !q || `${t.title} ${t.detail}`.toLowerCase().includes(q.toLowerCase());
  const bad = status?.data.filter((i) => i.state !== "operational") ?? [];
  // The help centre is wherever the guides live.
  const centre = data?.guides.map((g) => g.url).find(Boolean);
  const centreUrl = centre ? new URL(centre).origin : null;

  const row = (t: { id: string; title: string; detail: string; icon: string; href: string | null; onClick?: () => void }) => {
    const body = (
      <>
        <MenuIcon name={t.icon} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-label-s text-text-primary">{t.title}</span>
          <span className="text-caption text-text-secondary">{t.detail}</span>
        </span>
      </>
    );
    const cls = "flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left hover:bg-surface-sunken";
    if (t.onClick || !t.href) {
      return (
        <button key={t.id} type="button" onClick={t.onClick} className={cls}>
          {body}
        </button>
      );
    }
    const external = t.href.startsWith("http");
    return (
      <a key={t.id} href={t.href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className={cls}>
        {body}
      </a>
    );
  };
  const section = (label: string, children: ReactNode) => (
    <div className="flex flex-col">
      <p className="pb-1.5 text-caption text-text-secondary">{label}</p>
      <div className="-mx-2.5 flex flex-col">{children}</div>
    </div>
  );

  return (
    <Drawer
      open
      onClose={onClose}
      width={540}
      title="Help and support"
      subtitle="Guides for your role, system status and who to contact."
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>
            Close
          </Button>
          <span className="flex-1" />
          {centreUrl && (
            <ButtonLink href={centreUrl} target="_blank" rel="noreferrer" size="md">
              Open the help centre
            </ButtonLink>
          )}
        </>
      }
    >
      <label className="flex h-10 items-center gap-2 rounded-lg border border-border-default bg-surface-base px-3 focus-within:border-border-focus focus-within:shadow-focus">
        <Icon name="app/icon-search" size={16} />
        <input
          type="search"
          aria-label="Search help"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search help"
          className="min-w-0 flex-1 bg-transparent text-body-m text-text-primary outline-none placeholder:text-text-tertiary focus-visible:shadow-none"
        />
      </label>
      {status &&
        (bad.length === 0 ? (
          <Banner tone="success" title="All systems working">
            {status.data.map((i) => i.name).join(", ")}
          </Banner>
        ) : (
          <Banner tone="warning" title={bad.length === 1 ? `${bad[0].name} is ${STATE[bad[0].state]}` : `${bad.length} systems need attention`}>
            {bad.map((i) => `${i.name} ${STATE[i.state] ?? i.state}${i.since ? ` since ${formatClock(i.since)}` : ""}`).join(" · ")}
            {status.data.length > bad.length ? " · everything else working" : ""}
          </Banner>
        ))}
      {section(
        "Guides for your work",
        guides?.filter(match).map((g) => row({ ...g, icon: HELP_ICON[g.id] ?? "app/icon-folder-secondary-16", href: g.url, onClick: g.id === "shortcuts" ? onShortcuts : undefined })),
      )}
      {section(
        "Get a person",
        contacts?.filter(match).map((c) =>
          row({
            ...c,
            icon: HELP_ICON[c.id] ?? KIND_ICON[c.kind],
            href: c.kind === "phone" && c.value ? `tel:${c.value.replace(/\s/g, "")}` : c.value,
            onClick: c.kind === "feedback" ? onFeedback : undefined,
          }),
        ),
      )}
    </Drawer>
  );
}

const PAGE: Record<string, string> = { "/queue": "My queue", "/alerts": "Live alerts", "/cases": "Cases", "/lookup": "Subscriber lookup", "/heatmap": "Heatmap", "/network": "Entity network", "/overview": "Overview", "/reports": "Reports" };

type Kind = "broken" | "idea" | "data" | "other";

/** I13 · Send feedback; I14 · the thank-you is a toast. */
export function FeedbackModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const pathname = usePathname();
  const now = useNow();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("data");
  const [body, setBody] = useState("");
  const [shot, setShot] = useState(true);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const page = PAGE[pathname] ?? (pathname.startsWith("/cases/") ? `Case ${pathname.split("/")[2]}` : pathname);
  const browser = typeof navigator !== "undefined" ? (navigator.userAgent.match(/(Chrome|Firefox|Safari)\/(\d+)/)?.slice(1, 3).join(" ") ?? "Browser") : "Browser";
  const when = new Date(now).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ });

  const send = async () => {
    setTried(true);
    if (body.trim().length < 10) return;
    setBusy(true);
    setFailure(null);
    try {
      const caseId = pathname.match(/^\/cases\/([^/]+)/)?.[1];
      await apiFetch<{ reference: string; received_at: string }>("POST", "/feedback", {
        kind,
        body,
        screenshot: shot,
        context: { page: pathname, ...(caseId && { case_id: caseId }), browser },
      });
      onClose();
      toast({
        tone: "success",
        title: "Thanks, feedback sent",
        body: user?.email ? `We read everything. If we need more, we’ll reply to ${user.email}.` : "We read everything.",
      });
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={520}
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
      <div className="flex flex-col gap-2">
        <span className="text-label-s text-text-primary">What is it about?</span>
        <Chips
          mode="choice"
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
      <div className="flex flex-col gap-1.5">
        <TextArea
          label="Tell us more"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          error={tried && body.trim().length < 10 ? "Say what happened, or what you’d like." : undefined}
        />
        <p className="flex items-center gap-1.5 text-caption text-text-secondary">
          <Icon name="app/icon-info-secondary-16" size={14} />
          Don’t paste full MSISDNs or Ghana Card numbers. We’ll find the case from its ID.
        </p>
      </div>
      <CheckCard
        title="Attach a screenshot of this page"
        description="Personal data is blurred before it is sent"
        checked={shot}
        onChange={(e) => setShot(e.target.checked)}
      />
      <p className="text-caption text-text-tertiary">
        Sent with: {page} page · {browser} · {when}
      </p>
      <RequestError error={failure} />
    </Modal>
  );
}
