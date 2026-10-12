// ── Experience: night on the line. A headlight grows out of the dark, the
// express rushes past the camera, which swings round and tracks along its
// windows, one year in each, until the last car pulls away and the page is
// left standing behind it ─────────────────────────────────────────────────
// A 3D scene in metres: the track runs along z, the train runs towards +z on
// the x = 0 line, and the camera stands beside the line at x > 0.
import {
  burst,
  cinema,
  clamp01,
  dot,
  drawSparks,
  easeIn,
  easeInOut,
  easeOut,
  type Fx,
  glint,
  type Look,
  lerp,
  MONO,
  motes,
  rand,
  type Spark,
  streak,
  TAU,
  terminal,
} from "@/components/route-fx-kit";
import {
  add3,
  aim,
  type Camera,
  cross3,
  develop,
  dot3,
  type Focus,
  mix3,
  patchTransform,
  polygonPath,
  project,
  sizeAt,
  stage,
  sub3,
  toView,
  unit3,
  type Vec3,
} from "@/components/route-fx-3d";

const PINK = "255,154,213";
const STOPS = ["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026", "NOW", "NEXT"];
const SIDE = 1.6; // half the width of the train
const FLOOR = 0.55; // bottom of the body
const ROOF = 3.9;
const CAR = 25; // car length
const NOSE = 9; // length of the streamlined nose
const WINDOWS = 8; // per car
const MOON = unit3([0.4, 0.6, 0.7]);

/** A streamlined end as rings of points: at each distance from the tip, a profile
 * round the near half and the top. The nose points to +z (way 1), the tail to -z (way -1). */
function endRings(tipZ: number, way: number) {
  const rings: Vec3[][] = [];
  for (let k = 0; k <= 14; k++) {
    const t = (k / 14) ** 0.85;
    const half = SIDE * (1 - (1 - t) ** 2.4);
    const top = lerp(1.7, ROOF, 1 - (1 - t) ** 1.7);
    const bottom = lerp(1.0, FLOOR, Math.min(1, t * 2.2));
    const ring: Vec3[] = [];
    for (let j = 0; j <= 14; j++) {
      // From the bottom of the near side, round the shoulder, to the roof's centre line.
      const a = (j / 14) * (Math.PI / 2);
      ring.push([half * Math.cos(a) ** 0.6, lerp(bottom, top, Math.sin(a) ** 0.7), tipZ - way * NOSE * t]);
    }
    rings.push(ring);
  }
  return rings;
}
/** The on-screen box of some points, or null if any is behind the camera. */
function bounds(cam: Camera, points: Vec3[]) {
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const point of points) {
    const at = project(cam, point);
    if (!at) return null;
    [left, top, right, bottom] = [Math.min(left, at[0]), Math.min(top, at[1]), Math.max(right, at[0]), Math.max(bottom, at[1])];
  }
  return { left, top, right, bottom };
}
/** A rectangle on the train's near side between two heights and two z values. */
function panel(ctx: CanvasRenderingContext2D, cam: Camera, bottom: number, top: number, front: number, back: number, color: string, inset = 0) {
  if (!polygonPath(ctx, cam, [[SIDE + inset, bottom, front], [SIDE + inset, top, front], [SIDE + inset, top, back], [SIDE + inset, bottom, back]])) return false;
  ctx.fillStyle = color;
  ctx.fill();
  return true;
}

