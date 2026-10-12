"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

const pad = (value: number) => String(value).padStart(2, "0");

/** A console's records: a scrolling column on wide screens; on phones a row of
 * cards to swipe through, with a readout of where you are in it. */
export function EvidenceRail({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const card = rail.firstElementChild as HTMLElement | null;
      if (!card || rail.scrollWidth <= rail.clientWidth) return;
      if (rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2) {
        setPosition(count - 1);
        return;
      }
      const step = card.offsetWidth + (parseFloat(getComputedStyle(rail).columnGap) || 0);
      setPosition(Math.min(count - 1, Math.round(rail.scrollLeft / step)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    rail.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      rail.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [count]);

  return (
    <>
      <div ref={railRef} className="evidence-console-scroll" tabIndex={0} aria-label={label}>
        {children}
      </div>
      {count > 1 && (
        <div className="evidence-rail-meter" aria-hidden>
          <span>
            {pad(position + 1)} / {pad(count)}
          </span>
          <i style={{ "--progress": (position + 1) / count } as CSSProperties} />
          <span>Swipe</span>
        </div>
      )}
    </>
  );
}
