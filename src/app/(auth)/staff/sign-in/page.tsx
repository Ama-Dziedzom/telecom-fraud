import { AuthHeading, AuthPage, StaffBadge } from "@/components/auth/AuthPage";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/** F1 · Staff sign-in */
export default function StaffSignInPage() {
  return (
    <AuthPage variant="staff">
      <StaffBadge />
      <AuthHeading title="Staff console" description="Sign in with your FraudDetection staff account." />
      {/* A real build redirects to the staff IdP here. */}
      <ButtonLink
        href="/staff/verify"
        fullWidth
        iconRight={<Icon name="icon-external-white" size={20} />}
      >
        Continue with staff SSO
      </ButtonLink>
      <p className="text-body-s text-text-secondary">
        Operator users sign in at their usual address, not here.
      </p>
    </AuthPage>
  );
}
