"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renders children on a fixed-size canvas and scales it uniformly to fit the
 * parent, centred horizontally. Keeps fixed compositions (e.g. the auth showcase) exactly
 * as designed at any viewport size.
 */
export function FitToBox({
  width,
  height,
  align = "center",
  children,
}: {
  width: number;
  height: number;
  /** Vertical placement when the parent is taller than the scaled canvas. */
  align?: "center" | "end";
  children: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const update = () =>
      setScale(Math.min(box.clientWidth / width, box.clientHeight / height));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, [width, height]);

  return (
    <div ref={boxRef} className="absolute inset-0 overflow-hidden">
      <div
        className={
          align === "end"
            ? "absolute bottom-0 left-1/2 origin-bottom"
            : "absolute top-1/2 left-1/2 origin-center"
        }
        style={{
          width,
          height,
          transform: `translate(-50%, ${align === "end" ? "0" : "-50%"}) scale(${scale ?? 1})`,
          visibility: scale === null ? "hidden" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
