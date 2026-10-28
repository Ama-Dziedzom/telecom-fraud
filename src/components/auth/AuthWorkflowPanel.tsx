import { FitToBox } from "@/components/ui/FitToBox";
import { cn } from "@/lib/cn";

export type WorkflowStep = 1 | 2 | 3 | 4;

const A = "/figma/auth/workflow";

const pill = "absolute flex items-center gap-2.5 overflow-hidden rounded-full border px-4 py-2.5 whitespace-nowrap";
const raised = "border-border-default bg-surface-base shadow-[0_8px_24px_-4px_rgb(15_23_42/0.08)]";

/** The four beats on the spine; `side` is which side of the spine the pill sits. */
const BEATS = [
  { label: "Alert scored", meta: "AL-88213 · risk 97", top: 420, side: "right" },
  { label: "Case opened", meta: "FD-3050", top: 560, side: "left" },
  { label: "Wallet frozen", meta: "GHS 312.40 held", top: 700, side: "right" },
  { label: "Signed off", meta: "confirmed fraud", top: 840, side: "left" },
] as const;

/**
 * Auth / Workflow panel — right half of every auth screen (864 × 1117).
 * `step` is how far the sign-in has got: 1 email, 2 password or SSO,
 * 3 second factor, 4 signed in. Beats up to `step` are lit; the next one is
 * at 55%, the rest at 30%.
 */
export function AuthWorkflowPanel({ step }: { step: WorkflowStep }) {
  return (
    <aside aria-hidden className="relative h-full overflow-hidden border-l border-border-default bg-surface-raised">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${A}/perspective-grid.svg`} alt="" width={864} height={1117} className="absolute inset-0 size-full object-cover object-top" />
      <FitToBox width={864} height={1117}>
        {/* eslint-disable @next/next/no-img-element */}
        <img src={`${A}/spine-top.svg`} alt="" width={1.5} height={150} className="absolute top-0 left-[498.25px]" />
        <div className={cn("absolute top-[150px] left-[379px] flex w-[360px] flex-col gap-3 rounded-lg border p-4", raised)}>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-surface-raised">
              <img src={`${A}/icon-activity.svg`} alt="" width={18} height={18} />
            </span>
            <span className="flex flex-col gap-2">
              <span className="h-2 w-[120px] rounded bg-border-default" />
              <span className="h-2 w-[200px] rounded bg-border-default" />
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-7 rounded border border-border-default" />
            <span className="h-3.5 w-[90px] rounded bg-brand-primary" />
            <span className="w-[150px]" />
            <span className="h-1.5 w-10 rounded-[3px] bg-border-default" />
          </div>
        </div>
        <img src={`${A}/spine.svg`} alt="" width={1.5} height={700} className="absolute top-[250px] left-[498.25px]" />

        {BEATS.map((b, i) => {
          const lit = i < step;
          const tone = lit ? raised : cn("border-border-subtle bg-surface-base text-text-tertiary", i === step ? "opacity-55" : "opacity-30");
          return (
            <div key={b.label}>
              <div
                className={cn(pill, tone)}
                style={b.side === "right" ? { top: b.top, left: 539 } : { top: b.top, right: 405 }}
              >
                {lit && (i === 0 ? <img src={`${A}/risk-dot.svg`} alt="" width={8} height={8} /> : <img src={`${A}/icon-check.svg`} alt="" width={14} height={14} />)}
                <span className={cn("text-label-s", lit && "text-text-primary")}>{b.label}</span>
                <span className={cn("font-mono text-[12px] font-normal", lit && "text-text-secondary")}>{b.meta}</span>
              </div>
              <img
                src={`${A}/${lit ? "tick-active" : "tick-idle"}.svg`}
                alt=""
                width={40}
                height={1.5}
                className="absolute"
                style={{ top: b.top + 19.25, left: b.side === "right" ? 499 : 459 }}
              />
              <img src={`${A}/${lit ? "node-active" : "node-idle"}.svg`} alt="" width={9} height={9} className="absolute left-[494.5px]" style={{ top: b.top + 15.5 }} />
            </div>
          );
        })}

        <img src={`${A}/pulse-184.svg`} alt="" width={184} height={184} className="absolute top-[918px] left-[407px]" />
        <img src={`${A}/pulse-144.svg`} alt="" width={144} height={144} className="absolute top-[938px] left-[427px]" />
        <img src={`${A}/pulse-104.svg`} alt="" width={104} height={104} className="absolute top-[958px] left-[447px]" />
        <img src={`${A}/pulse-68.svg`} alt="" width={68} height={68} className="absolute top-[976px] left-[465px]" />
        <span className="absolute top-[990px] left-[479px] flex size-10 items-center justify-center rounded-[10px] bg-brand-primary">
          <img src={`${A}/icon-shield-check.svg`} alt="" width={20} height={20} />
        </span>
        {/* eslint-enable @next/next/no-img-element */}
        <div className="absolute top-[877px] left-0 h-[240px] w-[864px] bg-gradient-to-b from-surface-raised/0 to-surface-raised" />
        <div className="absolute top-[1013px] left-[63px] flex flex-col gap-1 whitespace-nowrap">
          <p className="text-label-s text-text-primary">From alert to sign-off in one place</p>
          <p className="text-caption text-text-secondary">Live alerts, cases, protection and sign-off for your operator.</p>
        </div>
      </FitToBox>
    </aside>
  );
}
