// The Projects boards' drawing: the hero's motherboard (Motherboard) and each
// project's circuit board (CircuitArt). Both are drawn in the lab board worker
// (lab-board-worker.ts) on an OffscreenCanvas, so their frames leave the page's
// thread free; where a worker can't draw, the same code runs on the page.
// Each board is drawn once to a buffer; each frame draws only the signals (and
// the motherboard's glow) over it. A board rests while off screen, and holds
// still for reduced motion.

export type BoardSize = { w: number; h: number; dpr: number };
export type Chip = { slug: string; label: string; color: string; locked: boolean };
/** Where the chip sits ({x, y} as fractions of the panel) and its largest width. */
export type ChipPlace = { x?: number; y?: number; max?: number };
export type MotherboardOptions = { chips: Chip[]; mono: string; reduce: boolean; size: BoardSize };
export type CircuitOptions = { slug: string; label: string; color: string; locked: boolean; place: ChipPlace; mono: string; reduce: boolean; size: BoardSize; timeOrigin: number };
export type BoardControl = {
  resize: (size: BoardSize) => void;
  setVisible: (visible: boolean) => void;
  /** The motherboard: the project now pointed at, or none. */
  focus: (slug: string | null) => void;
  /** A circuit board: its card is hovered or focused. */
  hover: (on: boolean) => void;
  /** Draws the board again (its label's face has loaded). */
  rebuild: () => void;
  stop: () => void;
};
type Canvas = HTMLCanvasElement | OffscreenCanvas;
type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Point = { x: number; y: number };

/** A scratch canvas: a page canvas on the page, an OffscreenCanvas in the worker. */
function scratch(width: number, height: number): Canvas {
  if (typeof document !== "undefined") return Object.assign(document.createElement("canvas"), { width, height });
  return new OffscreenCanvas(width, height);
}
const context2d = (canvas: Canvas) => canvas.getContext("2d") as Context | null;

// ---- The motherboard -------------------------------------------------------

type MotherTrace = { owner: number; points: Point[]; lengths: number[]; total: number };
type Pulse = { trace: MotherTrace; at: number; speed: number };

function motherSeeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function motherMeasure(owner: number, points: Point[]): MotherTrace {
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  return { owner, points, lengths, total: lengths[lengths.length - 1] };
}
function motherPointAt(trace: MotherTrace, distance: number): Point {
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

/** The Projects page's hero: one board carrying every project's chip, wired
 * together with buses and fanning out to the edges, signals running along the
 * traces in each chip's colour. The project pointed at lights its chip and
 * quickens its signals; a private project's chip is dead and taped over. */
export function runMotherboard(canvas: Canvas, { chips, mono, reduce, size }: MotherboardOptions): BoardControl {
  const context = context2d(canvas);
  if (!context || chips.length === 0) return { resize() {}, setVisible() {}, focus() {}, hover() {}, rebuild() {}, stop() {} };
  const rgb = chips.map((chip) => chip.color.split(",").map(Number));
  const ink = (index: number, alpha: number) => `rgba(${rgb[index].join(",")},${alpha})`;
  let view = size;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let board: Canvas | null = null;
  let boxes: Array<{ x: number; y: number; w: number; h: number }> = [];
  let pulses: Pulse[] = [];
  let focused = -1;
  let glow = 0;
  let frame = 0;
  let last = 0;
  let visible = false;

  function build() {
    w = view.w;
    h = view.h;
    dpr = view.dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const random = motherSeeded(chips.length * 7919 + 17);
    // The chips sit in the open part of the board: the right on a wide screen
    // (the title takes the left), the lower half on a narrow one.
    const wide = w >= 900;
    const area = wide ? { x0: w * 0.44, x1: w * 0.97, y0: h * 0.1, y1: h * 0.9 } : { x0: w * 0.05, x1: w * 0.95, y0: h * 0.47, y1: h * 0.74 };
    const cols = Math.min(chips.length, chips.length > 12 ? 5 : chips.length > 6 ? 4 : 3);
    const rows = Math.ceil(chips.length / cols);
    const cellW = (area.x1 - area.x0) / cols;
    const cellH = (area.y1 - area.y0) / rows;
    const boxSize = Math.min(cellW * 0.56, cellH * 0.62 / 0.74, wide ? 136 : 86);
    boxes = chips.map((_, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const offset = row % 2 ? cellW * 0.18 : 0; // alternate rows sit staggered
      const cx = area.x0 + cellW * (col + 0.5) + offset - cellW * 0.09 + (random() - 0.5) * cellW * 0.12;
      const cy = area.y0 + cellH * (row + 0.5) + (random() - 0.5) * cellH * 0.14;
      return { x: cx - boxSize / 2, y: cy - (boxSize * 0.74) / 2, w: boxSize, h: boxSize * 0.74 };
    });
    const traces: MotherTrace[] = [];
    const lanes = [-1, 0, 1];
    // Buses: each chip to the next in its row, and to the one below.
    boxes.forEach((box, index) => {
      const right = index % cols < cols - 1 ? boxes[index + 1] : undefined;
      const below = boxes[index + cols];
      for (const lane of lanes) {
        if (right) traces.push(motherMeasure(index, route({ x: box.x + box.w, y: box.y + box.h / 2 + lane * 9 }, { x: right.x, y: right.y + right.h / 2 + lane * 9 }, true)));
        if (below) traces.push(motherMeasure(index, route({ x: box.x + box.w / 2 + lane * 9, y: box.y + box.h }, { x: below.x + below.w / 2 + lane * 9, y: below.y }, false)));
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
        traces.push(motherMeasure(index, route(a, b, side >= 0.68)));
      }
    });
    // The board, drawn once.
    board = scratch(canvas.width, canvas.height);
    const paint = context2d(board)!;
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
    context!.clearRect(0, 0, canvas.width, canvas.height);
    context!.drawImage(board, 0, 0);
    context!.setTransform(dpr, 0, 0, dpr, 0, 0);
    context!.lineCap = "round";
    for (const pulse of pulses) {
      const lit = pulse.trace.owner === focused;
      pulse.at += pulse.speed * (lit ? 2.6 : 1) * dt;
      if (pulse.at - 30 > pulse.trace.total) pulse.at = -10;
      const head = motherPointAt(pulse.trace, pulse.at);
      const tail = motherPointAt(pulse.trace, pulse.at - (lit ? 46 : 28));
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

  build();
  return {
    resize(next) {
      view = next;
      build();
    },
    setVisible(next) {
      visible = next;
      if (visible) start();
    },
    focus(slug) {
      focused = chips.findIndex((chip) => chip.slug === slug);
      if (reduce) {
        glow = focused >= 0 ? 1 : 0;
        draw(0);
      }
    },
    hover() {},
    rebuild: build,
    stop() {
      cancelAnimationFrame(frame);
    },
  };
}

// ---- A project's circuit board ----------------------------------------------

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

/** A project's board: a chip carrying the project's initials, copper traces
 * fanning out from its pins to vias and the edges, and signals running along
 * them without end, faster while the card is hovered. The layout grows from the
 * project's slug, so each board is its own and stays the same between visits.
 * A private project's board is powered down: dark traces, no signals, one red
 * LED blinking. */
export function runCircuit(canvas: Canvas, { slug, label, color, locked, place, mono, reduce, size, timeOrigin }: CircuitOptions): BoardControl {
  const context = context2d(canvas);
  if (!context) return { resize() {}, setVisible() {}, focus() {}, hover() {}, rebuild() {}, stop() {} };
  const [r, g, b] = color.split(",").map(Number);
  const ink = (alpha: number) => `rgba(${r},${g},${b},${alpha})`;
  // Frame times on the page's clock, so the LED blinks as it would on the page.
  const clock = performance.timeOrigin - timeOrigin;
  let view = size;
  let board: Canvas | null = null;
  let signals: Signal[] = [];
  let w = 0;
  let h = 0;
  let dpr = 1;
  let frame = 0;
  let last = 0;
  let visible = false;
  let pace = 1; // eased towards 2.6 while hovered
  let hovered = false;
  let glow: Canvas | null = null;
  let led = { x: 0, y: 0 };

  function build() {
    w = view.w;
    h = view.h;
    dpr = view.dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const plan = layout(slug, w, h, place);
    // The board, drawn once.
    board = scratch(canvas.width, canvas.height);
    const paint = context2d(board)!;
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
    glow = scratch(48, 48);
    const halo = context2d(glow)!;
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
    draw(now + clock);
    if (visible && !reduce) frame = requestAnimationFrame(tick);
  }
  const start = () => {
    if (!frame && visible && !reduce) {
      last = 0;
      frame = requestAnimationFrame(tick);
    }
  };

  build();
  return {
    resize(next) {
      view = next;
      build();
    },
    setVisible(next) {
      visible = next;
      if (visible) start();
      else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
    focus() {},
    hover(on) {
      hovered = on;
    },
    rebuild: build,
    stop() {
      cancelAnimationFrame(frame);
    },
  };
}