/** The ground and the track: sleepers and rails running off into the dark. */
function track(ctx: CanvasRenderingContext2D, cam: Camera, fromZ: number, toZ: number, w: number, h: number, beam: number | null) {
  if (polygonPath(ctx, cam, [[-2.2, 0.02, fromZ], [2.2, 0.02, fromZ], [2.2, 0.02, toZ], [-2.2, 0.02, toZ]])) {
    ctx.fillStyle = "#0e0c14";
    ctx.fill();
  }
  ctx.fillStyle = "#1c1714";
  ctx.beginPath();
  for (let z = Math.ceil(fromZ / 0.65) * 0.65; z < toZ; z += Math.abs(z - cam.eye[2]) > 40 ? 1.3 : 0.65) {
    const corners = [[-1.3, z - 0.12], [1.3, z - 0.12], [1.3, z + 0.12], [-1.3, z + 0.12]].flatMap(([x, along]) => {
      const point = project(cam, [x, 0.12, along]);
      return point ? [point] : [];
    });
    if (corners.length < 4 || corners.every(([x, y]) => x < 0 || x > w || y < 0 || y > h)) continue;
    corners.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }
  ctx.fill();
  // Rails: steel catching the headlight as it closes in.
  for (const x of [-0.72, 0.72]) {
    const near = project(cam, [x, 0.17, toZ]);
    const far = project(cam, [x, 0.17, fromZ]);
    if (!near || !far) continue;
    const shine = ctx.createLinearGradient(near[0], near[1], far[0], far[1]);
    shine.addColorStop(0, "rgba(110,110,130,0.55)");
    if (beam !== null) {
      const at = clamp01((toZ - beam) / (toZ - fromZ));
      shine.addColorStop(Math.max(0, at - 0.3), "rgba(150,150,170,0.6)");
      shine.addColorStop(at, "rgba(255,240,250,1)");
    }
    shine.addColorStop(1, "rgba(60,60,80,0.4)");
    ctx.strokeStyle = shine;
    ctx.lineWidth = Math.max(1, sizeAt(cam, [x, 0.17, toZ], 0.07));
    ctx.beginPath();
    ctx.moveTo(near[0], near[1]);
    ctx.lineTo(far[0], far[1]);
    ctx.stroke();
  }
}

