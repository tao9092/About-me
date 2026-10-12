// ── Home: a macro shot of a record playing under a warm key light. The needle
// drops, grooves and dust catch the light as it spins, then the camera cranes
// up over the label and dives through the spindle hole into the page ───────
// Unlike the other shutters this one is a small 3D scene: the record lies in
// the y = 0 plane, one unit is one record radius (15 cm).
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
  hole,
  type Look,
  lerp,
  makeCanvas,
  MONO,
  motes,
  rand,
  ring,
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
  cross3,
  develop,
  dot3,
  type Finish,
  type Focus,
  type Light,
  mix3,
  mul3,
  polygonPath,
  project,
  sharpness,
  stage,
  sub3,
  toView,
  tube,
  turn3,
  unit3,
  type Vec3,
  wire,
} from "@/components/route-fx-3d";

const SEGMENTS = 144;
const RING_COS = Array.from({ length: SEGMENTS + 1 }, (_, k) => Math.cos((k / SEGMENTS) * TAU));
const RING_SIN = Array.from({ length: SEGMENTS + 1 }, (_, k) => Math.sin((k / SEGMENTS) * TAU));
/** Adds a circle on the record to the path, broken where it passes behind the camera. */
function traceCircle(ctx: CanvasRenderingContext2D, cam: Camera, ox: number, oz: number, radius: number) {
  const { eye, right, up, forward, focal, cx, cy } = cam;
  const dy = -eye[1];
  let pen = false;
  for (let k = 0; k <= SEGMENTS; k++) {
    const dx = ox + radius * RING_COS[k] - eye[0];
    const dz = oz + radius * RING_SIN[k] - eye[2];
    const depth = dx * forward[0] + dy * forward[1] + dz * forward[2];
    if (depth < cam.near) {
      pen = false;
      continue;
    }
    const x = cx + (focal * (dx * right[0] + dy * right[1] + dz * right[2])) / depth;
    const y = cy - (focal * (dx * up[0] + dy * up[1] + dz * up[2])) / depth;
    if (pen) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
    pen = true;
  }
}
/** Adds an arc on the record around (ox, oz) to the path. */
function traceArc(ctx: CanvasRenderingContext2D, cam: Camera, ox: number, oz: number, radius: number, start: number, end: number, steps: number) {
  let pen = false;
  for (let k = 0; k <= steps; k++) {
    const angle = lerp(start, end, k / steps);
    const point = project(cam, [ox + radius * Math.cos(angle), 0, oz + radius * Math.sin(angle)]);
    if (!point) {
      pen = false;
      continue;
    }
    if (pen) ctx.lineTo(point[0], point[1]);
    else ctx.moveTo(point[0], point[1]);
    pen = true;
  }
}
/** Outlines the whole record, clipped to what is in front of the camera. */
function recordPath(ctx: CanvasRenderingContext2D, cam: Camera) {
  const rim: Vec3[] = [];
  for (let k = 0; k < SEGMENTS; k += 2) rim.push([RING_COS[k], 0, RING_SIN[k]]);
  return polygonPath(ctx, cam, rim);
}

// The record: label, spindle hole, the grooved band and the quiet gaps between tracks.
const LABEL = 0.34;
const SPINDLE = 0.024;
const ECCENTRIC = 0.0025; // no pressing is perfectly centred, so the grooves sway
const TRACK_GAPS = [0.5, 0.6, 0.71, 0.83, 0.92];
// Loud passages are cut wider and catch more light; grooves are grouped by how loud.
const GROOVES = (() => {
  const levels = [0.5, 0.68, 0.84, 1].map((level) => ({ level, radii: [] as number[] }));
  for (let radius = 0.4; radius <= 0.975; radius += 0.0046) {
    if (TRACK_GAPS.some((gap) => Math.abs(radius - gap) < 0.007)) continue;
    const loudness = Math.abs(Math.sin(radius * 37) * Math.sin(radius * 11.3 + 1));
    levels[Math.min(3, Math.floor(loudness * 4))].radii.push(radius);
  }
  return levels;
})();

