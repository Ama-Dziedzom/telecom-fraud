"use client";

import { AppHeader } from "@/components/app/AppHeader";
import { PageBody, PageHead } from "@/components/app/AppShell";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const TABS = [
  ["/account", "Profile"],
  ["/account/security", "Security"],
  ["/account/notifications", "Notifications"],
  ["/account/preferences", "Preferences"],
] as const;

/** I6–I10 · Account settings — one page, four tabs (each its own URL). */
export function AccountFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <AppHeader section="Account" title="Account settings" />
      <PageBody>
        <PageHead title="Account settings" subtitle="Your profile, sign-in security and how we notify you. Changes apply to Kasa Mobile only." />
        <nav aria-label="Account settings" className="flex gap-5 border-b border-border-default">
          {TABS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={cn("-mb-px border-b-2 px-1 py-3 text-label-m", pathname === href ? "border-brand-primary text-text-brand" : "border-transparent text-text-secondary hover:text-text-primary")}
            >
              {label}
            </Link>
          ))}
        </nav>
        {children}
      </PageBody>
    </>
  );
}
