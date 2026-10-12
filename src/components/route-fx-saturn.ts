import {
  cinema,
  clamp01,
  dot,
  easeIn,
  easeInOut,
  easeOut,
  type Fx,
  glint,
  lerp,
  makeCanvas,
  type Look,
  motes,
  rand,
  type Rgb,
  scaled,
  starfield,
  streak,
  TAU,
  terminal,
} from "@/components/route-fx-kit";

// ── Certificates: a giant Saturn rises and eclipses the sun. Its atmosphere
// glows around the limb, the backlit rings catch the light, and on the way out
// the sun breaks from behind the planet and floods the screen ──────────────
// Albedo from pole to pole: [latitude°, r, g, b].
const SATURN_ZONES: [number, number, number, number][] = [
  [-90, 104, 100, 92],
  [-66, 140, 128, 106],
  [-52, 176, 144, 96],
  [-41, 214, 188, 138],
  [-31, 186, 146, 92],
  [-21, 230, 208, 160],
  [-9, 242, 226, 186],
  [2, 246, 232, 194],
  [9, 232, 208, 156],
  [17, 192, 150, 92],
  [25, 222, 194, 142],
  [34, 180, 138, 86],
  [44, 212, 184, 132],
  [55, 172, 142, 96],
  [66, 154, 146, 122],
  [78, 120, 126, 124],
  [90, 104, 112, 116],
];
// Rings from the inside out: [inner, outer] in planet radii, colour, opacity and
// whether it glows. Lit from behind, the sparse C ring and the Cassini division
// shine while the dense B ring turns dark; the gap inside A is the Encke gap.
const SATURN_RINGS: [number, number, Rgb, number, boolean][] = [
  [1.24, 1.53, "222,176,122", 0.3, true],
  [1.53, 1.95, "112,80,54", 0.84, false],
  [1.95, 2.03, "255,206,150", 0.4, true],
  [2.03, 2.19, "156,116,78", 0.72, false],
  [2.21, 2.27, "168,126,86", 0.62, false],
  [2.32, 2.34, "255,226,184", 0.75, true],
];
const SATURN_STORMS = [
  { lat: 34, lon: 0.4, size: 0.09, color: "255,250,236", alpha: 0.55 },
  { lat: -24, lon: 2.1, size: 0.07, color: "122,92,52", alpha: 0.45 },
  { lat: 17, lon: 3.6, size: 0.05, color: "255,246,222", alpha: 0.5 },
  { lat: -41, lon: 5, size: 0.06, color: "250,240,216", alpha: 0.45 },
  { lat: 45, lon: 1.7, size: 0.05, color: "140,110,70", alpha: 0.4 },
];
const SATURN_SQUASH = 0.92; // apparent flattening of the globe
const SATURN_OPENING = 0.38; // how far the rings are opened towards us, in radians
const SATURN_TILT = -0.36;
// The sun in the planet's frame (x right, y up, z towards us): behind the planet,
// over its left shoulder. On the canvas it sits just inside the limb that way.
const SATURN_SUN: [number, number, number] = [-0.421, 0.621, -0.661];
const SUN_FRAME = [SATURN_SUN[0] / Math.hypot(SATURN_SUN[0], SATURN_SUN[1]), -SATURN_SUN[1] / Math.hypot(SATURN_SUN[0], SATURN_SUN[1])];
const SUN_SCREEN = [
  SUN_FRAME[0] * Math.cos(SATURN_TILT) - SUN_FRAME[1] * Math.sin(SATURN_TILT),
  SUN_FRAME[0] * Math.sin(SATURN_TILT) + SUN_FRAME[1] * Math.cos(SATURN_TILT),
];
const SUN_ANGLE = Math.atan2(SUN_FRAME[1], SUN_FRAME[0]);

let globeCache: { size: number; sprite: HTMLCanvasElement } | null = null;
/** Saturn's globe, shaded pixel by pixel once per size: banded albedo, a thin
 * sunlit crescent and the atmosphere glowing around the backlit limb. */
