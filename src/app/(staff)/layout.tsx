import { SessionGuard } from "@/components/auth/SessionGuard";
import { Suspense } from "react";

export default function StaffLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense>
      <SessionGuard>{children}</SessionGuard>
    </Suspense>
  );
}
