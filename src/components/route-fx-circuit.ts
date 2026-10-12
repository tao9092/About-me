// ── Projects: a macro shot of a circuit board powering up. Light runs out
// along the traces from the processor and code drifts up off the die, then the
// camera rises over the chip and dives into the die, through ever finer
// circuitry, until its core opens onto the page ─────────────────────────────
// A small 3D scene: the board lies in the y = 0 plane, one unit is a centimetre.
import {
  burst,
  cinema,
  clamp01,
  defocused,
  dot,
  drawSparks,
  easeIn,
  easeInOut,
  easeOut,
  type Fx,
  glint,
  type Look,
  lerp,
  makeCanvas,
  MONO,
  motes,
  pick,
  rand,
  scaled,
  type Spark,
  TAU,
  terminal,
} from "@/components/route-fx-kit";
import {
  add3,
  aim,
  box,
  type Camera,
  develop,
  type Finish,
  type Focus,
  type Light,
  mix3,
  mul3,
  patchTransform,
  polygonPath,
  project,
  sizeAt,
  stage,
  toView,
  unit3,
  type Vec3,
} from "@/components/route-fx-3d";

const PACKAGE = 2.1; // half the side of the processor package
const DIE = 0.85; // half the side of the bare die on top of it
const SUBSTRATE = 0.12; // package height
const DIE_TOP = 0.2;
const CYAN = "159,244,255";
const VIOLET = "198,154,255";
// Cool light raking the board from behind, so edges and the die catch it.
const KEY: Light = { dir: unit3([-0.35, 0.62, -0.7]), color: [214, 200, 255], highlight: "rgb(226,220,255)" };
const EPOXY: Finish = { color: [20, 20, 28], shine: 70 };
const SUBSTRATE_FINISH: Finish = { color: [16, 24, 20], shine: 80 };
const CERAMIC: Finish = { color: [104, 82, 58], shine: 40 };
const TIN: Finish = { color: [150, 152, 162], shine: 30 };
const AXES: [Vec3, Vec3, Vec3] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const SOURCE = "{}<>/=;()[]=>&&||!==++01λΣ#$constletasyncawaitexportfunctionreturn";

const RING = Array.from({ length: 12 }, (_, k) => [Math.cos((k / 12) * TAU), Math.sin((k / 12) * TAU)]);
type Trace = { points: Vec3[]; legs: number[]; length: number };
/** Buses of parallel traces leave each side of the package, jog 45° and run off the board. */
function routeTraces(): Trace[] {
  const traces: Trace[] = [];
  const directions: Vec3[] = [[1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1]];
  for (const out of directions) {
    const across: Vec3 = [-out[2], 0, out[0]];
    for (const [offset, lanes] of [[-1.6, 7], [0.5, 6]] as const) {
      const bend = Math.random() < 0.5 ? 1 : -1;
      const [first, jog, last] = [rand(0.5, 1.4), rand(0.5, 1.6), rand(4, 11)];
      for (let lane = 0; lane < lanes; lane++) {
        // Lanes on the inside of the jog turn first, so the bus keeps its spacing.
        const stagger = (bend > 0 ? lanes - 1 - lane : lane) * 0.07;
        const p0 = add3(mul3(out, PACKAGE + 0.04), mul3(across, offset + lane * 0.17));
        const p1 = add3(p0, mul3(out, first + stagger));
        const p2 = add3(p1, mul3(add3(out, mul3(across, bend)), jog / Math.SQRT2));
        const p3 = add3(p2, mul3(out, last));
        const legs = [first + stagger, jog, last];
        traces.push({ points: [p0, p1, p2, p3].map((point): Vec3 => [point[0], 0.002, point[2]]), legs, length: legs.reduce((a, b) => a + b, 0) });
      }
    }
  }
  return traces;
}
/** The point a distance along a trace. */
function pointAlong(trace: Trace, distance: number): Vec3 {
  let left = distance;
  for (let leg = 0; leg < trace.legs.length; leg++) {
    if (left <= trace.legs[leg]) return mix3(trace.points[leg], trace.points[leg + 1], left / trace.legs[leg]);
    left -= trace.legs[leg];
  }
  return trace.points[trace.points.length - 1];
}
/** Adds a flat strip between two points on the board to the current path. */
function strip(ctx: CanvasRenderingContext2D, cam: Camera, a: Vec3, b: Vec3, half: number) {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const length = Math.hypot(dx, dz) || 1;
  const nx = (-dz / length) * half;
  const nz = (dx / length) * half;
  const corners = [
    project(cam, [a[0] + nx, a[1], a[2] + nz]),
    project(cam, [b[0] + nx, b[1], b[2] + nz]),
    project(cam, [b[0] - nx, b[1], b[2] - nz]),
    project(cam, [a[0] - nx, a[1], a[2] - nz]),
  ].flatMap((corner) => (corner ? [corner] : []));
  if (corners.length < 4) return;
  corners.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}
