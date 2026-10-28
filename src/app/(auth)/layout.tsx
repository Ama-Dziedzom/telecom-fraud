import { AuthFrame } from "@/components/auth/AuthFrame";
import { SignInProvider } from "@/components/auth/SignInContext";
import { Suspense } from "react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <SignInProvider>
      <AuthFrame>
        {/* Auth screens depend on per-visit state (timers, query params), so they stream. */}
        <Suspense>{children}</Suspense>
      </AuthFrame>
    </SignInProvider>
  );
}
