import { EmailPreview } from "@/components/emails/EmailPreview";
import { ButtonLink } from "@/components/ui/Button";

const DETAILS = [
  ["When", "Tue 20 Oct 2026, 16:31 GMT"],
  ["Device", "Chrome on Windows 11"],
  ["Location", "Tema, Greater Accra (approximate)"],
  ["Workspace", "Kasa Mobile · Fraud Analyst"],
];

/** E5 · New sign-in email */
export default function NewSignInEmailPreview() {
  return (
    <EmailPreview
      label="Email · security notice"
      subject="New sign-in to your FraudDetection account"
      from="security@frauddetection.app"
      to="ama.mensah@kasamobile.com.gh"
      bodyClassName="gap-[22px] px-11 py-9"
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-h1 text-text-primary">Was this you?</h2>
        <p className="text-body-l text-text-secondary">
          We noticed a sign-in from a device we haven’t seen before.
        </p>
      </div>
      <dl className="flex flex-col">
        {DETAILS.map(([key, value]) => (
          <div key={key} className="flex items-center gap-3 border-b border-border-subtle py-2.5 text-body-s">
            <dt className="text-text-secondary">{key}</dt>
            <dd className="ml-auto text-right text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-body-m text-text-primary">If this was you, there’s nothing to do.</p>
      <ButtonLink href="/forgot-password" variant="danger" className="w-fit">
        This wasn’t me: secure my account
      </ButtonLink>
      <p className="max-w-[540px] text-body-s text-text-secondary">
        This signs you out everywhere, resets your password and alerts your IT admin.
      </p>
    </EmailPreview>
  );
}
