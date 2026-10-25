import { Logo } from "@/components/brand/Logo";
import { FitToBox } from "@/components/ui/FitToBox";
import Image from "next/image";

const BARS = [15.4, 24.2, 19.8, 33, 28.6, 41.8, 37.4, 48.4, 33, 44];
const HIGHLIGHT_BAR = 7;

const glass =
  "absolute border-white/14 bg-white/6 drop-shadow-[0_27px_27px_rgba(5,3,26,0.45)] backdrop-blur-[14px]";

/**
 * Auth / Showcase — the decorative left panel shared by every sign-in screen.
 * Logo and message keep their exact Figma size and inset; the floating cards
 * keep their 880 × 853 Figma composition and scale as one piece to fit the
 * space above the message, so nothing overlaps at any viewport size.
 */
export function AuthShowcase() {
  return (
    <aside
      aria-hidden
      className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-brand-ink-deep"
      style={{
        backgroundImage: [
          "radial-gradient(62.5% 71.4% at 93.75% -7.1%, rgba(136,124,253,0.22), rgba(136,124,253,0))",
          "radial-gradient(55.6% 66.7% at 5.6% 90.7%, rgba(83,71,206,0.55), rgba(83,71,206,0))",
          "repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 55px)",
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 55px)",
        ].join(","),
      }}
    >
      <Logo theme="dark" className="absolute top-11 left-12 z-10" />

      <div className="relative min-h-0 flex-1">
        <FitToBox width={880} height={853} align="end">
          {/* Card · Detections */}
          <div
            className={`${glass} top-[150px] left-[566px] flex w-[260px] flex-col gap-[11px] rounded-[17.6px] border-[1.1px] px-[22px] py-[19.8px]`}
          >
            <p className="text-[13.2px] leading-[19.8px] text-white opacity-60">Detections today</p>
            <div className="flex items-end gap-[8.8px]">
              <p className="text-[30.8px] leading-[39.6px] font-bold tracking-[-0.308px] text-white">
                1,284
              </p>
              <p className="text-[13.2px] leading-[19.8px] font-medium text-[#8fe3a3]">▲ 12%</p>
            </div>
            <div className="flex h-[48.4px] items-end gap-[5.5px]">
              {BARS.map((h, i) => (
                <span
                  key={i}
                  className={`w-[9.9px] rounded-[3.3px] ${i === HIGHLIGHT_BAR ? "bg-brand-highlight" : "bg-white/22"}`}
                  style={{ height: h }}
                />
              ))}
            </div>
          </div>

          {/* Card · Network */}
          <div
            className={`${glass} top-[598px] left-[92px] flex w-[283px] flex-col gap-3 rounded-[19.2px] border-[1.2px] px-6 py-[21.6px] opacity-50`}
          >
            <p className="text-[15.6px] leading-[21.6px] font-medium text-white">
              Linked to ring FD-2998
            </p>
            <Image src="/figma/auth/mini-network.svg" alt="" width={235.2} height={115.2} />
            <p className="text-[14.4px] leading-[21.6px] text-white opacity-60">
              4 mule wallets · 2 SIMs
            </p>
          </div>

          {/* Card · Alert */}
          <div
            className={`${glass} top-[343px] left-[196px] flex w-[460px] flex-col gap-[18.4px] rounded-[18.4px] border-[1.15px] px-[23px] py-[20.7px]`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[9.2px]">
                <span className="flex items-center gap-[6.9px] rounded-full bg-[rgba(255,107,107,0.16)] px-[10.35px] py-[3.45px]">
                  <span className="size-[6.9px] rounded-full bg-[#ff6b6b]" />
                  <span className="text-[13.8px] leading-[20.7px] font-medium text-[#ffb4b4]">
                    Critical
                  </span>
                </span>
                <p className="text-[16.1px] leading-[23px] font-medium text-white">
                  SIM swap to MoMo transfers
                </p>
              </div>
              <p className="text-[13.8px] leading-[20.7px] text-white opacity-55">3.8s ago</p>
            </div>
            <div className="flex items-center gap-[20.7px]">
              <div className="relative size-[87.4px] shrink-0">
                <Image
                  src="/figma/auth/gauge-track.svg"
                  alt=""
                  width={87.4}
                  height={87.4}
                  className="absolute inset-0"
                />
                <Image
                  src="/figma/auth/gauge-arc.svg"
                  alt=""
                  width={87.4}
                  height={87.4}
                  className="absolute inset-0"
                />
                <div className="absolute inset-x-0 top-[20.7px] flex flex-col items-center font-bold text-white">
                  <p className="text-[25.3px] leading-[34.5px] tracking-[-0.13px]">97</p>
                  <p className="text-[12.65px] leading-[18.4px] tracking-[0.76px] uppercase opacity-60">
                    Risk
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-[6.9px] text-white">
                <p className="font-mono text-[16.1px] leading-[23px] font-medium">
                  +233 54 *** 3457
                </p>
                <p className="text-[14.95px] leading-[23px] opacity-75">
                  6 transfers · GHS 18,400 in 22 min
                </p>
                <p className="text-[14.95px] leading-[23px] opacity-75">
                  New device · Accra (usually Kumasi)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-[9.2px]">
              <span className="rounded-[9.2px] bg-brand-primary px-[13.8px] py-[8.05px] text-[14.95px] leading-[20.7px] font-medium text-white">
                Freeze wallet
              </span>
              <span className="rounded-[9.2px] bg-white/8 px-[13.8px] py-[8.05px] text-[14.95px] leading-[20.7px] font-medium text-[#d9d5ff]">
                Open case
              </span>
            </div>
          </div>
        </FitToBox>
      </div>

      {/* Message */}
      <div className="flex max-w-[768px] flex-col gap-4 px-12 pb-12">
        <p className="text-display text-white">
          Spot fraud in seconds,
          <br />
          not days.
        </p>
        <p className="max-w-[560px] text-body-l text-white opacity-72">
          Live signals from calls, SIMs, KYC and MoMo, scored and flagged the moment something looks
          wrong.
        </p>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-7 rounded-full bg-white/95" />
          <span className="size-2 rounded-full bg-white/30" />
          <span className="size-2 rounded-full bg-white/30" />
        </div>
      </div>
    </aside>
  );
}
