import { OperatorLogo } from "@/components/brand/Logo";
import { EmailPreview } from "@/components/emails/EmailPreview";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/** C1 · Invite email */
export default function InviteEmailPreview() {
  return (
    <EmailPreview
      label="Email · received by the new user"
      subject="Kojo Asare invited you to FraudDetection · MTN Ghana"
      from="no-reply@frauddetection.app"
      to="ama.mensah@mtn.com.gh"
      bodyClassName="gap-6 px-12 py-10"
    >
      <div className="flex flex-col gap-2.5">
        <h2 className="text-h1 text-text-primary">You’re invited to join MTN Ghana</h2>
        <p className="max-w-[540px] text-body-l text-text-secondary">
          Kojo Asare (IT Admin) has given you access to FraudDetection, MTN Ghana’s fraud
          detection and case management platform.
        </p>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-raised px-4 py-3.5">
        <OperatorLogo operator="MTN Ghana" />
        <span className="flex-1" />
        <Badge label="Fraud Analyst" tone="brand" size="md" />
      </div>
      <ButtonLink
        href="/invite/inv_demo"
        className="w-fit"
        iconRight={<Icon name="icon-arrow-right" size={20} />}
      >
        Accept invite
      </ButtonLink>
      <p className="text-body-s text-text-secondary">
        This invite expires in 72 hours. Friday 23 October, 16:20 GMT.
      </p>
      <div className="flex items-start gap-2.5 rounded-[10px] bg-info-bg px-3.5 py-3">
        <Icon name="icon-shield-info" size={18} className="mt-px shrink-0" />
        <p className="text-body-s text-info-fg">
          FraudDetection will never ask for your password or sign-in codes by phone, SMS or
          WhatsApp. If someone does, report it to your IT admin.
        </p>
      </div>
    </EmailPreview>
  );
}
