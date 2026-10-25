import { AuthHeading, AuthPage, StaffBadge } from "@/components/auth/AuthPage";
import { OperatorLogo } from "@/components/brand/Logo";
import { Badge, EnvironmentPill, type BadgeTone } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Note } from "@/components/ui/Banner";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import Link from "next/link";
import type { ReactNode } from "react";

type Workspace = {
  id: string;
  name: string;
  operator?: string;
  env?: "production" | "test";
  badge?: { label: string; tone: BadgeTone; dot?: boolean };
  detail: string;
  /** Production workspaces open only during an approved support session. */
  access: "open" | "request";
  isDefault?: boolean;
};

const WORKSPACES: Workspace[] = [
  {
    id: "platform",
    name: "Platform console",
    badge: { label: "Default", tone: "brand" },
    detail: "All operators · no customer data",
    access: "open",
    isDefault: true,
  },
  {
    id: "volta-prod",
    name: "Volta Telecom",
    operator: "Volta Telecom",
    env: "production",
    badge: { label: "1 integration degraded", tone: "medium", dot: true },
    detail: "Support session approved until 18:00 today",
    access: "open",
  },
  {
    id: "kasa-prod",
    name: "Kasa Mobile",
    operator: "Kasa Mobile",
    env: "production",
    badge: { label: "Healthy", tone: "success", dot: true },
    detail: "No active support session",
    access: "request",
  },
  {
    id: "kasa-test",
    name: "Kasa Mobile · Test",
    operator: "Kasa Mobile",
    env: "test",
    detail: "Staff have standing access to test environments",
    access: "open",
  },
];

function WorkspaceRow({ ws }: { ws: Workspace }) {
  const body: ReactNode = (
    <>
      {ws.operator ? (
        <OperatorLogo operator={ws.operator} showName={false} />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-primary-subtle">
          <Icon name="icon-globe-brand" size={18} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-label-m text-text-primary">{ws.name}</span>
        {(ws.env || ws.badge) && (
          <span className="flex flex-wrap items-center gap-1.5">
            {ws.env && <EnvironmentPill env={ws.env} />}
            {ws.badge && <Badge {...ws.badge} />}
          </span>
        )}
        <span className="text-caption text-text-secondary">{ws.detail}</span>
      </span>
    </>
  );

  const box = cn(
    "flex w-full items-center gap-3.5 rounded-xl px-4 py-3.5",
    ws.isDefault
      ? "border-[1.5px] border-brand-primary bg-brand-primary-subtle"
      : "border border-border-default bg-surface-base",
  );

  if (ws.access === "request") {
    return (
      <li className={box}>
        {body}
        <ButtonLink href="/staff/request-access" variant="secondary" size="sm">
          Request access
        </ButtonLink>
      </li>
    );
  }
  return (
    <li>
      {/* Staff consoles aren’t built yet; every open workspace lands on the placeholder. */}
      <Link href={`/workspace/${ws.id}`} className={cn(box, "hover:border-border-strong")}>
        {body}
        <Icon name={ws.isDefault ? "icon-chevron-right-brand" : "icon-chevron-right"} size={18} />
      </Link>
    </li>
  );
}

/** F3 · Choose a workspace. TODO: workspaces are static until the API has staff endpoints. */
export default function ChooseWorkspacePage() {
  return (
    <AuthPage variant="staff" width={520} gap={24} securityNote={false}>
      <StaffBadge />
      <AuthHeading
        title="Where do you want to work?"
        description="Signed in as Selorm Agbeko · Super Admin"
      />
      <ul className="flex flex-col gap-2.5">
        {WORKSPACES.map((ws) => (
          <WorkspaceRow key={ws.id} ws={ws} />
        ))}
      </ul>
      <Note tone="lock">
        Operator data stays private. You can open an operator’s production workspace only during a
        support session their IT admin has approved.
      </Note>
    </AuthPage>
  );
}
