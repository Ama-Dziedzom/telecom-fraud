"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { Tabs } from "@/components/app/Card";
import { useOperatorName } from "@/lib/auth/session";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

type Tab = "/account" | "/account/security" | "/account/notifications" | "/account/preferences";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "/account", label: "Profile" },
  { id: "/account/security", label: "Security" },
  { id: "/account/notifications", label: "Notifications" },
  { id: "/account/preferences", label: "Preferences" },
];

/** I6–I10 · Account settings — one page, four tabs on the canvas (each its own URL). */
export function AccountFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const operator = useOperatorName() ?? "MTN Ghana";
  return (
    <>
      <AppHeader section="Account" title="Account settings" />
      <PageBody>
        <div className="flex flex-col gap-5">
          <PageHead title="Account settings" subtitle={`Your profile, sign-in security and how we notify you. Changes apply to ${operator} only.`} />
          <Tabs label="Account settings" surface="canvas" value={pathname as Tab} onChange={(id) => router.push(id)} tabs={TABS} />
        </div>
        {children}
      </PageBody>
    </>
  );
}

/** Key–value rows for read-only settings (Managed by IT, Sign-in method). */
export function SettingsList({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="-mt-1 flex flex-col">
      {rows.map(([k, v]) => (
        <div key={k} className="flex min-h-[37px] items-center justify-between gap-4 border-b border-border-default py-2 last:border-b-0">
          <dt className="text-body-s text-text-secondary">{k}</dt>
          <dd className="text-right text-body-s text-text-primary">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** One setting: title + detail on the left, its control on the right. */
export function SettingRow({ title, detail, children }: { title: string; detail?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-[62px] items-center justify-between gap-4 border-b border-border-default py-3 last:border-b-0">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-label-s text-text-primary">{title}</span>
        {detail && <span className="text-caption text-text-secondary">{detail}</span>}
      </span>
      {children}
    </div>
  );
}
