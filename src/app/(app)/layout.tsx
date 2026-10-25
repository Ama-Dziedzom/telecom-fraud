import { AppShell } from "@/components/app/AppShell";
import { SessionGuard } from "@/components/auth/SessionGuard";
import { Suspense } from "react";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense>
      <SessionGuard>
        <AppShell>{children}</AppShell>
      </SessionGuard>
    </Suspense>
  );
}
