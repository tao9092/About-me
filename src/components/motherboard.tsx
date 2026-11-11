"use client";

import { useEffect, useRef } from "react";
import { labBoardOn } from "@/components/lab-board";
import type { BoardSize, Chip } from "@/components/lab-board-engine";

// The Projects page's hero: one board carrying every project's chip, wired
// together with buses and fanning out to the edges, signals running along the
// traces in each chip's colour. Pointing at a project's card (it announces
// itself with a "lab:focus" event) lights its chip and quickens its signals.
// A private project's chip is dead and taped over with hazard stripes. It is
// drawn off the page's thread (lab-board.ts, lab-board-engine.ts); it rests off
// screen and holds still for reduced motion.

export type { Chip };

export const focusProject = (slug: string | null) => window.dispatchEvent(new CustomEvent("lab:focus", { detail: slug }));

export function Motherboard({ chips }: { chips: Chip[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || chips.length === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Canvas text can't read CSS variables: the mono face's family, as the page has it.
    const mono = `${getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim() || "ui-monospace"}, ui-monospace, monospace`;
    const size = (): BoardSize => {
      const rect = canvas.getBoundingClientRect();
      return { w: Math.max(1, Math.round(rect.width)), h: Math.max(1, Math.round(rect.height)), dpr: Math.min(window.devicePixelRatio || 1, 2) };
    };
    const board = labBoardOn(canvas, { kind: "motherboard", options: { chips, mono, reduce, size: size() } });
    void document.fonts.ready.then(() => board.rebuild());
    const resize = new ResizeObserver(() => board.resize(size()));
    resize.observe(canvas);
    const sight = new IntersectionObserver(([entry]) => board.setVisible(entry.isIntersecting));
    sight.observe(canvas);
    const onFocus = (event: Event) => board.focus((event as CustomEvent<string | null>).detail);
    window.addEventListener("lab:focus", onFocus);
    return () => {
      board.stop();
      resize.disconnect();
      sight.disconnect();
      window.removeEventListener("lab:focus", onFocus);
    };
  }, [chips]);

  return <canvas ref={canvasRef} className="lab-mother" aria-hidden />;
}
