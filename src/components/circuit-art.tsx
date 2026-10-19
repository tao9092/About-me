"use client";

import { useEffect, useRef } from "react";

// A project's board on the Projects page: a chip carrying the project's initials,
// copper traces fanning out from its pins to vias and the edges, and signals
// running along them without end, faster while the card is hovered. The layout
// grows from the project's slug, so each board is its own and stays the same
// between visits. A private project's board is powered down: dark traces, no
// signals, one red LED blinking. The board is drawn once to a buffer and only
// the signals are drawn each frame; it rests while off screen, and for reduced
// motion it holds still.

type Point = { x: number; y: number };
type Trace = { points: Point[]; lengths: number[]; total: number };
type Signal = { trace: Trace; at: number; speed: number; trail: number };

/** mulberry32, seeded from the slug: the same board for the same project. */
function seeded(text: string) {
  let seed = 2166136261;
  for (let index = 0; index < text.length; index += 1) seed = Math.imul(seed ^ text.charCodeAt(index), 16777619);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function measure(points: Point[]): Trace {
  const lengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    lengths.push(lengths[index - 1] + Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y));
  }
  return { points, lengths, total: lengths[lengths.length - 1] };
}
function pointAt(trace: Trace, distance: number): Point {
  const d = Math.max(0, Math.min(trace.total, distance));
  let index = 1;
  while (index < trace.lengths.length - 1 && trace.lengths[index] < d) index += 1;
  const from = trace.points[index - 1];
  const to = trace.points[index];
  const span = trace.lengths[index] - trace.lengths[index - 1] || 1;
  const t = (d - trace.lengths[index - 1]) / span;
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

/** Where the chip sits ({x, y} as fractions of the panel) and its largest width. */
export type ChipPlace = { x?: number; y?: number; max?: number };

/** The board's layout for a w × h panel: the chip, its traces and the parts around them. */
function layout(slug: string, w: number, h: number, place: ChipPlace) {
  const random = seeded(slug);
  // A chip placed beside a page's title moves up out of its way on a narrow panel.
  if (place.x !== undefined && w < 640) place = { x: 0.7, y: 0.2, max: Math.min(place.max ?? 150, 110) };
  const max = place.max ?? 150;
  const chip = { w: Math.min(w * 0.26, max), h: Math.min(h * 0.36, max * 0.79) };
  // Drawn even when the place is given, so the rest of the board stays the same.
  const [rx, ry] = [random(), random()];
  const cx = w * (place.x ?? 0.42 + rx * 0.16);
  const cy = h * (place.y ?? 0.44 + ry * 0.12);
  const box = { x: cx - chip.w / 2, y: cy - chip.h / 2, w: chip.w, h: chip.h };
  const pitch = 11;
  const traces: Trace[] = [];
  const pins: Point[] = [];
  const vias: Point[] = [];
  // Pins along each side; about half lead off as traces: out from the chip,
  // a 45° bend, then on to a via or off the board.
  const sides = [
    { count: Math.floor(box.w / pitch) - 1, at: (k: number) => ({ x: box.x + (k + 1) * pitch, y: box.y }), out: { x: 0, y: -1 } },
    { count: Math.floor(box.w / pitch) - 1, at: (k: number) => ({ x: box.x + (k + 1) * pitch, y: box.y + box.h }), out: { x: 0, y: 1 } },
    { count: Math.floor(box.h / pitch) - 1, at: (k: number) => ({ x: box.x, y: box.y + (k + 1) * pitch }), out: { x: -1, y: 0 } },
    { count: Math.floor(box.h / pitch) - 1, at: (k: number) => ({ x: box.x + box.w, y: box.y + (k + 1) * pitch }), out: { x: 1, y: 0 } },
  ];
  for (const side of sides) {
    const bend = random() < 0.5 ? -1 : 1; // traces on one side bend together, like a bus
    for (let k = 0; k < side.count; k += 1) {
      const pin = side.at(k);
      pins.push(pin);
      if (random() < 0.42) continue;
      const first = 10 + random() * 26 + (side.out.x ? Math.abs(k - side.count / 2) * 4 : Math.abs(k - side.count / 2) * 3);
      const a = { x: pin.x + side.out.x * first, y: pin.y + side.out.y * first };
      const diagonal = 14 + random() * 40;
      const b = {
        x: a.x + (side.out.x || bend) * diagonal * (side.out.x ? 0.7 : 1),
        y: a.y + (side.out.y || bend) * diagonal * (side.out.y ? 0.7 : 1),
      };
      const reach = random() < 0.55 ? 2000 : 30 + random() * 120;
      const c = { x: b.x + side.out.x * reach, y: b.y + side.out.y * reach };
      // Clip the run to the board's edge.
      c.x = Math.max(-4, Math.min(w + 4, c.x));
      c.y = Math.max(-4, Math.min(h + 4, c.y));
      if (reach < 2000) vias.push(c);
      traces.push(measure([pin, a, b, c]));
    }
  }
  // Small parts dotted about: resistors and capacitors away from the chip.
  const parts: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (let k = 0; k < 9; k += 1) {
    const vertical = random() < 0.5;
    const part = { x: random() * w, y: random() * h, w: vertical ? 6 : 14, h: vertical ? 14 : 6 };
    if (Math.abs(part.x - cx) < chip.w * 0.9 && Math.abs(part.y - cy) < chip.h * 0.9) continue;
    parts.push(part);
  }
  return { random, box, pins, traces, vias, parts };
}

export function CircuitArt({ slug, label, color, locked = false, chip = {} }: { slug: string; label: string; color: string; locked?: boolean; chip?: ChipPlace }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { x: chipX, y: chipY, max: chipMax } = chip;

  useEffect(() => {
    const canvas = canvasRef.current;
    const card = canvas?.closest<HTMLElement>("[data-board]");
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const place = { x: chipX, y: chipY, max: chipMax };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const [r, g, b] = color.split(",").map(Number);
    const ink = (alpha: number) => `rgba(${r},${g},${b},${alpha})`;
    let board: HTMLCanvasElement | null = null;
    let signals: Signal[] = [];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let frame = 0;
    let last = 0;
    let visible = false;
    let pace = 1; // eased towards 2.6 while hovered
    let hovered = false;
    let glow: HTMLCanvasElement | null = null;
    // Canvas text can't read CSS variables: the mono face's family, as the page has it.
    const mono = `${getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim() || "ui-monospace"}, ui-monospace, monospace`;

    function build() {
      const rect = canvas!.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      const plan = layout(slug, w, h, place);
      // The board, drawn once.
      board = document.createElement("canvas");
      board.width = canvas!.width;
      board.height = canvas!.height;
      const paint = board.getContext("2d")!;
      paint.scale(dpr, dpr);
      const base = paint.createRadialGradient(plan.box.x + plan.box.w / 2, plan.box.y + plan.box.h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.75);
      base.addColorStop(0, locked ? "#0b1413" : `rgba(${Math.round(r * 0.09)},${Math.round(g * 0.09 + 22)},${Math.round(b * 0.09 + 20)},1)`);
      base.addColorStop(1, "#010f0e");
      paint.fillStyle = base;
      paint.fillRect(0, 0, w, h);
      // The fibreglass weave: a faint dot grid.
      paint.fillStyle = locked ? "rgba(140,160,158,.06)" : ink(0.07);
      for (let x = 6; x < w; x += 12) for (let y = 6; y < h; y += 12) paint.fillRect(x, y, 1, 1);
      const copper = locked ? "rgba(120,140,138,.16)" : ink(0.24);
      paint.lineCap = "round";
      paint.lineJoin = "round";
      paint.lineWidth = 1.6;
      paint.strokeStyle = copper;
      for (const trace of plan.traces) {
        paint.beginPath();
        trace.points.forEach((point, index) => (index ? paint.lineTo(point.x, point.y) : paint.moveTo(point.x, point.y)));
        paint.stroke();
      }
      for (const via of plan.vias) {
        paint.beginPath();
        paint.arc(via.x, via.y, 3.2, 0, Math.PI * 2);
        paint.fillStyle = "#010f0e";
        paint.fill();
        paint.lineWidth = 1.4;
        paint.strokeStyle = locked ? "rgba(120,140,138,.3)" : ink(0.5);
        paint.stroke();
      }
      paint.fillStyle = locked ? "rgba(120,140,138,.18)" : ink(0.22);
      for (const part of plan.parts) {
        paint.fillRect(part.x, part.y, part.w, part.h);
        paint.clearRect(part.x + (part.w > part.h ? part.w / 2 - 1 : 0), part.y + (part.h > part.w ? part.h / 2 - 1 : 0), part.w > part.h ? 2 : part.w, part.h > part.w ? 2 : part.h);
      }
      // The chip: pins, a dark package with a bevel, a notch, its label.
      paint.fillStyle = locked ? "rgba(150,165,163,.35)" : ink(0.55);
      for (const pin of plan.pins) paint.fillRect(pin.x - 1.5, pin.y - 1.5, 3, 3);
      const { box } = plan;
      paint.fillStyle = "#03100f";
      paint.fillRect(box.x + 3, box.y + 3, box.w - 6, box.h - 6);
      paint.lineWidth = 1;
      paint.strokeStyle = locked ? "rgba(150,165,163,.3)" : ink(0.45);
      paint.strokeRect(box.x + 3.5, box.y + 3.5, box.w - 7, box.h - 7);
      paint.beginPath();
      paint.arc(box.x + 12, box.y + 12, 3, 0, Math.PI * 2);
      paint.fillStyle = locked ? "rgba(150,165,163,.25)" : ink(0.35);
      paint.fill();
      paint.textAlign = "center";
      paint.textBaseline = "middle";
      paint.fillStyle = locked ? "rgba(190,200,199,.5)" : "rgba(237,255,254,.92)";
      paint.font = `600 ${Math.round(Math.min(box.w * 0.3, 38))}px ${mono}`;
      paint.fillText(label, box.x + box.w / 2, box.y + box.h / 2 - 4);
      paint.font = `500 8px ${mono}`;
      paint.fillStyle = locked ? "rgba(190,200,199,.35)" : ink(0.75);
      paint.fillText(locked ? "OFFLINE" : `${slug.slice(0, 10).toUpperCase()}`, box.x + box.w / 2, box.y + box.h / 2 + Math.min(box.w * 0.17, 22));
      // A signal's head: a soft glow, made once and stamped.
      glow = document.createElement("canvas");
      glow.width = glow.height = 48;
      const halo = glow.getContext("2d")!;
      const light = halo.createRadialGradient(24, 24, 0, 24, 24, 24);
      light.addColorStop(0, "rgba(255,255,255,1)");
      light.addColorStop(0.18, ink(0.95));
      light.addColorStop(0.5, ink(0.25));
      light.addColorStop(1, ink(0));
      halo.fillStyle = light;
      halo.fillRect(0, 0, 48, 48);
      signals = locked
        ? []
        : plan.traces.map((trace) => ({ trace, at: plan.random() * trace.total, speed: 40 + plan.random() * 70, trail: 26 + plan.random() * 40 }));
      // The LED by the chip, for a board that's powered down.
      led = { x: box.x + box.w + 14, y: box.y - 8 };
      draw(0);
    }
    let led = { x: 0, y: 0 };

    function draw(time: number) {
      if (!board) return;
      context!.setTransform(1, 0, 0, 1, 0, 0);
      context!.drawImage(board, 0, 0);
      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (locked) {
        const on = Math.sin(time / 520) > 0.55;
        context!.beginPath();
        context!.arc(led.x, led.y, 2.6, 0, Math.PI * 2);
        context!.fillStyle = on ? "rgba(255,72,72,.95)" : "rgba(120,30,30,.6)";
        context!.fill();
        if (on) {
          context!.beginPath();
          context!.arc(led.x, led.y, 9, 0, Math.PI * 2);
          context!.fillStyle = "rgba(255,72,72,.16)";
          context!.fill();
        }
        return;
      }
      context!.lineCap = "round";
      for (const signal of signals) {
        const head = pointAt(signal.trace, signal.at);
        // The trail: a few steps back along the trace, fading.
        const steps = 6;
        let previous = head;
        for (let step = 1; step <= steps; step += 1) {
          const point = pointAt(signal.trace, signal.at - (signal.trail * step) / steps);
          context!.beginPath();
          context!.moveTo(previous.x, previous.y);
          context!.lineTo(point.x, point.y);
          context!.strokeStyle = ink(0.85 * (1 - step / (steps + 1)));
          context!.lineWidth = 2;
          context!.stroke();
          previous = point;
        }
        context!.drawImage(glow!, head.x - 12, head.y - 12, 24, 24);
      }
    }

    function tick(now: number) {
      frame = 0;
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      pace += ((hovered ? 2.6 : 1) - pace) * Math.min(1, dt * 4);
      for (const signal of signals) {
        signal.at += signal.speed * pace * dt;
        if (signal.at - signal.trail > signal.trace.total) signal.at = -signal.trail * 0.2; // round again from the chip
      }
      draw(now);
      if (visible && !reduce) frame = requestAnimationFrame(tick);
    }
    const start = () => {
      if (!frame && visible && !reduce) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };

    build();
    void document.fonts.ready.then(() => build()); // the chip's label, in the right face
    const resize = new ResizeObserver(() => build());
    resize.observe(canvas);
    const sight = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    sight.observe(canvas);
    const enter = () => (hovered = true);
    const leave = () => (hovered = false);
    card?.addEventListener("pointerenter", enter);
    card?.addEventListener("pointerleave", leave);
    card?.addEventListener("focusin", enter);
    card?.addEventListener("focusout", leave);
    return () => {
      cancelAnimationFrame(frame);
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