function saturnGlobe(size: number) {
  if (globeCache?.size === size) return globeCache.sprite;
  const sprite = makeCanvas();
  sprite.width = size;
  sprite.height = Math.ceil(size * SATURN_SQUASH);
  const g = sprite.getContext("2d");
  if (g) {
    // Albedo sampled on sin(latitude): the zones plus fine banding.
    const albedo = new Float32Array(512 * 3);
    for (let i = 0; i < 512; i++) {
      const latitude = (Math.asin(Math.min(1, i / 255.5 - 1)) * 180) / Math.PI;
      const next = Math.max(1, SATURN_ZONES.findIndex(([zone]) => zone >= latitude));
      const [lower, upper] = [SATURN_ZONES[next - 1], SATURN_ZONES[next]];
      const t = clamp01((latitude - lower[0]) / (upper[0] - lower[0]));
      const fine = 1 + 0.045 * Math.sin(latitude * 2.3) + 0.03 * Math.sin(latitude * 5.1 + 1) + 0.02 * Math.sin(latitude * 9.7 + 2);
      for (let channel = 0; channel < 3; channel++) albedo[i * 3 + channel] = lerp(lower[channel + 1], upper[channel + 1], t) * fine;
    }
    const { width, height } = sprite;
    const image = g.createImageData(width, height);
    const radius = width / 2;
    const [sinB, cosB] = [Math.sin(SATURN_OPENING), Math.cos(SATURN_OPENING)];
    const [lx, ly, lz] = SATURN_SUN;
    for (let py = 0; py < height; py++) {
      const v = (py + 0.5 - height / 2) / (radius * SATURN_SQUASH);
      for (let px = 0; px < width; px++) {
        const u = (px + 0.5 - radius) / radius;
        const rho2 = u * u + v * v;
        if (rho2 >= 1) continue;
        const nz = Math.sqrt(1 - rho2);
        const ny = -v;
        const index = Math.min(511, Math.max(0, Math.round((ny * cosB + nz * sinB + 1) * 255.5))) * 3;
        const sun = u * lx + ny * ly + nz * lz;
        const twilight = Math.max(0, sun + 0.3) / 1.3;
        const edge = 1 - nz;
        const rim = edge * edge * edge * (0.25 + 1.8 * twilight * twilight); // atmosphere lit from behind
        // Warm light scattered from the haze fills the night side; the sun itself is whiter.
        const limb = 0.62 + 0.38 * nz;
        const fill = (0.26 + 0.1 * ny) * limb;
        const direct = (1.3 * Math.max(0, sun) + 0.3 * twilight * twilight) * limb;
        const offset = (py * width + px) * 4;
        image.data[offset] = albedo[index] * (fill + direct) + 255 * rim;
        image.data[offset + 1] = albedo[index + 1] * (fill * 0.78 + direct * 0.93) + 196 * rim;
        image.data[offset + 2] = albedo[index + 2] * (fill * 0.54 + direct * 0.82) + 128 * rim;
        image.data[offset + 3] = Math.min(1, (1 - Math.sqrt(rho2)) * radius) * 255;
      }
    }
    g.putImageData(image, 0, 0);
  }
  globeCache = { size, sprite };
  return sprite;
}

type RingLayer = { flat: HTMLCanvasElement; glow: HTMLCanvasElement };
let ringCache: { key: string; scale: number; back: RingLayer; front: RingLayer } | null = null;
const RING_REACH = 2.36; // just past the F ring, in planet radii
/** The ring system drawn once per size: the far and near halves, each split into
 * what covers the sky (flat) and what adds light to it (glow). Stroking dozens of
 * foreshortened arcs every frame is far too slow. */