/** The train's near side from its front back to its tail, one car at a time. */
function side(ctx: CanvasRenderingContext2D, cam: Camera, w: number, h: number, front: number, tail: number, time: number, gleam: number) {
  const reach = 420; // cars further than this are lost in the dark
  for (let car = 0; car * CAR < reach; car++) {
    const carFront = front - car * CAR;
    const carBack = Math.max(tail, carFront - CAR);
    if (carFront <= tail) break;
    const box = bounds(cam, [[SIDE, 0, carFront], [SIDE, ROOF, carFront], [SIDE, 0, carBack], [SIDE, ROOF, carBack]]);
    if (box && (box.right < 0 || box.left > w || box.bottom < 0 || box.top > h)) continue;
    const width = box ? box.right - box.left : w;
    const nearest = Math.min(carFront, Math.max(carBack, cam.eye[2])); // shade from the part closest to the lens
    const [roofAt, beltAt, skirtAt] = [project(cam, [SIDE, ROOF, nearest]), project(cam, [SIDE, 1.7, nearest]), project(cam, [SIDE, 0, nearest])];
    // Silver paint, bright where it faces the sky; a dark lower body; pink and violet stripes.
    if (polygonPath(ctx, cam, [[SIDE, 1.7, carFront], [SIDE, ROOF, carFront], [SIDE, ROOF, carBack], [SIDE, 1.7, carBack]])) {
      const paint = ctx.createLinearGradient(0, roofAt?.[1] ?? 0, 0, beltAt?.[1] ?? h);
      paint.addColorStop(0, "#eceef6");
      paint.addColorStop(0.12, "#d3d6e2");
      paint.addColorStop(0.7, "#9d9fb0");
      paint.addColorStop(1, "#7f8192");
      ctx.fillStyle = paint;
      ctx.fill();
      // Lamps along the line slide across the glossy paint far faster than the train seems to move.
      if (gleam > 0) {
        ctx.save();
        ctx.clip();
        ctx.globalCompositeOperation = "lighter";
        for (let k = 0; k < 3; k++) {
          const x = (((time * 2600 + k * 820) % (w + 600)) + w + 600) % (w + 600) - 300;
          const band = ctx.createLinearGradient(x - 110, 0, x + 110, 0);
          band.addColorStop(0, "rgba(255,230,240,0)");
          band.addColorStop(0.5, `rgba(255,230,240,${0.3 * gleam})`);
          band.addColorStop(1, "rgba(255,230,240,0)");
          ctx.fillStyle = band;
          ctx.fillRect(x - 110, 0, 220, h);
        }
        ctx.restore();
        ctx.globalCompositeOperation = "source-over";
      }
    }
    // The lower body runs down past the rails, so nothing shows beneath the train.
    if (polygonPath(ctx, cam, [[SIDE, -0.8, carFront], [SIDE, 1.6, carFront], [SIDE, 1.6, carBack], [SIDE, -0.8, carBack]])) {
      const lower = ctx.createLinearGradient(0, beltAt?.[1] ?? 0, 0, skirtAt?.[1] ?? h);
      lower.addColorStop(0, "#2a2638");
      lower.addColorStop(1, "#0c0b12");
      ctx.fillStyle = lower;
      ctx.fill();
    }
    panel(ctx, cam, 1.6, 1.68, carFront, carBack, `rgb(${PINK})`);
    panel(ctx, cam, 1.68, 1.72, carFront, carBack, "#7d6bd8");
    panel(ctx, cam, 3.62, 3.7, carFront, carBack, "rgba(255,255,255,0.45)");
    if (width < 6) continue;
    // Panel seams, the doors' outlines, and the gap to the next car.
    ctx.strokeStyle = "rgba(40,38,60,0.55)";
    ctx.lineWidth = Math.max(1, sizeAt(cam, [SIDE, 2, nearest], 0.015));
    ctx.beginPath();
    for (let z = carFront - 4.2; z > carBack + 1; z -= 4.2) {
      const [a, b] = [project(cam, [SIDE, 0.65, z]), project(cam, [SIDE, 3.8, z])];
      if (!a || !b) continue;
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
    for (const door of [carFront - 1.6, carBack + 1.6]) {
      if (door > carFront || door < carBack) continue;
      if (polygonPath(ctx, cam, [[SIDE + 0.005, 0.65, door + 0.55], [SIDE + 0.005, 3.25, door + 0.55], [SIDE + 0.005, 3.25, door - 0.55], [SIDE + 0.005, 0.65, door - 0.55]])) {
        ctx.strokeStyle = "rgba(24,22,36,0.85)";
        ctx.lineWidth = Math.max(1, sizeAt(cam, [SIDE, 2, door], 0.03));
        ctx.stroke();
      }
      panel(ctx, cam, 2.05, 2.95, door + 0.22, door - 0.22, "#221e34", 0.01);
    }
    panel(ctx, cam, 0, ROOF, carBack + 0.3, carBack - 0.3, "#07060c", 0.02);
    ctx.save();
    if (width > 120 && patchTransform(ctx, cam, [SIDE + 0.02, 3.45, carFront - 0.9], [0, 0, -1.6], [0, -0.26, 0], 1.5)) {
      ctx.fillStyle = "#07060c";
      ctx.fillRect(0, 0, 1, 1);
      ctx.scale(0.001, 0.001);
      ctx.fillStyle = `rgb(${PINK})`;
      ctx.font = `700 600px ${MONO}`;
      ctx.textBaseline = "middle";
      ctx.fillText("EXPERIENCE ›", 40, 520);
    }
    ctx.restore();
    // Windows onto a lit carriage, each with a passenger display showing a year.
    for (let k = 0; k < WINDOWS; k++) {
      const z = carFront - 3.3 - k * 2.6;
      if (z - 1 < carBack) break;
      const glass = bounds(cam, [[SIDE, 1.85, z + 1], [SIDE, 3.05, z - 1]]);
      if (!glass || glass.right < 0 || glass.left > w) continue;
      if (!polygonPath(ctx, cam, [[SIDE + 0.01, 1.85, z + 1], [SIDE + 0.01, 3.05, z + 1], [SIDE + 0.01, 3.05, z - 1], [SIDE + 0.01, 1.85, z - 1]])) continue;
      const inside = ctx.createLinearGradient(0, glass.top, 0, glass.bottom);
      inside.addColorStop(0, "#ffd9b8");
      inside.addColorStop(0.18, "#7a4a6e");
      inside.addColorStop(0.6, "#2a1e3c");
      inside.addColorStop(1, "#120e1c");
      ctx.fillStyle = inside;
      ctx.fill();
      // A reflection slanting across the glass.
      ctx.save();
      ctx.clip();
      const sheen = ctx.createLinearGradient(glass.left, glass.top, glass.right, glass.bottom);
      sheen.addColorStop(0.35, "rgba(255,255,255,0)");
      sheen.addColorStop(0.45, "rgba(255,255,255,0.16)");
      sheen.addColorStop(0.55, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(glass.left, glass.top, glass.right - glass.left, glass.bottom - glass.top);
      ctx.restore();
      ctx.strokeStyle = "#1a1826";
      ctx.lineWidth = Math.max(1, sizeAt(cam, [SIDE, 2.4, z], 0.07));
      ctx.stroke();
      if (glass.right - glass.left < 36) continue;
      ctx.save();
      if (patchTransform(ctx, cam, [SIDE + 0.02, 2.75, z + 0.6], [0, 0, -1.2], [0, -0.5, 0], 1.5)) {
        ctx.fillStyle = "rgba(8,6,14,0.9)";
        ctx.fillRect(0, 0, 1, 1);
        ctx.scale(0.001, 0.001);
        ctx.fillStyle = "#ffd6ee";
        ctx.shadowColor = `rgb(${PINK})`;
        ctx.shadowBlur = 14;
        ctx.font = `700 520px ${MONO}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // Numbered so the first window to pass the camera shows the first year.
        ctx.fillText(STOPS[((((car - 1) * WINDOWS + k) % STOPS.length) + STOPS.length) % STOPS.length], 500, 540);
      }
      ctx.restore();
    }
    // Wheels under the car.
    for (const along of [3.5, 6, CAR - 6, CAR - 3.5]) {
      const center: Vec3 = [SIDE + 0.03, 0.42, carFront - along];
      if (center[2] < carBack) continue;
      const at = project(cam, center);
      const size = sizeAt(cam, center, 0.42);
      if (!at || size < 1.5) continue;
      ctx.fillStyle = "#0c0b12";
      ctx.beginPath();
      ctx.arc(at[0], at[1], size, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(200,190,220,0.45)";
      ctx.lineWidth = Math.max(1, size * 0.08);
      ctx.beginPath();
      ctx.arc(at[0], at[1], size * 0.82, -2.5, -0.5);
      ctx.stroke();
    }
  }
}

/** Draws an end's faces far to near, shaded by the moon with a sheen towards the eye.
 * Faces grazing the camera plane are skipped: they project to huge slivers. */
function drawEnd(ctx: CanvasRenderingContext2D, cam: Camera, rings: Vec3[][]) {
  const faces: { depth: number; points: Vec3[]; shade: string }[] = [];
  for (let k = 0; k < rings.length - 1; k++) {
    for (let j = 0; j < rings[k].length - 1; j++) {
      const points = [rings[k][j], rings[k][j + 1], rings[k + 1][j + 1], rings[k + 1][j]];
      if (points.some((point) => toView(cam, point)[2] < 0.6)) continue;
      const middle = mix3(points[0], points[2], 0.5);
      let normal = unit3(cross3(sub3(points[1], points[0]), sub3(points[3], points[0])));
      if (normal[0] < 0) normal = [-normal[0], -normal[1], -normal[2]]; // outward, towards the near side
      const toEye = unit3(sub3(cam.eye, middle));
      if (dot3(normal, toEye) <= 0) continue;
      const lit = 0.3 + 0.7 * Math.max(0, dot3(normal, MOON)) + 0.35 * Math.max(0, dot3(normal, toEye)) ** 8;
      const glass = middle[1] > 2.05 && k < 9; // the windscreen wraps the upper nose
      const stripe = middle[1] > 1.55 && middle[1] < 1.75;
      const color = glass ? [26 + 30 * lit, 26 + 30 * lit, 44 + 50 * lit] : stripe ? [255 * lit, 154 * lit, 213 * lit] : [214 * lit, 216 * lit, 230 * lit];
      faces.push({ depth: toView(cam, middle)[2], points, shade: `rgb(${color.map((value) => Math.round(Math.min(255, value))).join(",")})` });
    }
  }
  faces.sort((a, b) => b.depth - a.depth);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.lineWidth = 0.8;
  for (const face of faces) {
    if (!polygonPath(ctx, cam, face.points)) continue;
    ctx.fillStyle = face.shade;
    ctx.fill();
    ctx.strokeStyle = face.shade; // seal the hairline seams between faces
    ctx.stroke();
  }
}

export function rail(): Fx {
  const stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random() * 0.5, size: rand(0.6, 1.6), alpha: rand(0.2, 0.8) }));
  const masts = Array.from({ length: 12 }, (_, index) => -26 - index * 22);
  const look: Look = { tint: PINK, light: [0.4, 0.45], bloom: 0.42, haze: 0.05, dust: motes(80), vignette: 0.62 };
  let sparks: Spark[] = [];
  let lastSpark = 0;
  let travel = 0; // how far the train has moved past the camera since the cover
  let speed = 0;
  let tail: number | null = null;

  return (ctx, frame) => {
    const { phase, p, dt, w, h, time } = frame;
    const cover = phase === "cover" ? easeOut(clamp01(p / 0.45)) : 1;
    const tall = clamp01((1.25 - w / h) / 0.75);
    // The approach: the nose bursts out of the distance and passes the camera
    // just after half way, and the camera swings round to track the train.
    const arrive = p < 0.6 ? lerp(-120, 4, easeIn(p / 0.6)) : lerp(4, 34, easeOut((p - 0.6) / 0.4));
    const nose = (phase === "cover" ? arrive : 34) + travel;
    const pan = phase === "cover" ? easeInOut(clamp01((p - 0.5) / 0.45)) : 1;
    if (phase === "wait") speed = lerp(speed || 30, 3, 1 - Math.exp(-dt / 0.15));
    if (phase === "reveal") speed = lerp(3, 90, easeIn(clamp01(p / 0.6)));
    if (phase !== "cover") travel += speed * dt;
    if (phase === "reveal") tail = (tail ?? -4.2) + speed * dt; // the last car starts just off the right edge
    // A tracking camera on a rough road: a little rumble, more while the train is close.
    const rumble = (phase === "cover" ? 0.04 * Math.sin(Math.PI * pan) : 0.012) * (phase === "reveal" ? 1 - p : 1);
    const eye: Vec3 = [lerp(4.2, 5.4, pan) + rand(-rumble, rumble), lerp(1.5, 1.75, pan) + rand(-rumble, rumble), lerp(2, 0, pan)];
    const target = add3(eye, mix3([-0.42, -0.03, -1], [-1, -0.04, 0], pan));
    const cam = aim(eye, target, [0, 1, 0], lerp(lerp(0.85, 0.95, pan), 1.2, tall), w, h, 0.05);

    const s = stage(ctx, w);
    if (!s) return;
    // Night: a violet sky with the city's glow low on it, the ground and the track.
    const environment = phase === "reveal" ? 1 - clamp01(p / 0.3) : 1;
    s.globalAlpha = environment;
    const sky = s.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#05040c");
    sky.addColorStop(0.45, "#120c26");
    sky.addColorStop(0.62, "#3a1c3e");
    sky.addColorStop(1, "#08070c");
    s.fillStyle = sky;
    s.fillRect(0, 0, w, h);
    s.fillStyle = "#ffffff";
    for (const star of stars) {
      s.globalAlpha = star.alpha * environment * (1 - pan * 0.5);
      s.fillRect(star.x * w, star.y * h, star.size, star.size);
    }
    s.globalAlpha = environment;
    if (polygonPath(s, cam, [[-60, 0, -300], [60, 0, -300], [60, 0, 40], [-60, 0, 40]])) {
      s.fillStyle = "#08060c";
      s.fill();
    }
    track(s, cam, -200, 20, w, h, phase === "cover" ? nose + 30 : null);
    // Catenary masts on the far side, with the wire between them.
    s.strokeStyle = "#1d1a2a";
    for (const z of masts) {
      const foot = project(cam, [-3, 0, z]);
      const head = project(cam, [-3, 6, z]);
      const arm = project(cam, [0, 5.6, z]);
      if (!foot || !head || !arm) continue;
      s.lineWidth = Math.max(1, sizeAt(cam, [-3, 3, z], 0.16));
      s.beginPath();
      s.moveTo(foot[0], foot[1]);
      s.lineTo(head[0], head[1]);
      s.lineTo(arm[0], arm[1]);
      s.stroke();
    }
    const wire = [project(cam, [0, 5.5, 20]), project(cam, [0, 5.5, -300])];
    if (wire[0] && wire[1]) {
      s.lineWidth = 1;
      s.strokeStyle = "rgba(120,110,160,0.5)";
      s.beginPath();
      s.moveTo(wire[0][0], wire[0][1]);
      s.lineTo(wire[1][0], wire[1][1]);
      s.stroke();
    }
    s.globalAlpha = 1;
    s.globalCompositeOperation = "source-over";

    // The train: the long side behind the nose, then the nose itself.
    const tailZ = phase === "reveal" && tail !== null ? cam.eye[2] + tail : -1e4;
    side(s, cam, w, h, nose - NOSE, tailZ, time, pan);
    // The nose while it is still ahead of the camera, and the tail once it comes into view.
    if (nose - NOSE > cam.eye[2] - 2) drawEnd(s, cam, endRings(nose, 1));
    if (phase === "reveal" && tail !== null) drawEnd(s, cam, endRings(tailZ - NOSE, -1));
    // Headlights: two hot points low on the nose, a beam through the mist, a flare.
    const lamps = [project(cam, [0.5, 1.3, nose - 2]), project(cam, [-0.5, 1.3, nose - 2])];
    const close = clamp01((nose + 160) / 150);
    if (phase === "cover") {
      s.globalCompositeOperation = "lighter";
      for (const lamp of lamps) {
        if (!lamp) continue;
        const size = Math.max(10, sizeAt(cam, [0, 1.3, nose - 2], 1.2));
        dot(s, "255,250,255", lamp[0], lamp[1], size, 1);
        dot(s, PINK, lamp[0], lamp[1], size * 8, 0.35 + 0.45 * close);
      }
      const lamp = lamps[0];
      if (lamp) {
        dot(s, "255,240,250", lamp[0], lamp[1], Math.min(w, 60 + 900 * close * close), 0.5 * (1 - pan));
        streak(s, lamp[0], lamp[1], w * (0.25 + 0.55 * close), "255,226,240", 0.9 * (1 - pan));
        glint(s, lamp[0], lamp[1], Math.min(w * 0.4, 40 + sizeAt(cam, [0, 1.3, nose - 2], 3)), "255,240,250", 0.8 * close * (1 - pan));
      }
      s.globalCompositeOperation = "source-over";
    }
    // Wheel sparks spraying back along the rail.
    const sparkAt = project(cam, [SIDE - 0.05, 0.15, cam.eye[2] + rand(-2.5, 2.5)]);
    if (time - lastSpark > 0.04 && sparkAt && pan > 0.5 && (phase !== "reveal" || p < 0.5)) {
      lastSpark = time;
      const fresh = burst(5, sparkAt[0], sparkAt[1], 200, 600, ["255,190,120", PINK, "255,255,255"], 0.45);
      for (const spark of fresh) {
        spark.vx = Math.abs(spark.vx) * 1.6;
        spark.vy = -Math.abs(spark.vy) * 0.5;
      }
      sparks = [...sparks.filter((spark) => spark.age < spark.life), ...fresh];
    }

    // Shallow focus on the train's side once the camera is tracking it.
    const focus: Focus | null = pan > 0.5 ? { x: w / 2, y: h * 0.42, rx: w * 0.6, ry: h * 0.42 } : null;
    develop(ctx, w, h, focus, cover);
    drawSparks(ctx, sparks, dt, 0.9, 1400);
    // The tail pulls away: red lamps and a light wake trailing after it.
    if (phase === "reveal" && tail !== null) {
      const lamp = project(cam, [0.7, 1.3, tailZ - NOSE + 2.2]);
      if (lamp) {
        ctx.globalCompositeOperation = "lighter";
        dot(ctx, "255,60,110", lamp[0], lamp[1], 60, 1 - p);
        dot(ctx, "255,90,150", lamp[0], lamp[1], 420, 0.35 * (1 - p));
        streak(ctx, lamp[0], lamp[1], w * 0.5, "255,90,150", (1 - p) * 0.8);
      }
    }
    look.light = pan < 0.6 && lamps[0] ? [clamp01(lamps[0][0] / w), clamp01(lamps[0][1] / h)] : [0.5, 0.4];
    look.wind = phase === "cover" ? [0, 0] : [Math.min(2.4, speed / 8), 0];
    cinema(ctx, frame, look, phase === "reveal" ? 1 - easeIn(p) : cover);
    terminal(ctx, frame, "train", PINK);
  };
}