// The record label, drawn once: gold type around the rim, the hub's mark and
// the title, plus a blurred copy for when it sits out of focus.
const LABEL_SIZE = 512;
let labelSprites: { sharp: HTMLCanvasElement; soft: HTMLCanvasElement } | null = null;
function recordLabel() {
  if (labelSprites) return labelSprites;
  const c = LABEL_SIZE / 2;
  const sharp = makeCanvas();
  sharp.width = sharp.height = LABEL_SIZE;
  const g = sharp.getContext("2d");
  if (g) {
    const paper = g.createRadialGradient(c * 0.8, c * 0.7, 0, c, c, c);
    paper.addColorStop(0, "#3c2619");
    paper.addColorStop(1, "#150d09");
    g.fillStyle = paper;
    g.beginPath();
    g.arc(c, c, c, 0, TAU);
    g.fill();
    g.strokeStyle = "#c8934f";
    for (const [radius, width] of [[0.965, 3], [0.9, 1], [0.3, 1.5]]) {
      g.lineWidth = width;
      g.beginPath();
      g.arc(c, c, c * radius, 0, TAU);
      g.stroke();
    }
    g.fillStyle = "#e0ad66";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `600 21px ${MONO}`;
    const rim = [..."ACHIEVEMENT HUB · SIDE A · 33⅓ RPM · STEREO · "];
    rim.forEach((letter, index) => {
      g.save();
      g.translate(c, c);
      g.rotate((index / rim.length) * TAU);
      g.fillText(letter, 0, -c * 0.79);
      g.restore();
    });
    // The five-dot mark from the nav, above the hole; the title below it.
    for (const [x, y] of [[4.5, 26.5], [10.5, 17.5], [16.5, 8.5], [17.5, 26.5], [24.5, 18.5]]) {
      g.beginPath();
      g.arc(c + (x - 14.5) * 3.2, c - 112 + (y - 17.5) * 3.2, 8, 0, TAU);
      g.fill();
    }
    g.font = `700 54px ${MONO}`;
    g.fillText("HOME", c, c + 104);
    g.font = `500 18px ${MONO}`;
    g.fillText("℗ 2026  ·  TRACK 01", c, c + 152);
    g.fillStyle = "#000000";
    g.beginPath();
    g.arc(c, c, (SPINDLE / LABEL) * c, 0, TAU);
    g.fill();
  }
  const tiny = makeCanvas();
  tiny.width = tiny.height = LABEL_SIZE / 8;
  tiny.getContext("2d")?.drawImage(sharp, 0, 0, tiny.width, tiny.height);
  const soft = makeCanvas();
  soft.width = soft.height = LABEL_SIZE;
  const s = soft.getContext("2d");
  if (s) {
    s.imageSmoothingQuality = "high";
    s.drawImage(tiny, 0, 0, LABEL_SIZE, LABEL_SIZE);
  }
  labelSprites = { sharp, soft };
  return labelSprites;
}

// The tonearm: gunmetal tube and headshell, brass cartridge, copper leads, lit
// by a warm key light behind the arm and to the right.
const GUNMETAL: Finish = { color: [52, 46, 43], shine: 30 };
const BRASS: Finish = { color: [206, 152, 80], shine: 16 };
const KEY: Light = { dir: unit3([0.55, 0.62, -0.56]), color: [255, 214, 160], highlight: "rgb(236,218,194)" };