function saturnRings(radius: number, scale: number) {
  const key = `${Math.round(radius)}@${scale}`;
  if (ringCache?.key === key) return ringCache;
  const sinB = Math.sin(SATURN_OPENING);
  const outer = radius * RING_REACH + 2;
  // Thin strips across each ring, each a little denser or sparser than the next.
  const strips = SATURN_RINGS.flatMap(([inner, edge, color, alpha, glows]) => {
    const count = Math.max(1, Math.round((edge - inner) / 0.018));
    return Array.from({ length: count }, (_, index) => ({
      radius: inner + ((index + 0.5) * (edge - inner)) / count,
      width: (edge - inner) / count,
      color,
      glows,
      alpha: alpha * (0.7 + 0.3 * Math.abs(Math.sin(inner * 97 + index * 12.9898))),
    }));
  });
  const layer = (half: "back" | "front", glows: boolean) => {
    const canvas = makeCanvas();
    canvas.width = Math.ceil(outer * 2 * scale);
    canvas.height = Math.ceil((outer * sinB + 4) * scale);
    const g = canvas.getContext("2d");
    if (!g) return canvas;
    g.scale(scale, scale);
    g.translate(outer, half === "back" ? outer * sinB + 2 : 2);
    g.scale(1, sinB);
    g.globalCompositeOperation = glows ? "lighter" : "source-over";
    const [start, end] = half === "back" ? [Math.PI, TAU] : [0, Math.PI];
    for (const strip of strips) {
      if (strip.glows !== glows) continue;
      g.globalAlpha = strip.alpha;
      g.strokeStyle = `rgb(${strip.color})`;
      g.lineWidth = strip.width * radius + 0.6;
      g.beginPath();
      g.arc(0, 0, strip.radius * radius, start, end);
      g.stroke();
    }
    if (glows) {
      // Sunlight scattered forward through the ring particles, strongest towards the sun.
      const scatter = g.createLinearGradient(-radius * 2.4, 0, radius * 2.4, 0);
      scatter.addColorStop(0, "rgba(255,214,160,0.55)");
      scatter.addColorStop(0.45, "rgba(255,180,120,0.12)");
      scatter.addColorStop(1, "rgba(255,170,110,0.04)");
      g.globalAlpha = 1;
      g.strokeStyle = scatter;
      g.lineWidth = radius * 1.1;
      g.beginPath();
      g.arc(0, 0, radius * 1.79, start, end);
      g.stroke();
    }
    return canvas;
  };
  ringCache = {
    key,
    scale,
    back: { flat: layer("back", false), glow: layer("back", true) },
    front: { flat: layer("front", false), glow: layer("front", true) },
  };
  return ringCache;
}

