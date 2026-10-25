import { SessionGuard } from "@/components/auth/SessionGuard";
import { ToastProvider } from "@/components/ui/Toast";
import { Suspense } from "react";

/** Full-screen views outside the app shell (story mode). */
export default function StoryLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense>
      <SessionGuard>
        <ToastProvider>{children}</ToastProvider>
      </SessionGuard>
    </Suspense>
  );
}