/** Adds the powered part of every trace, up to how far the power has spread, to the path. */
function poweredStrips(ctx: CanvasRenderingContext2D, cam: Camera, traces: Trace[], wave: number, half: number) {
  ctx.beginPath();
  for (const trace of traces) {
    let reached = PACKAGE;
    for (let leg = 0; leg < 3; leg++) {
      if (reached < wave) strip(ctx, cam, trace.points[leg], mix3(trace.points[leg], trace.points[leg + 1], clamp01((wave - reached) / trace.legs[leg])), half);
      reached += trace.legs[leg];
    }
  }
}

// The die, drawn once: cores, cache arrays, buses and the I/O ring, plus a tile of
// standard cells for the deep zoom.
let dieSprites: { die: HTMLCanvasElement; cells: HTMLCanvasElement } | null = null;
function dieArt() {
  if (dieSprites) return dieSprites;
  const size = 1024;
  const die = makeCanvas();
  die.width = die.height = size;
  const g = die.getContext("2d");
  if (g) {
    g.fillStyle = "#0b0a1e";
    g.fillRect(0, 0, size, size);
    // I/O ring of bond pads.
    g.fillStyle = "#3a3358";
    for (let k = 0; k < 40; k++) {
      const at = 40 + k * 23.5;
      g.fillRect(at, 14, 14, 18);
      g.fillRect(at, size - 32, 14, 18);
      g.fillRect(14, at, 18, 14);
      g.fillRect(size - 32, at, 18, 14);
    }
    // Eight cores in two rows, each with register files and logic.
    for (let row = 0; row < 2; row++) {
      for (let column = 0; column < 4; column++) {
        const x = 70 + column * 226;
        const y = 70 + row * 300;
        g.fillStyle = "#17143a";
        g.fillRect(x, y, 206, 272);
        g.fillStyle = "#231d52";
        for (let line = 0; line < 46; line++) g.fillRect(x + 10, y + 12 + line * 2.6, 186, 1.2);
        for (let block = 0; block < 60; block++) {
          g.fillStyle = pick(["#2c2466", "#1d2f5a", "#3b2a6e", "#173d4f", "#4a3a2a"]);
          g.fillRect(x + 10 + Math.floor(Math.random() * 18) * 10, y + 140 + Math.floor(Math.random() * 12) * 10, 8 + Math.random() * 24, 6 + Math.random() * 12);
        }
        g.strokeStyle = "rgba(159,244,255,0.5)";
        g.lineWidth = 1.5;
        g.strokeRect(x + 0.5, y + 0.5, 205, 271);
      }
    }
    // The shared cache: dense rows of memory cells.
    g.fillStyle = "#141236";
    g.fillRect(70, 690, 884, 260);
    for (let line = 0; line < 100; line++) {
      g.fillStyle = line % 10 === 0 ? "#2b2a66" : "#1d1c4a";
      g.fillRect(80, 698 + line * 2.4, 864, 1.1);
    }
    for (let bank = 1; bank < 8; bank++) {
      g.fillStyle = "#0b0a1e";
      g.fillRect(70 + bank * 110.5, 690, 3, 260);
    }
    // Buses between the cores and the cache.
    g.strokeStyle = "rgba(198,154,255,0.7)";
    g.lineWidth = 2;
    for (let bus = 0; bus < 9; bus++) {
      g.beginPath();
      g.moveTo(60 + bus * 113, 650);
      g.lineTo(60 + bus * 113, 690);
      g.stroke();
    }
    g.fillStyle = "rgba(255,226,170,0.55)";
    g.font = `600 22px ${MONO}`;
    g.fillText("AH-2026  PROJECTS", 80, 980);
  }
  const cells = makeCanvas();
  cells.width = cells.height = 256;
  const c = cells.getContext("2d");
  if (c) {
    c.fillStyle = "#0a0920";
    c.fillRect(0, 0, 256, 256);
    // Rows of standard cells under horizontal and vertical metal.
    for (let row = 0; row < 16; row++) {
      let x = 0;
      while (x < 256) {
        const width = 6 + Math.floor(Math.random() * 5) * 4;
        c.fillStyle = pick(["#1f1a4a", "#28215c", "#1b2650", "#2c2254"]);
        c.fillRect(x + 1, row * 16 + 2, width - 2, 12);
        x += width;
      }
    }
    c.fillStyle = "rgba(159,244,255,0.32)";
    for (let k = 0; k < 16; k++) c.fillRect(0, k * 16, 256, 1);
    c.fillStyle = "rgba(198,154,255,0.28)";
    for (let k = 0; k < 24; k++) c.fillRect(Math.floor(Math.random() * 64) * 4, 0, 1, 256);
  }
  dieSprites = { die, cells };
  return dieSprites;
}
// Code characters with a soft glow, drawn once each and stamped with drawImage.
const glyphSprites = new Map<string, HTMLCanvasElement>();
function glyphSprite(char: string, color: string) {
  const key = char + color;
  let sprite = glyphSprites.get(key);
  if (!sprite) {
    sprite = makeCanvas();
    sprite.width = sprite.height = 64;
    const g = sprite.getContext("2d");
    if (g) {
      g.font = `600 40px ${MONO}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.shadowColor = `rgba(${color},0.9)`;
      g.shadowBlur = 10;
      g.fillStyle = `rgb(${color})`;
      g.fillText(char, 32, 33);
    }
    glyphSprites.set(key, sprite);
  }
  return sprite;
}

// The shot skims the board at the processor's corner; tall screens frame the chip itself.
const SHOT = { eye: [4.2, 2.0, 3.8] as Vec3, target: [0.1, 0.25, 0.05] as Vec3, fov: 0.6 };
const SHOT_TALL = { eye: [3.4, 2.2, 3.3] as Vec3, target: [0.1, 0.25, 0.05] as Vec3, fov: 0.9 };
const PULL_BACK: Vec3 = [2.2, 0.8, 2.0];
const ABOVE: Vec3 = [0, 14, 0];
const CRANE_BEND: Vec3 = [6, 9, 6];
const LAST_HEIGHT = 0.03; // over the die when its core opens

export function circuit(): Fx {
  const traces = routeTraces();
  const art = dieArt();
  const pulses = Array.from({ length: scaled(46) }, () => ({ trace: pick(traces), at: rand(0, 12), speed: rand(3, 7), color: pick([CYAN, VIOLET]) }));
  const glyphs = Array.from({ length: scaled(30) }, () => ({
    x: rand(-0.9, 0.9),
    y: rand(DIE_TOP + 0.2, 3),
    z: rand(-0.9, 0.9),
    rise: rand(0.25, 0.6),
    char: pick([...SOURCE]),
    color: pick([CYAN, VIOLET]),
  }));
  // Signals racing along the metal of the standard cells in the deep zoom.
  const signals = Array.from({ length: 48 }, () => ({ row: Math.floor(rand(-30, 30)), at: rand(-1, 1), speed: rand(0.15, 0.4) * (Math.random() < 0.5 ? 1 : -1), upright: Math.random() < 0.35 }));
  const streaks = Array.from({ length: 36 }, () => ({ angle: rand(0, TAU), at: Math.random(), color: pick([CYAN, VIOLET]) }));
  // Small parts: capacitors and resistors around the package, memory chips and LEDs further out.
  const caps = Array.from({ length: 18 }, () => {
    const angle = rand(0, TAU);
    const distance = rand(2.7, 6.5);
    return { at: [Math.cos(angle) * distance, 0, Math.sin(angle) * distance] as Vec3, turn: Math.random() < 0.5, ceramic: Math.random() < 0.7 };
  });
  const memory = [
    { at: [-6.2, 0, -1.8] as Vec3, half: [1.4, 0.07, 0.62] as Vec3 },
    { at: [-6.2, 0, 1.4] as Vec3, half: [1.4, 0.07, 0.62] as Vec3 },
    { at: [1.2, 0, -6.4] as Vec3, half: [0.62, 0.07, 1.4] as Vec3 },
  ];
  const leds = [
    { at: [4.2, 0, -2.6] as Vec3, color: CYAN, phase: 0 },
    { at: [4.2, 0, -2.2] as Vec3, color: VIOLET, phase: 1.3 },
    { at: [-3.4, 0, 4.4] as Vec3, color: CYAN, phase: 2.1 },
  ];
  const backdrop = Array.from({ length: 7 }, () => ({ x: rand(0.02, 0.98), y: rand(0.02, 0.32), size: rand(50, 150), alpha: rand(0.04, 0.1), color: pick([CYAN, VIOLET]) }));
  const look: Look = { tint: "176,150,255", light: [0.36, 0.3], bloom: 0.55, haze: 0.04, dust: motes(60), vignette: 0.66 };
  let sparks: Spark[] = [];
  let ignited = false;
  let shot: { eye: Vec3; target: Vec3 } | null = null;

  return (ctx, frame) => {
    const { phase, p, dt, w, h, time } = frame;
    const cover = phase === "cover" ? easeInOut(p) : 1;
    const crane = phase === "reveal" ? easeInOut(clamp01(p / 0.5)) : 0;
    const dive = phase === "reveal" ? easeIn(clamp01((p - 0.2) / 0.8)) : 0;
    const tall = clamp01((1.25 - w / h) / 0.75);
    // Power comes on part way into the cover and spreads out along the traces.
    const power = phase === "cover" ? clamp01((p - 0.25) / 0.75) : 1;
    const wave = lerp(PACKAGE, 16, easeOut(power));

    let eye: Vec3;
    let target: Vec3;
    let upHint: Vec3 = [0, 1, 0];
    const dieCenter: Vec3 = [0, DIE_TOP, 0];
    if (phase === "reveal") {
      const start = shot ?? { eye: SHOT.eye, target: SHOT.target };
      const path = mix3(mix3(start.eye, CRANE_BEND, crane), mix3(CRANE_BEND, ABOVE, crane), crane);
      eye = add3(dieCenter, mul3(add3(path, mul3(dieCenter, -1)), (LAST_HEIGHT / (ABOVE[1] - DIE_TOP)) ** dive));
      target = mix3(start.target, dieCenter, crane);
      upHint = unit3(mix3([0, 1, 0], [0, 0, -1], crane));
    } else {
      const push = phase === "cover" ? easeOut(p) : 1;
      const drift: Vec3 = [Math.sin(time * 0.3) * 0.1, Math.sin(time * 0.45) * 0.035, Math.cos(time * 0.27) * 0.08];
      eye = add3(add3(mix3(SHOT.eye, SHOT_TALL.eye, tall), mul3(PULL_BACK, 1 - push)), drift);
      target = mix3(SHOT.target, SHOT_TALL.target, tall);
      shot = { eye, target };
    }
    const cam = aim(eye, target, upHint, lerp(SHOT.fov, SHOT_TALL.fov, tall), w, h, 0.005);
    const zoom = sizeAt(cam, dieCenter, DIE * 2) / h; // the die's size in screen heights

    const s = stage(ctx, w);
    if (!s) return;
    // A dark studio: the board fades into black, with far lights out of focus.
    s.fillStyle = "#030409";
    s.fillRect(0, 0, w, h);
    s.globalCompositeOperation = "lighter";
    for (const light of backdrop) defocused(s, light.color, light.x * w, light.y * h, light.size, light.alpha * power * (1 - crane));

    // The board, with the key light glancing off the solder mask beyond the chip.
    const extent = 18;
    s.globalCompositeOperation = "source-over";
    if (polygonPath(s, cam, [[-extent, 0, -extent], [extent, 0, -extent], [extent, 0, extent], [-extent, 0, extent]])) {
      s.fillStyle = "#05070e";
      s.fill();
      const reach = eye[1] / KEY.dir[1]; // where the light's mirror image falls on the board
      const glare = project(cam, [eye[0] - reach * KEY.dir[0], 0, eye[2] - reach * KEY.dir[2]]) ?? project(cam, [0, 0, -4]);
      if (glare) {
        s.save();
        s.clip();
        s.translate(glare[0], glare[1]);
        s.scale(1, lerp(0.4, 1, crane));
        const sheen = s.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) * 0.7);
        sheen.addColorStop(0, "rgba(140,120,255,0.12)");
        sheen.addColorStop(0.4, "rgba(60,50,150,0.05)");
        sheen.addColorStop(1, "rgba(30,24,80,0)");
        s.globalCompositeOperation = "lighter";
        s.fillStyle = sheen;
        s.fillRect(-w * 2, -h * 4, w * 4, h * 8);
        s.restore();
      }
    }

    // Copper traces, brightest near the chip; once powered a faint light runs inside them.
    const middle = project(cam, [0, 0, 0]) ?? [w / 2, h / 2];
    const copper = s.createRadialGradient(middle[0], middle[1], 0, middle[0], middle[1], Math.max(w, h) * 0.9);
    copper.addColorStop(0, "rgb(156,112,66)");
    copper.addColorStop(1, "rgb(52,38,26)");
    s.globalCompositeOperation = "source-over";
    s.globalAlpha = 1;
    s.fillStyle = copper;
    s.beginPath();
    for (const trace of traces) for (let leg = 0; leg < 3; leg++) strip(s, cam, trace.points[leg], trace.points[leg + 1], 0.03);
    s.fill();
    s.globalCompositeOperation = "lighter";
    poweredStrips(s, cam, traces, wave, 0.011);
    s.globalAlpha = 0.28;
    s.fillStyle = `rgb(${CYAN})`;
    s.fill();
    // Vias where the traces dive to the inner layers: gold rings, drawn as one even-odd fill.
    s.globalCompositeOperation = "source-over";
    s.globalAlpha = 1;
    s.beginPath();
    for (const trace of traces) {
      const end = trace.points[3];
      for (const radius of [0.09, 0.04]) {
        const ring = RING.flatMap(([c, n]) => {
          const point = project(cam, [end[0] + c * radius, 0.003, end[2] + n * radius]);
          return point ? [point] : [];
        });
        if (ring.length < RING.length) continue;
        ring.forEach(([x, y], index) => (index ? s.lineTo(x, y) : s.moveTo(x, y)));
        s.closePath();
      }
    }
    s.fillStyle = "#9c7a48";
    s.fill("evenodd");

    // Parts, far to near so nearer ones cover farther ones.
    const parts: { depth: number; draw: () => void }[] = [];
    for (const cap of caps) {
      parts.push({
        depth: toView(cam, cap.at)[2],
        draw: () => {
          const axes: [Vec3, Vec3, Vec3] = cap.turn ? [[0, 0, 1], [0, 1, 0], [1, 0, 0]] : AXES;
          box(s, cam, add3(cap.at, [0, 0.05, 0]), axes, [0.07, 0.05, 0.06], cap.ceramic ? CERAMIC : EPOXY, KEY, false);
          for (const end of [-1, 1]) box(s, cam, add3(cap.at, add3([0, 0.05, 0], mul3(axes[0], end * 0.095))), axes, [0.028, 0.052, 0.062], TIN, KEY, false);
        },
      });
    }
    for (const chip of memory) {
      parts.push({
        depth: toView(cam, chip.at)[2],
        draw: () => {
          // Gull-wing pins along both long sides, then the epoxy body.
          const long = chip.half[0] > chip.half[2];
          for (let pin = 0; pin < 12; pin++) {
            for (const side of [-1, 1]) {
              const run = (long ? chip.half[0] : chip.half[2]) * 2 - 0.24;
              const offset: Vec3 = long ? [-chip.half[0] + 0.12 + (pin * run) / 11, 0.02, side * (chip.half[2] + 0.06)] : [side * (chip.half[0] + 0.06), 0.02, -chip.half[2] + 0.12 + (pin * run) / 11];
              box(s, cam, add3(chip.at, offset), AXES, long ? [0.025, 0.02, 0.07] : [0.07, 0.02, 0.025], TIN, KEY, false);
            }
          }
          box(s, cam, add3(chip.at, [0, chip.half[1] + 0.02, 0]), AXES, chip.half, EPOXY, KEY);
        },
      });
    }
    // The processor: substrate, gold contacts, the capacitors around the die, the die.
    parts.push({
      depth: toView(cam, [0, 0, 0])[2],
      draw: () => {
        box(s, cam, [0, SUBSTRATE / 2, 0], AXES, [PACKAGE, SUBSTRATE / 2, PACKAGE], SUBSTRATE_FINISH, KEY);
        s.save();
        if (patchTransform(s, cam, [-PACKAGE, SUBSTRATE + 0.001, -PACKAGE], [PACKAGE * 2, 0, 0], [0, 0, PACKAGE * 2])) {
          // Drawn at a thousand units to the side: fonts misbehave below a pixel.
          s.scale(0.001, 0.001);
          s.fillStyle = "#c9a35c";
          for (let k = 0; k < 22; k++) {
            const at = 80 + k * 38;
            for (const [x, y, wide, tall] of [[at, 20, 22, 50], [at, 930, 22, 50], [20, at, 50, 22], [930, at, 50, 22]]) s.fillRect(x, y, wide, tall);
          }
          s.fillStyle = "rgba(255,240,210,0.55)";
          s.font = `600 34px ${MONO}`;
          s.fillText("AH-2026 · PROJECTS · BUILD 06", 100, 885);
        }
        s.restore();
        for (let k = 0; k < 8; k++) {
          for (const side of [-1, 1]) {
            box(s, cam, [-1.15 + k * 0.33, SUBSTRATE + 0.03, side * 1.25], AXES, [0.06, 0.03, 0.035], CERAMIC, KEY, false);
            box(s, cam, [side * 1.25, SUBSTRATE + 0.03, -1.15 + k * 0.33], AXES, [0.035, 0.03, 0.06], CERAMIC, KEY, false);
          }
        }
        box(s, cam, [0, (SUBSTRATE + DIE_TOP) / 2, 0], AXES, [DIE, (DIE_TOP - SUBSTRATE) / 2, DIE], EPOXY, KEY);
        // The die face: circuitry under glass, lit from within once powered, with a
        // thin-film rainbow that shifts as the camera moves.
        s.save();
        if (patchTransform(s, cam, [-DIE, DIE_TOP + 0.0005, -DIE], [DIE * 2, 0, 0], [0, 0, DIE * 2])) {
          s.globalAlpha = 1;
          s.drawImage(art.die, 0, 0, 1, 1);
          s.beginPath();
          s.rect(0, 0, 1, 1);
          s.clip();
          s.globalCompositeOperation = "lighter";
          s.globalAlpha = 0.35 * power;
          s.drawImage(art.die, 0, 0, 1, 1);
          // The deep zoom: standard cells at two scales take over as the die fills the frame.
          for (const [tile, from, to] of [[0.09, 2.5, 4.5], [0.09 / 8, 20, 35]] as const) {
            const alpha = clamp01((zoom - from) / (to - from));
            if (alpha <= 0) continue;
            s.save();
            s.globalCompositeOperation = "source-over";
            s.globalAlpha = alpha;
            s.scale(tile / 256, tile / 256);
            const pattern = s.createPattern(art.cells, "repeat");
            if (pattern) {
              s.fillStyle = pattern;
              s.fillRect(0, 0, 256 / tile, 256 / tile);
            }
            s.restore();
            // Signals racing along the metal, one row of cells apart, around the centre.
            const row = tile / 16;
            s.globalCompositeOperation = "lighter";
            for (const signal of signals) {
              const run = ((((signal.at + time * signal.speed) % 2) + 3) % 2) - 1;
              const [along, across] = [0.5 + run * row * 40, 0.5 + signal.row * row];
              s.globalAlpha = alpha * 0.9;
              s.fillStyle = `rgb(${signal.upright ? VIOLET : CYAN})`;
              if (signal.upright) s.fillRect(across, along, row * 0.12, row * 4);
              else s.fillRect(along, across, row * 4, row * 0.12);
            }
          }
          const film = s.createLinearGradient(0, 0, 1, 1);
          const shift = (cam.forward[0] + cam.forward[2]) * 0.5 + time * 0.04;
          film.addColorStop(0, `hsla(${260 + shift * 200},90%,60%,0.28)`);
          film.addColorStop(0.5, `hsla(${190 + shift * 200},90%,55%,0.18)`);
          film.addColorStop(1, `hsla(${40 + shift * 200},90%,60%,0.22)`);
          s.globalCompositeOperation = "lighter";
          s.globalAlpha = power * (1 - clamp01((zoom - 2) / 3));
          s.fillStyle = film;
          s.fillRect(0, 0, 1, 1);
        }
        s.restore();
      },
    });
    for (const led of leds) {
      parts.push({
        depth: toView(cam, led.at)[2],
        draw: () => {
          box(s, cam, add3(led.at, [0, 0.04, 0]), AXES, [0.08, 0.04, 0.05], EPOXY, KEY, false);
          const point = project(cam, add3(led.at, [0, 0.09, 0]));
          const on = Math.hypot(led.at[0], led.at[2]) < wave ? 0.55 + 0.45 * Math.sin(time * 5 + led.phase) : 0;
          if (point && on > 0) {
            s.globalCompositeOperation = "lighter";
            dot(s, led.color, point[0], point[1], sizeAt(cam, led.at, 1.2), on);
            dot(s, "255,255,255", point[0], point[1], sizeAt(cam, led.at, 0.25), on);
            s.globalCompositeOperation = "source-over";
            s.globalAlpha = 1;
          }
        },
      });
    }
    parts.sort((a, b) => b.depth - a.depth);
    s.globalCompositeOperation = "source-over";
    s.globalAlpha = 1;
    for (const part of parts) part.draw();

    // Data pulses race outwards along the powered traces.
    s.globalCompositeOperation = "lighter";
    for (const pulse of pulses) {
      pulse.at += pulse.speed * dt * (1 + crane * 2);
      if (pulse.at > pulse.trace.length) {
        pulse.at = 0;
        pulse.trace = pick(traces);
      }
      if (PACKAGE + pulse.at > wave) continue;
      for (let tail = 0; tail < 5; tail++) {
        const point = pointAlong(pulse.trace, Math.max(0, pulse.at - tail * 0.1));
        const onScreen = project(cam, point);
        if (onScreen) dot(s, pulse.color, onScreen[0], onScreen[1], sizeAt(cam, point, tail ? 0.16 : 0.3), (1 - tail / 5) * 0.9);
      }
    }
    // Ignition: the die lights up the moment power arrives.
    const dieOnScreen = project(cam, dieCenter);
    if (power > 0 && !ignited) {
      ignited = true;
      if (dieOnScreen) sparks = burst(70, dieOnScreen[0], dieOnScreen[1], 60, 420, [CYAN, VIOLET, "255,255,255"], 1.1);
    }
    if (dieOnScreen && power > 0) {
      const flare = phase === "cover" ? Math.max(0, 1 - (p - 0.25) / 0.25) : 0;
      dot(s, VIOLET, dieOnScreen[0], dieOnScreen[1], sizeAt(cam, dieCenter, 5), 0.3 * power * (1 - crane));
      if (flare > 0) glint(s, dieOnScreen[0], dieOnScreen[1], sizeAt(cam, dieCenter, 4), "220,240,255", flare);
    }
    // Code drifts up off the die like heat, and streams past as the camera dives through it.
    for (const glyph of glyphs) {
      glyph.y += glyph.rise * dt;
      if (glyph.y > 3.2) {
        glyph.y = DIE_TOP + 0.15;
        glyph.char = pick([...SOURCE]);
      }
      const point: Vec3 = [glyph.x, glyph.y, glyph.z];
      const onScreen = project(cam, point);
      const size = sizeAt(cam, point, 0.12);
      if (!onScreen || size < 2) continue;
      // Fade in off the die, out near the top, and away when they loom right at the lens.
      s.globalAlpha = 0.75 * power * clamp01((3.2 - glyph.y) / 1.2) * clamp01((glyph.y - DIE_TOP) / 0.3) * clamp01((160 - size) / 80);
      const box = size * 1.6;
      s.drawImage(glyphSprite(glyph.char, glyph.color), onScreen[0] - box / 2, onScreen[1] - box / 2, box, box);
    }

    // Depth of field around the chip, opening up as the camera rises over it.
    const focusAt = dieOnScreen ?? [w / 2, h / 2];
    const focus: Focus | null = crane < 0.95 ? { x: focusAt[0], y: focusAt[1], rx: w * 0.3 * lerp(1, 5, crane), ry: h * 0.24 * lerp(1, 5, crane) } : null;
    develop(ctx, w, h, focus, cover);
    drawSparks(ctx, sparks, dt, 0.92, 120);
    // Speed lines from the core while diving in.
    if (dive > 0.05) {
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      const reach = Math.hypot(w, h) / 2;
      for (const line of streaks) {
        line.at = (line.at + dt * (0.8 + dive * 3)) % 1;
        const [from, to] = [line.at * reach, (line.at + 0.08 + dive * 0.2) * reach];
        ctx.globalAlpha = dive * 0.5 * (1 - line.at);
        ctx.strokeStyle = `rgb(${line.color})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(w / 2 + Math.cos(line.angle) * from, h / 2 + Math.sin(line.angle) * from);
        ctx.lineTo(w / 2 + Math.cos(line.angle) * to, h / 2 + Math.sin(line.angle) * to);
        ctx.stroke();
      }
    }
    look.light = [focusAt[0] / w, focusAt[1] / h];
    look.blast = dive > 0 ? { x: w / 2, y: h / 2, force: 900 * dive } : undefined;
    cinema(ctx, frame, look, cover);

    // The core opens: a square window onto the page, rimmed with light.
    if (phase === "reveal" && p > 0.78) {
      const open = easeIn(clamp01((p - 0.78) / 0.22)) * 0.03 + 0.0004;
      const corners: Vec3[] = [[-open, DIE_TOP, -open], [open, DIE_TOP, -open], [open, DIE_TOP, open], [-open, DIE_TOP, open]];
      if (polygonPath(ctx, cam, corners)) {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#000000";
        ctx.fill();
        ctx.restore();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgb(${CYAN})`;
        for (const [width, alpha] of [[14, 0.1], [4, 0.35], [1.4, 1]] as const) {
          ctx.globalAlpha = alpha * (1 - easeIn(clamp01((p - 0.9) / 0.1)));
          ctx.lineWidth = width;
          ctx.stroke();
        }
      }
    }
    terminal(ctx, frame, "code", "198,154,255");
  };
}