export function saturn(): Fx {
  const stars = starfield(150);
  const ice = Array.from({ length: scaled(340) }, () => {
    let radius = rand(1.26, 2.26);
    if (radius > 1.95 && radius < 2.03) radius += 0.09; // keep the Cassini division clear
    return { radius, angle: rand(0, TAU), size: rand(0.7, 1.7) };
  });
  const moons = [
    { distance: 3.1, size: 0.1, speed: 0.32, angle: rand(0, TAU) },
    { distance: 2.6, size: 0.05, speed: 0.5, angle: rand(0, TAU) },
    { distance: 2.85, size: 0.04, speed: 0.22, angle: rand(0, TAU) },
  ];
  // Lens sparkles in the sky.
  const sparkles = [
    [0.08, 0.14, 26],
    [0.64, 0.07, 18],
    [0.9, 0.74, 22],
  ].map(([x, y, size]) => ({ x, y, size, phase: rand(0, TAU), speed: rand(1.2, 2.4) }));
  // Ice and rock tumbling past the lens, the nearest far out of focus.
  const debris = Array.from({ length: 18 }, () => {
    const depth = Math.random() ** 0.6;
    return {
      x: rand(-0.1, 1.1),
      y: rand(-0.1, 1.1),
      depth,
      size: lerp(4, 150, depth ** 2.4),
      spin: rand(-0.7, 0.7),
      angle: rand(0, TAU),
      drift: rand(0.01, 0.025),
      // A lumpy outline: uneven radii at uneven angles.
      shape: Array.from({ length: 11 }, (_, index) => [((index + rand(-0.3, 0.3)) / 11) * TAU, rand(0.45, 1)] as const),
    };
  });
  const look: Look = { tint: "255,184,118", light: [0.4, 0.3], bloom: 0.55, haze: 0.07, dust: motes(110), vignette: 0.65 };
  let spin = 0;
  return (ctx, frame) => {
    const { phase, p, dt, w, h, time } = frame;
    const cover = phase === "cover" ? easeInOut(p) : 1;
    const rise = phase === "cover" ? easeOut(p) : 1;
    // On the way out the planet slides off the sun, the light floods the screen
    // and the scene is gone by the time it fades.
    const part = phase === "reveal" ? easeInOut(clamp01(p / 0.45)) : 0;
    const fade = phase === "reveal" ? 1 - clamp01((p - 0.4) / 0.12) : 1;
    const flood = phase === "reveal" ? easeIn(clamp01((p - 0.2) / 0.25)) * (1 - clamp01((p - 0.48) / 0.52)) ** 1.6 : 0;
    const shown = cover * fade;

    // Sized so the globe fills over half the height and the rings most of the width.
    const radius = Math.min(h * 0.34, w * 0.19);
    const globe = saturnGlobe(Math.min(760, Math.round(radius * 2 * (ctx.canvas.width / w))));
    const [restX, restY] = [w / 2, h * 0.45];
    const sunX = restX + SUN_SCREEN[0] * radius * 0.88;
    const sunY = restY + SUN_SCREEN[1] * radius * 0.88;
    const R = radius * (0.86 + 0.14 * rise) * (1 + 0.05 * part);
    const x = restX - SUN_SCREEN[0] * radius * 0.32 * part + Math.sin(time * 0.3) * w * 0.003;
    const y = restY + (1 - rise) * h * 0.32 - SUN_SCREEN[1] * radius * 0.32 * part + Math.cos(time * 0.25) * h * 0.003;
    // How much of the sun shows past the limb.
    const [dx, dy] = [sunX - x, sunY - y];
    const [cosT, sinT] = [Math.cos(-SATURN_TILT), Math.sin(-SATURN_TILT)];
    const reach = Math.hypot((dx * cosT - dy * sinT) / R, (dx * sinT + dy * cosT) / (R * SATURN_SQUASH));
    const exposure = clamp01((reach - 0.97) / 0.07);

    // Warm dark sky, faint stars, and the sun's light scattered around the planet.
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = shown;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#060302");
    sky.addColorStop(0.6, "#0d0704");
    sky.addColorStop(1, "#170d07");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    // Haze lying low across the frame, as in a dusty atmosphere.
    const ground = ctx.createLinearGradient(0, h * 0.5, 0, h);
    ground.addColorStop(0, "rgba(130,76,40,0)");
    ground.addColorStop(1, "rgba(130,76,40,0.22)");
    ctx.fillStyle = ground;
    ctx.fillRect(0, h * 0.5, w, h * 0.5);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#ffe9d0";
    for (const star of stars) {
      ctx.globalAlpha = shown * star.alpha * 0.55 * (0.65 + 0.35 * Math.sin(time * star.twinkle + star.x * 40));
      ctx.fillRect(star.x * w, star.y * h, star.size, star.size);
    }
    ctx.globalAlpha = shown;
    const haloReach = radius * 2.3;
    const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, haloReach);
    halo.addColorStop(0, "rgba(255,240,214,1)");
    halo.addColorStop(0.1, "rgba(255,206,140,0.62)");
    halo.addColorStop(0.32, "rgba(214,120,58,0.16)");
    halo.addColorStop(1, "rgba(110,50,20,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - haloReach, sunY - haloReach, haloReach * 2, haloReach * 2);

    spin += dt * 0.9;
    const [sinB, cosB] = [Math.sin(SATURN_OPENING), Math.cos(SATURN_OPENING)];
    const insidePlanet = (px: number, py: number) => (px * px) / (R * R) + (py * py) / (R * SATURN_SQUASH) ** 2 < 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(SATURN_TILT);

    const drawMoons = (behind: boolean) => {
      for (const moon of moons) {
        const mx = Math.cos(moon.angle) * moon.distance * R;
        const my = Math.sin(moon.angle) * moon.distance * R * sinB;
        if (Math.sin(moon.angle) < 0 !== behind || (behind && insidePlanet(mx, my))) continue;
        const size = moon.size * R * (1 + 0.08 * Math.sin(moon.angle));
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = shown;
        ctx.fillStyle = "#140d09";
        ctx.beginPath();
        ctx.arc(mx, my, size, 0, TAU);
        ctx.fill();
        // Backlit: only a thin crescent on the sun's side catches the light.
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgb(255,214,170)";
        ctx.lineWidth = Math.max(1, size * 0.16);
        ctx.beginPath();
        ctx.arc(mx, my, size * 0.92, SUN_ANGLE - 1.1, SUN_ANGLE + 1.1);
        ctx.stroke();
      }
    };
    const rings = saturnRings(radius, ctx.canvas.width / w);
    const drawRings = (half: "back" | "front") => {
      const { flat, glow } = rings[half];
      const k = R / radius; // the sprites are drawn at the resting size
      const [width, height] = [(flat.width / rings.scale) * k, (flat.height / rings.scale) * k];
      const top = half === "back" ? -((radius * RING_REACH + 2) * sinB + 2) * k : -2 * k;
      ctx.globalAlpha = shown;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(flat, -width / 2, top, width, height);
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(glow, -width / 2, top, width, height);
    };

    for (const moon of moons) moon.angle += dt * moon.speed;
    drawMoons(true);
    drawRings("back");

    // The globe hides the middle of the halo, so only a ring of light escapes around it.
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = shown;
    ctx.drawImage(globe, -R, -R * SATURN_SQUASH, R * 2, R * 2 * SATURN_SQUASH);
    // Storms, belt festoons and the polar hexagon turn with the planet, lit like the globe.
    const feature = (latitude: number, longitude: number) => {
      const phi = (latitude * Math.PI) / 180;
      const [cosPhi, sinPhi] = [Math.cos(phi), Math.sin(phi)];
      const nx = cosPhi * Math.sin(longitude);
      const ny = sinPhi * cosB - cosPhi * Math.cos(longitude) * sinB;
      const nz = cosPhi * Math.cos(longitude) * cosB + sinPhi * sinB;
      const lit = Math.min(1, 0.22 + 0.1 * ny + 1.3 * Math.max(0, nx * SATURN_SUN[0] + ny * SATURN_SUN[1] + nz * SATURN_SUN[2]));
      return { x: R * nx, y: -R * SATURN_SQUASH * ny, facing: nz, lit };
    };
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, R, R * SATURN_SQUASH, 0, 0, TAU);
    ctx.clip();
    for (const storm of SATURN_STORMS) {
      const spot = feature(storm.lat, storm.lon + spin);
      if (spot.facing <= 0.05) continue;
      ctx.globalAlpha = storm.alpha * spot.facing * spot.lit * shown;
      ctx.fillStyle = `rgb(${storm.color})`;
      ctx.beginPath();
      ctx.ellipse(spot.x, spot.y, storm.size * R * spot.facing, storm.size * R * 0.42, 0, 0, TAU);
      ctx.fill();
    }
    for (const latitude of [-26, -14, 19, 41]) {
      for (let k = 0; k < 12; k++) {
        const dash = feature(latitude, (k * TAU) / 12 + spin * (1 + latitude * 0.002));
        if (dash.facing <= 0.05) continue;
        ctx.globalAlpha = 0.3 * dash.facing * dash.lit * shown;
        ctx.fillStyle = k % 2 ? "#fff3d6" : "#7d5a33";
        ctx.beginPath();
        ctx.ellipse(dash.x, dash.y, R * 0.05 * dash.facing, R * 0.012, 0, 0, TAU);
        ctx.fill();
      }
    }
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const corner = feature(76, (k * Math.PI) / 3 + spin * 0.8);
      if (k) ctx.lineTo(corner.x, corner.y);
      else ctx.moveTo(corner.x, corner.y);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.5 * feature(90, 0).lit * shown;
    ctx.strokeStyle = "rgba(220,206,180,0.8)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
    // The atmosphere glows along the limb, brightest towards the hidden sun.
    const limb = ctx.createLinearGradient(SUN_FRAME[0] * R, SUN_FRAME[1] * R, -SUN_FRAME[0] * R, -SUN_FRAME[1] * R);
    limb.addColorStop(0, "rgba(255,228,186,1)");
    limb.addColorStop(0.5, "rgba(255,170,100,0.35)");
    limb.addColorStop(1, "rgba(255,150,90,0.1)");
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = limb;
    for (const [grow, width, strength] of [
      [1, 0.014, 0.9],
      [1.02, 0.045, 0.35],
      [1.055, 0.11, 0.14],
    ] as const) {
      ctx.globalAlpha = strength * shown;
      ctx.lineWidth = R * width;
      ctx.beginPath();
      ctx.ellipse(0, 0, R * grow, R * SATURN_SQUASH * grow, 0, 0, TAU);
      ctx.stroke();
    }

    drawRings("front");
    // Ice in the rings orbits faster on the inside, like the real thing.
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#fff0d8";
    for (const grain of ice) {
      grain.angle += dt * 1.25 * (1.5 / grain.radius) ** 1.5;
      const gx = Math.cos(grain.angle) * grain.radius * R;
      const gy = Math.sin(grain.angle) * grain.radius * R * sinB;
      if (Math.sin(grain.angle) < 0 && insidePlanet(gx, gy)) continue;
      ctx.globalAlpha = 0.7 * shown;
      ctx.fillRect(gx, gy, grain.size, grain.size);
    }
    drawMoons(false);
    ctx.restore();

    // The sun, wherever it shows past the limb: a white core, a star and a streak.
    // On the way out it fades with the flood rather than outliving the scene.
    const afterglow = phase === "reveal" ? 1 - clamp01((p - 0.38) / 0.2) : 1;
    if (exposure > 0 && afterglow > 0) {
      const strength = exposure * cover * afterglow;
      ctx.globalCompositeOperation = "lighter";
      dot(ctx, "255,214,160", sunX, sunY, R * 2.2, strength * 0.5);
      dot(ctx, "255,252,244", sunX, sunY, R * (0.18 + 0.4 * exposure), strength);
      glint(ctx, sunX, sunY, R * (0.5 + 1.4 * exposure), "255,238,214", strength * 0.9, 0.2 + time * 0.1);
      streak(ctx, sunX, sunY, w * 0.6 * exposure, "255,214,170", strength * 0.85);
    }
    // The debris: dark against the light, rimmed on the side facing the hidden sun.
    // It drifts across the frame faster the nearer it is, and is blown clear when
    // the sun breaks out.
    for (const chunk of debris) {
      const parallax = 0.3 + chunk.depth * 1.7;
      chunk.x -= chunk.drift * parallax * dt;
      if (part > 0) {
        const [awayX, awayY] = [chunk.x * w - sunX, chunk.y * h - sunY];
        const distance = Math.hypot(awayX, awayY) || 1;
        chunk.x += ((awayX / distance) * part * parallax * 0.6 * dt * h) / w;
        chunk.y += (awayY / distance) * part * parallax * 0.6 * dt;
      }
      if (chunk.x < -0.15) [chunk.x, chunk.y] = [1.15, rand(-0.1, 1.1)];
      chunk.angle += chunk.spin * dt;
      const [cx, cy] = [chunk.x * w, chunk.y * h];
      const size = (chunk.size * h) / 900;
      const toSun = Math.atan2(sunY - cy, sunX - cx) - chunk.angle;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(chunk.angle);
      ctx.beginPath();
      for (const [angle, radius] of chunk.shape) ctx.lineTo(Math.cos(angle) * radius * size, Math.sin(angle) * radius * size);
      ctx.closePath();
      ctx.globalCompositeOperation = "source-over";
      if (chunk.depth > 0.78) {
        // Right at the lens: a soft dark blur with a warm halo where the light catches it.
        const blur = ctx.createRadialGradient(0, 0, size * 0.2, 0, 0, size * 1.15);
        blur.addColorStop(0, "rgba(14,9,6,0.85)");
        blur.addColorStop(1, "rgba(14,9,6,0)");
        ctx.globalAlpha = shown * 0.8;
        ctx.fillStyle = blur;
        ctx.fillRect(-size * 1.2, -size * 1.2, size * 2.4, size * 2.4);
        ctx.globalCompositeOperation = "lighter";
        dot(ctx, "255,190,120", Math.cos(toSun) * size * 0.75, Math.sin(toSun) * size * 0.75, size * 1.4, shown * 0.18);
      } else {
        ctx.globalAlpha = shown;
        ctx.fillStyle = "#130c08";
        ctx.fill();
        const rim = ctx.createLinearGradient(Math.cos(toSun) * size, Math.sin(toSun) * size, -Math.cos(toSun) * size, -Math.sin(toSun) * size);
        rim.addColorStop(0, "rgba(255,226,180,0.95)");
        rim.addColorStop(0.45, "rgba(255,160,90,0.15)");
        rim.addColorStop(1, "rgba(255,160,90,0)");
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = rim;
        ctx.lineWidth = Math.max(0.8, size * 0.09);
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const sparkle of sparkles) {
      const twinkle = (0.5 + 0.5 * Math.sin(time * sparkle.speed + sparkle.phase)) ** 3;
      glint(ctx, sparkle.x * w, sparkle.y * h, sparkle.size * (0.6 + 0.4 * twinkle), "255,226,190", (0.25 + 0.6 * twinkle) * shown, 0.3);
    }
    if (flood > 0) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = flood;
      const light = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.hypot(w, h));
      light.addColorStop(0, "rgba(255,255,255,1)");
      light.addColorStop(0.3, "rgba(255,240,216,1)");
      light.addColorStop(1, "rgba(255,206,160,0.9)");
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, w, h);
    }

    look.light = [sunX / w, sunY / h];
    look.blast = part > 0 ? { x: sunX, y: sunY, force: 700 * part } : undefined;
    cinema(ctx, frame, look, shown);
    terminal(ctx, frame, "saturn", "255,200,140");
  };
}