// Where the needle rides, where the arm pivots, and how the headshell is angled off the arm.
const NEEDLE = { radius: 0.78, angle: -0.3 };
const PIVOT: Vec3 = [0.2, 0.32, 0.5];
const HEAD_OFFSET = 0.32;
// The macro shot skims the record just behind the needle; on tall screens it
// frames the needle itself. The cover pushes in from further out.
const SHOT = { eye: [1.05, 0.2, 0.45] as Vec3, target: [0.6, 0.04, -0.25] as Vec3, fov: 0.73 };
const SHOT_TALL = { eye: [0.98, 0.11, 0.38] as Vec3, target: [0.72, -0.05, -0.22] as Vec3, fov: 1.0 };
const PULL_BACK: Vec3 = [0.24, 0.06, 0.24];
const ABOVE: Vec3 = [0, 2.3, 0]; // straight over the label, where the dive begins
const CRANE_BEND: Vec3 = [0.95, 1.5, 0.75];
const LAST_HEIGHT = 0.018; // close enough that the spindle hole fills the screen

export function vinyl(): Fx {
  const glitter = Array.from({ length: scaled(340) }, () => ({ radius: rand(0.4, 0.975), angle: rand(0, TAU), size: rand(0.6, 1.5), phase: rand(0, TAU) }));
  const backdrop = Array.from({ length: 6 }, () => ({ x: rand(0.05, 0.95), y: rand(0.02, 0.3), size: rand(60, 170), alpha: rand(0.04, 0.1) }));
  const look: Look = { tint: "255,168,98", light: [0.66, 0.36], bloom: 0.6, haze: 0.12, dust: motes(120), vignette: 0.62 };
  const label = recordLabel();
  let spin = rand(0, TAU);
  let dropAt = -1; // when the needle touched down
  let sparks: Spark[] = [];
  let shot: { eye: Vec3; target: Vec3 } | null = null; // where the camera was when the reveal began

  return (ctx, frame) => {
    const { phase, p, dt, w, h, time } = frame;
    const cover = phase === "cover" ? easeInOut(p) : 1;
    const crane = phase === "reveal" ? easeInOut(clamp01(p / 0.55)) : 0;
    const dive = phase === "reveal" ? easeIn(clamp01((p - 0.3) / 0.7)) : 0;
    const tall = clamp01((1.25 - w / h) / 0.75);
    const fov = lerp(SHOT.fov, SHOT_TALL.fov, tall);

    // Camera: push in during the cover, drift while playing, then crane and dive.
    let eye: Vec3;
    let target: Vec3;
    let upHint: Vec3 = [0, 1, 0];
    if (phase === "reveal") {
      const start = shot ?? { eye: SHOT.eye, target: SHOT.target };
      const along = mix3(mix3(start.eye, CRANE_BEND, crane), mix3(CRANE_BEND, ABOVE, crane), crane);
      eye = mul3(along, (LAST_HEIGHT / ABOVE[1]) ** dive);
      target = mix3(start.target, [0, 0, 0], crane);
      upHint = unit3(mix3([0, 1, 0], [0, 0, -1], crane));
    } else {
      const push = phase === "cover" ? easeOut(p) : 1;
      const drift: Vec3 = [Math.sin(time * 0.35) * 0.012, Math.sin(time * 0.5) * 0.004, Math.cos(time * 0.3) * 0.01];
      eye = add3(add3(mix3(SHOT.eye, SHOT_TALL.eye, tall), mul3(PULL_BACK, 1 - push)), drift);
      target = mix3(SHOT.target, SHOT_TALL.target, tall);
      shot = { eye, target };
    }
    const cam = aim(eye, target, upHint, fov, w, h);

    spin += dt * (2.6 + 9 * crane); // spins up as the camera dives
    const ox = ECCENTRIC * Math.cos(spin);
    const oz = ECCENTRIC * Math.sin(spin);

    // The arm hovers, drops the needle at the end of the cover, and lifts away for the dive.
    const lift = phase === "cover" ? 0.05 * (1 - easeInOut(clamp01((p - 0.2) / 0.62))) : phase === "reveal" ? 0.12 * easeOut(clamp01(p / 0.3)) : 0;
    const swing = phase === "reveal" ? -0.75 * easeInOut(clamp01(p / 0.4)) : 0;
    const wobble = NEEDLE.radius + ECCENTRIC * Math.cos(spin - NEEDLE.angle); // the needle follows the swaying groove
    const rest: Vec3 = [wobble * Math.cos(NEEDLE.angle), 0, wobble * Math.sin(NEEDLE.angle)];
    const tip = add3(add3(PIVOT, turn3(sub3(rest, PIVOT), swing)), [0, lift, 0]);
    const tipOnScreen = project(cam, tip);
    if (phase !== "reveal" && lift === 0 && dropAt < 0) {
      dropAt = time;
      if (tipOnScreen) sparks = burst(46, tipOnScreen[0], tipOnScreen[1], 30, 220, ["255,214,160", "255,240,210", "255,170,100"], 0.9);
    }
    // A beat from the record once it is playing.
    const beat = dropAt >= 0 ? Math.max(0, Math.sin((time - dropAt) * TAU * 1.55)) ** 10 : 0;

    // ── The scene is drawn sharp offscreen, then defocused around the needle.
    const dpr = ctx.canvas.width / w;
    const s = stage(ctx, w);
    if (!s) return;
    const room = s.createLinearGradient(0, 0, 0, h);
    room.addColorStop(0, "#0e0806");
    room.addColorStop(0.55, "#070403");
    room.addColorStop(1, "#030101");
    s.fillStyle = room;
    s.fillRect(0, 0, w, h);
    s.globalCompositeOperation = "lighter";
    const key = s.createRadialGradient(w * 0.88, h * 0.04, 0, w * 0.88, h * 0.04, Math.max(w, h) * 0.75);
    key.addColorStop(0, "rgba(255,150,76,0.24)");
    key.addColorStop(0.4, "rgba(150,62,26,0.12)");
    key.addColorStop(1, "rgba(80,30,12,0)");
    s.fillStyle = key;
    s.fillRect(0, 0, w, h);
    for (const light of backdrop) defocused(s, "255,170,110", light.x * w, light.y * h, light.size, light.alpha * (1 - crane));

    // The record: dark red vinyl with a warm sheen where the key light glances off it.
    if (recordPath(s, cam)) {
      s.globalCompositeOperation = "source-over";
      s.fillStyle = "#1c0705";
      s.fill();
      s.save();
      s.clip();
      const glance = tipOnScreen ?? [w * 0.6, h * 0.5];
      s.translate(glance[0] + w * 0.04, glance[1] + h * 0.03);
      s.scale(1, lerp(0.38, 1, crane));
      const sheen = s.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) * 0.5);
      sheen.addColorStop(0, "rgba(255,120,64,0.42)");
      sheen.addColorStop(0.45, "rgba(170,44,22,0.16)");
      sheen.addColorStop(1, "rgba(90,16,8,0)");
      s.globalCompositeOperation = "lighter";
      s.fillStyle = sheen;
      s.fillRect(-w * 2, -h * 4, w * 4, h * 8);
      s.restore();
    }

    // Grooves. On concentric grooves the light gathers along a spoke through the
    // centre, aligned with the halfway vector between the key light and the eye.
    // The macro shot cheats it to run just in front of the needle.
    const center = project(cam, [ox, 0, oz]);
    const halfway = unit3(add3(KEY.dir, unit3(sub3(cam.eye, tip))));
    const cheat = NEEDLE.angle + 0.14;
    const physical = Math.atan2(halfway[2], halfway[0]);
    const spoke = cheat + Math.atan2(Math.sin(physical - cheat), Math.cos(physical - cheat)) * crane;
    // The patch of the frame in focus: an ellipse around the needle and headshell,
    // opening up to the whole record as the camera rises over it.
    const focus: Focus | null =
      crane < 0.98
        ? { x: (tipOnScreen?.[0] ?? w / 2) - w * 0.06, y: (tipOnScreen?.[1] ?? h / 2) - h * 0.1, rx: w * 0.3 * lerp(1, 5, crane), ry: h * 0.2 * lerp(1, 5, crane) }
        : null;
    let grooveStyle: string | CanvasGradient = "rgba(170,60,34,0.6)";
    const ahead = project(cam, [ox + Math.cos(spoke) * 0.7, 0, oz + Math.sin(spoke) * 0.7]);
    if (center && ahead && typeof s.createConicGradient === "function") {
      const first = Math.atan2(ahead[1] - center[1], ahead[0] - center[0]);
      const gradient = s.createConicGradient(first, center[0], center[1]);
      const [dim, warm, hot] = ["rgba(150,52,30,0.5)", "rgba(255,140,76,0.85)", "rgba(255,228,186,1)"];
      gradient.addColorStop(0, hot);
      gradient.addColorStop(0.02, warm);
      gradient.addColorStop(0.07, dim);
      const behind = project(cam, [ox - Math.cos(spoke) * 0.7, 0, oz - Math.sin(spoke) * 0.7]);
      if (behind) {
        const second = ((((Math.atan2(behind[1] - center[1], behind[0] - center[0]) - first) % TAU) + TAU) % TAU) / TAU;
        if (second > 0.15 && second < 0.85) {
          gradient.addColorStop(second - 0.06, dim);
          gradient.addColorStop(second - 0.015, warm);
          gradient.addColorStop(second, "rgba(255,206,160,0.9)");
          gradient.addColorStop(second + 0.015, warm);
          gradient.addColorStop(second + 0.06, dim);
        }
      }
      gradient.addColorStop(0.93, dim);
      gradient.addColorStop(0.98, warm);
      gradient.addColorStop(1, hot);
      grooveStyle = gradient;
    }
    const grooveReach = center ? Math.hypot(w, h) : 0;
    // From straight above, once the grooves have left the screen, skip them.
    const grooves = !(crane > 0.98 && center && (cam.focal * 0.4) / eye[1] > grooveReach);
    s.globalCompositeOperation = "lighter";
    s.strokeStyle = grooveStyle;
    s.lineCap = "butt";
    if (grooves) {
      // One device pixel wide: hairlines stay on the GPU's fast path, while wider
      // strokes over thousands of segments drop the frame rate by half.
      s.lineWidth = 1 / dpr;
      for (const { level, radii } of GROOVES) {
        s.beginPath();
        for (const radius of radii) traceCircle(s, cam, ox, oz, radius);
        s.globalAlpha = Math.min(1, level * (0.9 + beat * 0.3));
        s.stroke();
      }
      // The smooth gaps between tracks shine differently.
      s.globalAlpha = 0.8;
      s.beginPath();
      for (const gap of TRACK_GAPS) traceCircle(s, cam, ox, oz, gap);
      s.stroke();
    }

    // Dust and glitter on the record streak by as it turns, flaring near the spoke.
    // Out of focus they would blur into blobs, so they fade away from the needle.
    s.strokeStyle = "#ffd9a6";
    s.lineCap = "round";
    const trail = Math.min(0.3, (2.6 + 9 * crane) * 0.012);
    for (const speck of glitter) {
      const angle = speck.angle + spin;
      const head = project(cam, [ox + speck.radius * Math.cos(angle), 0, oz + speck.radius * Math.sin(angle)]);
      if (!head) continue;
      const sharp = sharpness(focus, head[0], head[1]);
      const flare = Math.abs(Math.cos(angle - spoke)) ** 14;
      const alpha = (0.06 + 0.9 * flare) * (0.55 + 0.45 * Math.sin(time * 9 + speck.phase)) * (1 + beat * 0.5) * (0.05 + 0.95 * sharp);
      if (alpha < 0.04) continue;
      s.globalAlpha = Math.min(1, alpha);
      s.lineWidth = speck.size;
      s.beginPath();
      traceArc(s, cam, ox, oz, speck.radius, angle - trail, angle, 3);
      s.stroke();
    }

    // The label, mapped onto the record (an affine stand-in for the perspective).
    const origin = project(cam, [0, 0, 0]);
    const labelX = project(cam, [LABEL, 0, 0]);
    const labelZ = project(cam, [0, 0, LABEL]);
    if (origin && labelX && labelZ) {
      const half = LABEL_SIZE / 2;
      s.save();
      s.transform((labelX[0] - origin[0]) / half, (labelX[1] - origin[1]) / half, (labelZ[0] - origin[0]) / half, (labelZ[1] - origin[1]) / half, origin[0], origin[1]);
      s.rotate(spin);
      s.globalCompositeOperation = "source-over";
      s.globalAlpha = 1;
      s.drawImage(label.soft, -half, -half);
      s.globalAlpha = crane;
      s.drawImage(label.sharp, -half, -half);
      s.restore();
    }

    // Needle drop: a ring of light spreads over the record and runs along the groove.
    const sinceDrop = dropAt >= 0 ? time - dropAt : -1;
    if (sinceDrop >= 0 && sinceDrop < 1) {
      s.globalCompositeOperation = "lighter";
      s.strokeStyle = "#ffd7a4";
      for (const [delay, strength] of [[0, 1], [0.18, 0.5]] as const) {
        const t = clamp01((sinceDrop - delay) / 0.8);
        if (t <= 0 || t >= 1) continue;
        s.globalAlpha = (1 - t) * strength;
        s.lineWidth = 2;
        s.beginPath();
        traceArc(s, cam, tip[0], tip[2], 0.02 + easeOut(t) * 0.45, 0, TAU, 72);
        s.stroke();
      }
      const t = clamp01(sinceDrop / 0.9);
      s.globalAlpha = 1 - t;
      s.lineWidth = 2.6;
      s.beginPath();
      traceArc(s, cam, ox, oz, wobble, NEEDLE.angle - easeOut(t) * 1.5, NEEDLE.angle + easeOut(t) * 1.5, 60);
      s.stroke();
    }

    // The tonearm, from the stylus up: cantilever, cartridge, headshell, finger
    // lift, tag wires and tube, at real size (a cartridge is about 2.4 cm long).
    const forward = unit3(turn3([tip[0] - PIVOT[0], 0, tip[2] - PIVOT[2]], HEAD_OFFSET));
    const side = unit3(cross3([0, 1, 0], forward));
    const up: Vec3 = [0, 1, 0];
    const at = (ahead: number, above: number, across = 0) => add3(add3(add3(tip, mul3(forward, ahead)), mul3(up, above)), mul3(side, across));
    const axes: [Vec3, Vec3, Vec3] = [forward, up, side];
    const flank = dot3(side, sub3(cam.eye, tip)) > 0 ? 1 : -1; // the side facing the camera
    // A soft shadow grounds the cartridge on the record, fading as the arm lifts.
    const below = at(-0.05, 0);
    const shadowAt = project(cam, [below[0], 0, below[2]]);
    if (shadowAt) {
      const size = (cam.focal * 0.12) / toView(cam, [below[0], 0, below[2]])[2];
      s.save();
      s.translate(shadowAt[0], shadowAt[1]);
      s.scale(1, lerp(0.35, 1, crane));
      const shade = s.createRadialGradient(0, 0, 0, 0, 0, size);
      shade.addColorStop(0, "rgba(0,0,0,0.6)");
      shade.addColorStop(1, "rgba(0,0,0,0)");
      s.globalCompositeOperation = "source-over";
      s.globalAlpha = clamp01(1 - lift / 0.12);
      s.fillStyle = shade;
      s.fillRect(-size, -size, size * 2, size * 2);
      s.restore();
    }
    s.globalCompositeOperation = "source-over";
    s.globalAlpha = 1;
    wire(s, cam, [at(0.014, 0.016), at(0, 0.0006)], 0.0017, "rgb(170,150,130)", "rgba(255,236,210,0.9)");
    box(s, cam, at(-0.05, 0.047), axes, [0.08, 0.035, 0.055], BRASS, KEY);
    box(s, cam, at(-0.06, 0.097), axes, [0.07, 0.015, 0.05], GUNMETAL, KEY);
    s.fillStyle = "rgba(26,15,8,0.85)";
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 5; column++) {
        const vent = at(-0.11 + column * 0.03, 0.028 + row * 0.019, flank * 0.0555);
        const point = project(cam, vent);
        if (!point) continue;
        s.beginPath();
        s.arc(point[0], point[1], (cam.focal * 0.0045) / toView(cam, vent)[2], 0, TAU);
        s.fill();
      }
    }
    box(s, cam, at(-0.07, 0.121), axes, [0.15, 0.009, 0.065], GUNMETAL, KEY);
    for (const across of [-0.032, 0.032]) {
      const screw = at(-0.06, 0.1305, across);
      const point = project(cam, screw);
      if (!point) continue;
      const size = (cam.focal * 0.009) / toView(cam, screw)[2];
      s.fillStyle = "rgb(24,21,19)";
      s.beginPath();
      s.ellipse(point[0], point[1], size, size * 0.4, 0, 0, TAU);
      s.fill();
      s.fillStyle = "rgba(255,226,190,0.75)";
      s.beginPath();
      s.ellipse(point[0] + size * 0.25, point[1] - size * 0.12, size * 0.35, size * 0.14, 0, 0, TAU);
      s.fill();
    }
    const fingerLift: Vec3[] = [];
    for (let k = 0; k <= 8; k++) fingerLift.push(at(0.05 + (k / 8) * 0.07, 0.126 + (k / 8) ** 2 * 0.05, flank * (0.06 + (k / 8) * 0.08)));
    wire(s, cam, fingerLift, 0.006, "rgb(58,50,46)", "rgba(255,226,190,0.7)");
    ["rgb(196,98,52)", "rgb(168,82,44)", "rgb(212,134,82)", "rgb(178,112,70)"].forEach((color, k) => {
      const across = (k - 1.5) * 0.018;
      wire(s, cam, [at(-0.13, 0.04 + (k % 2) * 0.03, across), at(-0.165, 0.07, across * 1.3), at(-0.19, 0.108, across * 0.8)], 0.0022, color, "rgba(255,214,170,0.6)");
    });
    tube(s, cam, at(-0.25, 0.121), at(-0.195, 0.121), 0.04, GUNMETAL, KEY, 2);
    tube(s, cam, at(-0.23, 0.121), PIVOT, 0.028, GUNMETAL, KEY);
    if (tipOnScreen) {
      s.globalCompositeOperation = "lighter";
      dot(s, "255,214,160", tipOnScreen[0], tipOnScreen[1], 22 + 18 * beat, 0.55 + 0.4 * beat);
      glint(s, tipOnScreen[0], tipOnScreen[1], 18 + 34 * beat, "255,232,200", 0.25 + 0.6 * beat);
    }

    // Depth of field: sharp only around the needle; from straight above the whole
    // record is in focus.
    develop(ctx, w, h, focus, cover);

    drawSparks(ctx, sparks, dt, 0.9, 260);
    look.blast = dive > 0 && origin ? { x: origin[0], y: origin[1], force: 1400 * dive } : undefined;
    cinema(ctx, frame, look, cover);

    // Through the spindle hole: it opens onto the page and grows to fill the screen.
    if (crane > 0.85 && origin) {
      const edge = project(cam, [SPINDLE, 0, 0]);
      if (edge) {
        const radius = Math.hypot(edge[0] - origin[0], edge[1] - origin[1]) * clamp01((crane - 0.85) / 0.15);
        hole(ctx, origin[0], origin[1], radius, radius * 0.16 + 2);
        ring(ctx, origin[0], origin[1], radius * 1.03, "255,204,150", 0.7 * (1 - dive * 0.6), 1.4);
      }
    }
    terminal(ctx, frame, "vinyl", "255,190,130");
  };
}
