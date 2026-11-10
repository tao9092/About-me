"use client";

import { useEffect, useRef, useState } from "react";

export type RangeTarget = {
  number: string;
  title: string;
  chineseTitle: string;
  statement: string;
};

export type RangeMode = "idle" | "playing" | "paused";

type ShootingRangeSceneProps = {
  targets: RangeTarget[];
  mode: RangeMode;
  activeIndex: number | null;
  muted: boolean;
  onAim: (index: number | null) => void;
  onAds: (aiming: boolean) => void;
  onHit: (index: number) => void;
  onLockChange: (locked: boolean) => void;
};

// three.js and the range's code arrive on their own, not with the page: the
// page responds sooner, and the range is fetched once the page has loaded and
// gone quiet, well before it is scrolled to.
let rangeModule: Promise<typeof import("@/components/shooting-range-build")> | null = null;
const loadRange = () =>
  (rangeModule ??= import("@/components/shooting-range-build").catch((error: unknown) => {
    rangeModule = null;
    throw error;
  }));

export function ShootingRangeScene({
  targets,
  mode,
  activeIndex,
  muted,
  onAim,
  onAds,
  onHit,
  onLockChange,
}: ShootingRangeSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetsRef = useRef(targets);
  const modeRef = useRef(mode);
  const activeRef = useRef(activeIndex);
  const mutedRef = useRef(muted);
  const onAimRef = useRef(onAim);
  const onAdsRef = useRef(onAds);
  const onHitRef = useRef(onHit);
  const onLockChangeRef = useRef(onLockChange);
  const syncRef = useRef<(() => void) | null>(null);
  const lockRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    onAimRef.current = onAim;
    onAdsRef.current = onAds;
    onHitRef.current = onHit;
    onLockChangeRef.current = onLockChange;
    mutedRef.current = muted;
    modeRef.current = mode;
  });

  useEffect(() => {
    activeRef.current = activeIndex;
    syncRef.current?.();
  }, [activeIndex]);

  // Capture the mouse whenever the range is live and no record is open.
  useEffect(() => {
    modeRef.current = mode;
    activeRef.current = activeIndex;
    lockRef.current?.();
  }, [mode, activeIndex]);

  useEffect(() => {
    const idle = window as Window & { requestIdleCallback?: (run: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    let timer = 0;
    let idleId = 0;
    const fetchAhead = () => void loadRange().catch(() => {});
    const loaded = () => {
      timer = window.setTimeout(() => {
        if (idle.requestIdleCallback) idleId = idle.requestIdleCallback(fetchAhead, { timeout: 4000 });
        else fetchAhead();
      }, 1500);
    };
    if (document.readyState === "complete") loaded();
    else window.addEventListener("load", loaded, { once: true });
    return () => {
      window.removeEventListener("load", loaded);
      window.clearTimeout(timer);
      if (idleId) idle.cancelIdleCallback?.(idleId);
    };
  }, []);

  // The range sits far down the page, so the renderer, sky and environment map are
  // only built once it comes near the viewport: otherwise their GPU work holds up
  // the page loading, and any route shutter playing over it.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || armed) return;
    const near = new IntersectionObserver(([entry]) => entry.isIntersecting && setArmed(true), { rootMargin: "800px" });
    near.observe(canvas);
    return () => near.disconnect();
  }, [armed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !armed) return;
    const targetList = targetsRef.current;
    let disposed = false;
    // The range is built a step at a time (shooting-range-build.ts). Whatever
    // exists is released by teardown, which the finished range replaces with its
    // full cleanup.
    const releases: (() => void)[] = [];
    let teardown = () => releases.reverse().forEach((release) => release());
    void loadRange().then(({ buildRange }) => {
      if (disposed) return;
      void buildRange(canvas, {
        targetList,
        releases,
        disposed: () => disposed,
        setTeardown: (next) => (teardown = next),
        modeRef,
        activeRef,
        mutedRef,
        onAimRef,
        onAdsRef,
        onHitRef,
        onLockChangeRef,
        syncRef,
        lockRef,
      });
    }, () => {}); // not fetched (offline): tried again the next time it arms

    return () => {
      disposed = true;
      teardown();
    };
  }, [armed]);

  return (
    <canvas
      className="range-canvas"
      ref={canvasRef}
      tabIndex={0}
      aria-label="First-person shooting range. Move the mouse (or drag on touch) to look around, click or press Space to fire at a capability sign, hold right-click to aim. Arrow keys also aim. Esc pauses."
    />
  );
}
