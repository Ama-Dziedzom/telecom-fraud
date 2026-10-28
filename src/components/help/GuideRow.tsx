import { Icon } from "@/components/ui/Icon";
import Link from "next/link";
import type { ReactNode } from "react";

const rowClass = "-mx-2 flex items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-sunken";

function Body({ icon, title, detail }: { icon: string; title: ReactNode; detail: ReactNode }) {
  return (
    <>
      {/* Neutral 16 icons whatever colour the export has. */}
      <span className="icon-tint mt-0.5 flex shrink-0 text-text-tertiary">
        <Icon name={icon} size={16} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body-s text-text-primary">{title}</span>
        <span className="text-caption text-text-secondary">{detail}</span>
      </span>
    </>
  );
}

/** Guide / contact row in the help centre: 16 icon, Body/S title, Caption detail. */
export function GuideRow({ href, onClick, icon, title, detail }: { href?: string; onClick?: () => void; icon: string; title: ReactNode; detail: ReactNode }) {
  if (onClick || !href) {
    return (
      <button type="button" onClick={onClick} className={rowClass}>
        <Body icon={icon} title={title} detail={detail} />
      </button>
    );
  }
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={rowClass}>
        <Body icon={icon} title={title} detail={detail} />
      </Link>
    );
  }
  return (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={rowClass}>
      <Body icon={icon} title={title} detail={detail} />
    </a>
  );
}
