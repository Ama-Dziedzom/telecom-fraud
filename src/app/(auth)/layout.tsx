import { AuthShowcase } from "@/components/auth/AuthShowcase";
import { SignInProvider } from "@/components/auth/SignInContext";
import { Suspense } from "react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <SignInProvider>
      <div className="grid min-h-dvh bg-surface-base lg:grid-cols-[880fr_832fr]">
        <div className="sticky top-0 hidden h-dvh p-4 pr-0 lg:block">
          <AuthShowcase />
        </div>
        {/* Auth screens depend on per-visit state (timers, query params), so they stream. */}
        <div className="py-4">
          <Suspense>{children}</Suspense>
        </div>
      </div>
    </SignInProvider>
  );
}
