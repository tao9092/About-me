"use client";

import { useEffect, useRef } from "react";

// The Projects page's hero: one board carrying every project's chip, wired
// together with buses and fanning out to the edges, signals running along the
// traces in each chip's colour. Pointing at a project's card (it announces
// itself with a "lab:focus" event) lights its chip and quickens its signals.
// A private project's chip is dead and taped over with hazard stripes. The
// board is drawn once to a buffer; each frame draws only the signals and the
// glow; it rests off screen and holds still for reduced motion.

export type Chip = { slug: string; label: string; color: string; locked: boolean };
type Point = { x: number; y: number };
type Trace = { owner: number; points: Point[]; lengths: number[]; total: number };
type Pulse = { trace: Trace; at: number; speed: number };

export const focusProject = (slug: string | null) => window.dispatchEvent(new CustomEvent("lab:focus", { detail: slug }));

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function measure(owner: number, points: Point[]): Trace {
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  return { owner, points, lengths, total: lengths[lengths.length - 1] };
}
function pointAt(trace: Trace, distance: number): Point {
  const d = Math.max(0, Math.min(trace.total, distance));
  let i = 1;
  while (i < trace.lengths.length - 1 && trace.lengths[i] < d) i += 1;
  const [a, b] = [trace.points[i - 1], trace.points[i]];
  const t = (d - trace.lengths[i - 1]) / (trace.lengths[i] - trace.lengths[i - 1] || 1);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
/** From a to b along the board's grain: straight, one 45° jog to close the gap across, straight again. */
function route(a: Point, b: Point, horizontal: boolean): Point[] {
  if (horizontal) {
    const dy = b.y - a.y;
    const mid = (a.x + b.x) / 2;
    const jog = Math.min(Math.abs(dy), Math.abs(b.x - a.x) * 0.4);
    return [a, { x: mid - jog / 2, y: a.y }, { x: mid + jog / 2, y: b.y }, b];
  }
  const dx = b.x - a.x;
  const mid = (a.y + b.y) / 2;
  const jog = Math.min(Math.abs(dx), Math.abs(b.y - a.y) * 0.4);
  return [a, { x: a.x, y: mid - jog / 2 }, { x: b.x, y: mid + jog / 2 }, b];
}

export function Motherboard({ chips }: { chips: Chip[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || chips.length === 0) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mono = `${getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono").trim() || "ui-monospace"}, ui-monospace, monospace`;
    const rgb = chips.map((chip) => chip.color.split(",").map(Number));
    const ink = (index: number, alpha: number) => `rgba(${rgb[index].join(",")},${alpha})`;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let board: HTMLCanvasElement | null = null;
    let boxes: Array<{ x: number; y: number; w: number; h: number }> = [];
    let pulses: Pulse[] = [];
    let focused = -1;
    let glow = 0;
    let frame = 0;
    let last = 0;
    let visible = false;

    function build() {
      const rect = canvas!.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      const random = seeded(chips.length * 7919 + 17);
      // The chips sit in the open part of the board: the right on a wide screen
      // (the title takes the left), the lower half on a narrow one.
      const wide = w >= 900;
      const area = wide ? { x0: w * 0.44, x1: w * 0.97, y0: h * 0.1, y1: h * 0.9 } : { x0: w * 0.05, x1: w * 0.95, y0: h * 0.47, y1: h * 0.74 };
      const cols = Math.min(chips.length, chips.length > 12 ? 5 : chips.length > 6 ? 4 : 3);
      const rows = Math.ceil(chips.length / cols);
      const cellW = (area.x1 - area.x0) / cols;
      const cellH = (area.y1 - area.y0) / rows;
      const size = Math.min(cellW * 0.56, cellH * 0.62 / 0.74, wide ? 136 : 86);
      boxes = chips.map((_, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const offset = row % 2 ? cellW * 0.18 : 0; // alternate rows sit staggered
        const cx = area.x0 + cellW * (col + 0.5) + offset - cellW * 0.09 + (random() - 0.5) * cellW * 0.12;
        const cy = area.y0 + cellH * (row + 0.5) + (random() - 0.5) * cellH * 0.14;
        return { x: cx - size / 2, y: cy - (size * 0.74) / 2, w: size, h: size * 0.74 };
      });
      const traces: Trace[] = [];
      const lanes = [-1, 0, 1];
      // Buses: each chip to the next in its row, and to the one below.
      boxes.forEach((box, index) => {
        const right = index % cols < cols - 1 ? boxes[index + 1] : undefined;
        const below = boxes[index + cols];
        for (const lane of lanes) {
          if (right) traces.push(measure(index, route({ x: box.x + box.w, y: box.y + box.h / 2 + lane * 9 }, { x: right.x, y: right.y + right.h / 2 + lane * 9 }, true)));
          if (below) traces.push(measure(index, route({ x: box.x + box.w / 2 + lane * 9, y: box.y + box.h }, { x: below.x + below.w / 2 + lane * 9, y: below.y }, false)));
        }
        // Fan-outs to the edges: up, down, and from the first column a long run left.
        const fan = 4 + Math.floor(random() * 3);
        for (let k = 0; k < fan; k += 1) {
          const side = random();
          const along = 0.15 + random() * 0.7;
          let a: Point;
          let b: Point;
          if (side < 0.34) {
            a = { x: box.x + box.w * along, y: box.y };
            b = { x: a.x + (random() - 0.5) * 120, y: -6 };
          } else if (side < 0.68) {
            a = { x: box.x + box.w * along, y: box.y + box.h };
            b = { x: a.x + (random() - 0.5) * 120, y: h + 6 };
          } else if (index % cols === 0) {
            a = { x: box.x, y: box.y + box.h * along };
            b = { x: -6, y: a.y + (random() - 0.5) * 160 };
          } else {
            a = { x: box.x + box.w, y: box.y + box.h * along };
            b = { x: w + 6, y: a.y + (random() - 0.5) * 120 };
          }
          traces.push(measure(index, route(a, b, side >= 0.68)));
        }
      });
      // The board, drawn once.
      board = document.createElement("canvas");
      board.width = canvas!.width;
      board.height = canvas!.height;
      const paint = board.getContext("2d")!;
      paint.scale(dpr, dpr);
      paint.fillStyle = "rgba(150,255,210,.05)";
      for (let x = 8; x < w; x += 16) for (let y = 8; y < h; y += 16) paint.fillRect(x, y, 1, 1);
      paint.lineCap = "round";
      paint.lineJoin = "round";
      paint.lineWidth = 1.4;
      for (const trace of traces) {
        paint.beginPath();
        trace.points.forEach((point, i) => (i ? paint.lineTo(point.x, point.y) : paint.moveTo(point.x, point.y)));
        paint.strokeStyle = chips[trace.owner].locked ? "rgba(140,150,148,.12)" : ink(trace.owner, 0.18);
        paint.stroke();
      }
      boxes.forEach((box, index) => {
        const chip = chips[index];
        paint.fillStyle = chip.locked ? "rgba(150,160,158,.3)" : ink(index, 0.6);
        for (let k = 1; k < 9; k += 1) {
          for (const y of [box.y - 3, box.y + box.h]) paint.fillRect(box.x + (box.w / 9) * k - 1.5, y, 3, 3);
          for (const x of [box.x - 3, box.x + box.w]) paint.fillRect(x, box.y + (box.h / 9) * k - 1.5, 3, 3);
        }
        paint.fillStyle = "#050707";
        paint.fillRect(box.x, box.y, box.w, box.h);
        paint.strokeStyle = chip.locked ? "rgba(150,160,158,.35)" : ink(index, 0.5);
        paint.lineWidth = 1;
        paint.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
        if (chip.locked) {
          // Taped over: hazard stripes across the dead chip.
          paint.save();
          paint.beginPath();
          paint.rect(box.x, box.y + box.h * 0.36, box.w, box.h * 0.28);
          paint.clip();
          for (let x = box.x - box.h; x < box.x + box.w + box.h; x += 14) {
            paint.beginPath();
            paint.moveTo(x, box.y + box.h);
            paint.lineTo(x + 7, box.y + box.h);
            paint.lineTo(x + 7 + box.h, box.y);
            paint.lineTo(x + box.h, box.y);
            paint.fillStyle = "rgba(255,210,31,.92)";
            paint.fill();
          }
          paint.restore();
        }
        paint.textAlign = "center";
        paint.textBaseline = "middle";
        paint.fillStyle = chip.locked ? "rgba(200,205,204,.4)" : "rgba(240,255,250,.94)";
        paint.font = `600 ${Math.round(box.w * 0.24)}px ${mono}`;
        paint.fillText(chip.label, box.x + box.w / 2, box.y + box.h * (chip.locked ? 0.22 : 0.44));
        paint.font = `500 ${Math.max(8, Math.round(box.w * 0.075))}px ${mono}`;
        paint.fillStyle = chip.locked ? "rgba(200,205,204,.35)" : ink(index, 0.8);
        paint.fillText(chip.locked ? "PRIVATE" : `P/${String(index + 1).padStart(2, "0")}`, box.x + box.w / 2, box.y + box.h * (chip.locked ? 0.82 : 0.72));
      });
      pulses = traces
        .filter((trace) => !chips[trace.owner].locked)
        .map((trace) => ({ trace, at: random() * trace.total, speed: 50 + random() * 70 }));
      draw(0);
    }

    function draw(dt: number) {
      if (!board) return;
      context!.setTransform(1, 0, 0, 1, 0, 0);
      context!.clearRect(0, 0, canvas!.width, canvas!.height);
      context!.drawImage(board, 0, 0);
      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
      context!.lineCap = "round";
      for (const pulse of pulses) {
        const lit = pulse.trace.owner === focused;
        pulse.at += pulse.speed * (lit ? 2.6 : 1) * dt;
        if (pulse.at - 30 > pulse.trace.total) pulse.at = -10;
        const head = pointAt(pulse.trace, pulse.at);
        const tail = pointAt(pulse.trace, pulse.at - (lit ? 46 : 28));
        const gradient = context!.createLinearGradient(tail.x, tail.y, head.x, head.y);
        gradient.addColorStop(0, ink(pulse.trace.owner, 0));
        gradient.addColorStop(1, ink(pulse.trace.owner, lit ? 1 : 0.75));
        context!.strokeStyle = gradient;
        context!.lineWidth = lit ? 2.4 : 1.8;
        context!.beginPath();
        context!.moveTo(tail.x, tail.y);
        context!.lineTo(head.x, head.y);
        context!.stroke();
        context!.fillStyle = lit ? "#ffffff" : ink(pulse.trace.owner, 0.95);
        context!.fillRect(head.x - 1.5, head.y - 1.5, 3, 3);
      }
      // The focused chip glows.
      if (focused >= 0 && glow > 0.01) {
        const box = boxes[focused];
        const color = chips[focused].locked ? "255,210,31" : chips[focused].color;
        context!.shadowColor = `rgba(${color},${0.9 * glow})`;
        context!.shadowBlur = 28 * glow;
        context!.strokeStyle = `rgba(${color},${glow})`;
        context!.lineWidth = 2;
        context!.strokeRect(box.x - 4, box.y - 4, box.w + 8, box.h + 8);
        context!.shadowBlur = 0;
      }
    }

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      glow += ((focused >= 0 ? 1 : 0) - glow) * Math.min(1, dt * 8);
      draw(dt);
      frame = visible && !reduce ? requestAnimationFrame(tick) : 0;
    };
    const start = () => {
      if (!frame && visible && !reduce) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const onFocus = (event: Event) => {
      const slug = (event as CustomEvent<string | null>).detail;
      focused = chips.findIndex((chip) => chip.slug === slug);
      if (reduce) {
        glow = focused >= 0 ? 1 : 0;
        draw(0);
      }
    };

    build();
    void document.fonts.ready.then(() => build());
    const resize = new ResizeObserver(() => build());
    resize.observe(canvas);
    const sight = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    });
    sight.observe(canvas);
    window.addEventListener("lab:focus", onFocus);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      sight.disconnect();
      window.removeEventListener("lab:focus", onFocus);
    };
  }, [chips]);

  return <canvas ref={canvasRef} className="lab-mother" aria-hidden />;
}
