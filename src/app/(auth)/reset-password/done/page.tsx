import { AuthHeading, AuthPage } from "@/components/auth/AuthPage";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/** D5 · Password updated */
export default function PasswordUpdatedPage() {
  return (
    <AuthPage>
      <AuthHeading
        icon={{ name: "icon-check-circle-success", tone: "success" }}
        title="Password updated"
        description="Sign in with your new password. For your security, we’ve signed you out on all other devices."
      />
      <ButtonLink href="/sign-in" fullWidth iconRight={<Icon name="icon-arrow-right" size={20} />}>
        Sign in
      </ButtonLink>
    </AuthPage>
  );
}
