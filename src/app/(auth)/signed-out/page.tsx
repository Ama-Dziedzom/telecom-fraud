import { AuthHeading, AuthPage } from "@/components/auth/AuthPage";
import { ButtonLink } from "@/components/ui/Button";

/** E6 · Signed out */
export default function SignedOutPage() {
  return (
    <AuthPage>
      <AuthHeading
        icon={{ name: "icon-log-out-secondary-24", tone: "neutral" }}
        title="You’ve signed out"
        description="Using a shared computer? Close the browser too, so nobody else can reopen your session."
      />
      <ButtonLink href="/sign-in" fullWidth>
        Sign in again
      </ButtonLink>
    </AuthPage>
  );
}
