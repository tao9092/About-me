"use client";

import { useEffect, useRef } from "react";
import { labBoardOn } from "@/components/lab-board";
import type { BoardSize, ChipPlace } from "@/components/lab-board-engine";

// A project's board on the Projects page: a chip carrying the project's initials,
// copper traces fanning out from its pins to vias and the edges, and signals
// running along them without end, faster while the card is hovered. The layout
// grows from the project's slug, so each board is its own and stays the same
// between visits. A private project's board is powered down: dark traces, no
// signals, one red LED blinking. It is drawn off the page's thread
// (lab-board.ts, lab-board-engine.ts); it rests while off screen, and for
// reduced motion it holds still.

export type { ChipPlace };

export function CircuitArt({ slug, label, color, locked = false, chip = {} }: { slug: string; label: string; color: string; locked?: boolean; chip?: ChipPlace }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { x: chipX, y: chipY, max: chipMax } = chip;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const card = canvas.closest<HTMLElement>("[data-board]");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Canvas text can't read CSS variables: the mono face's family, as the page has it.
    const mono = `${getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim() || "ui-monospace"}, ui-monospace, monospace`;
    const size = (): BoardSize => {
      const rect = canvas.getBoundingClientRect();
      return { w: Math.max(1, Math.round(rect.width)), h: Math.max(1, Math.round(rect.height)), dpr: Math.min(window.devicePixelRatio || 1, 2) };
    };
    const place = { x: chipX, y: chipY, max: chipMax };
    const board = labBoardOn(canvas, {
      kind: "circuit",
      options: { slug, label, color, locked, place, mono, reduce, size: size(), timeOrigin: performance.timeOrigin },
    });
    void document.fonts.ready.then(() => board.rebuild()); // the chip's label, in the right face
    const resize = new ResizeObserver(() => board.resize(size()));
    resize.observe(canvas);
    const sight = new IntersectionObserver(([entry]) => board.setVisible(entry.isIntersecting));
    sight.observe(canvas);
    const enter = () => board.hover(true);
    const leave = () => board.hover(false);
    card?.addEventListener("pointerenter", enter);
    card?.addEventListener("pointerleave", leave);
    card?.addEventListener("focusin", enter);
    card?.addEventListener("focusout", leave);
    return () => {
      board.stop();
      resize.disconnect();
      sight.disconnect();
      card?.removeEventListener("pointerenter", enter);
      card?.removeEventListener("pointerleave", leave);
      card?.removeEventListener("focusin", enter);
      card?.removeEventListener("focusout", leave);
    };
  }, [slug, label, color, locked, chipX, chipY, chipMax]);

  return <canvas ref={canvasRef} className="board-canvas" aria-hidden />;
}
