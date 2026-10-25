"use client";

import { AuthHeading, AuthPage } from "@/components/auth/AuthPage";
import { useSignIn } from "@/components/auth/SignInContext";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useCopy } from "@/components/ui/CopyButton";
import { Icon } from "@/components/ui/Icon";

/**
 * A7 · Account deactivated (403 account_deactivated).
 * The API gives the admin’s contact email but not their name or the date,
 * so this shows the contact without them.
 */
export default function DeactivatedPage() {
  const { adminContact } = useSignIn();
  const { copied, copy } = useCopy(adminContact ?? "");

  return (
    <AuthPage>
      <AuthHeading
        icon={{ name: "icon-user-x", tone: "neutral" }}
        title="Your account is turned off"
        description="Your IT admin deactivated this account. If you still need access, contact them."
      />

      {adminContact && (
        <div className="flex w-full items-center gap-3 rounded-xl border border-border-default px-4 py-3.5">
          <Avatar initials="IT" size={40} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-label-m text-text-primary">IT Admin</span>
            <span className="truncate text-body-s text-text-secondary">{adminContact}</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            onClick={copy}
            iconLeft={<Icon name="icon-copy" size={16} />}
          >
            {copied ? "Copied" : "Copy email"}
          </Button>
        </div>
      )}

      <ButtonLink href="/sign-in" variant="secondary" fullWidth>
        Use a different account
      </ButtonLink>
    </AuthPage>
  );
}
