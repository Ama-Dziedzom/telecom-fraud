import { SessionGuard } from "@/components/auth/SessionGuard";
import { Suspense } from "react";

/** Exported documents: signed in like the app, without the shell, laid out for A4. */
export default function PrintLayout({ children }: LayoutProps<"/print">) {
  return (
    <Suspense>
      <SessionGuard>{children}</SessionGuard>
    </Suspense>
  );
}
