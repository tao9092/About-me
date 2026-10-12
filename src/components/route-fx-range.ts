// ── Competitions: down a rifle scope at a chess king standing on the range at
// dusk. The shot breaks, the film drops into bullet time beside the round as it
// flies, it bursts the king (checkmate), and the shock cracks the lens and
// shatters the frame ───────────────────────────────────────────────────────
import {
  burst,
  cinema,
  clamp01,
  dot,
  drawSparks,
  easeIn,
  easeInOut,
  easeOut,
  flash,
  type Fx,
  glint,
  type Look,
  lerp,
  makeCanvas,
  MONO,
  motes,
  rand,
  shake,
  type Spark,
  streak,
  TAU,
  terminal,
} from "@/components/route-fx-kit";
import { stage } from "@/components/route-fx-3d";

const CYAN = "141,255,240";
const AMBER = "255,180,110";
// When the round leaves the barrel, when it reaches the plate, when the lens breaks.
const FIRE = 0.06;
const IMPACT = 0.64;
const BREAK = 0.74;

/** A ridgeline: heights 0–1 at evenly spaced points, from a few random waves. */
function ridge(count: number, roughness: number) {
  const waves = Array.from({ length: 5 }, (_, k) => ({ frequency: (k + 1) * rand(1.3, 2.4), phase: rand(0, TAU), amplitude: 1 / (k + 1) ** roughness }));
  const total = waves.reduce((sum, wave) => sum + wave.amplitude, 0);
  return Array.from({ length: count + 1 }, (_, index) => {
    const x = (index / count) * TAU;
    return 0.5 + waves.reduce((sum, wave) => sum + Math.sin(x * wave.frequency + wave.phase) * wave.amplitude, 0) / total / 2;
  });
}
/** Fills a mountain layer: a ridgeline across the frame down to a baseline. */
function mountains(g: CanvasRenderingContext2D, heights: number[], left: number, width: number, base: number, rise: number, color: string) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(left, base);
  heights.forEach((height, index) => g.lineTo(left + (index / (heights.length - 1)) * width, base - height * rise));
  g.lineTo(left + width, base);
  g.closePath();
  g.fill();
}
/** Dusk sky: deep teal overhead, amber at the horizon, the sun low on the left. */
function sky(g: CanvasRenderingContext2D, w: number, top: number, horizon: number, sunX: number, sunY: number, sunSize: number) {
  const gradient = g.createLinearGradient(0, top, 0, horizon);
  gradient.addColorStop(0, "#071820");
  gradient.addColorStop(0.55, "#1d3a40");
  gradient.addColorStop(0.85, "#a35a32");
  gradient.addColorStop(1, "#e08a4a");
  g.fillStyle = gradient;
  g.fillRect(0, top, w, horizon - top + 1);
  g.globalCompositeOperation = "lighter";
  dot(g, "255,170,90", sunX, sunY, sunSize * 9, 0.35);
  dot(g, "255,226,180", sunX, sunY, sunSize * 2.2, 0.9);
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;
}

/** A spitzer bullet seen from the side, tip to the right: copper jacket, rifling, cannelure. */
function drawBullet(ctx: CanvasRenderingContext2D, x: number, y: number, length: number, spin: number) {
  const radius = length / 8;
  const profile = (t: number) => {
    if (t < 0.12) return radius * (0.82 + 0.18 * (t / 0.12)); // boat tail
    if (t < 0.5) return radius;
    const u = (t - 0.5) / 0.5; // ogive to a point
    return radius * (1 - u * u) ** 0.75;
  };
  const tail = x - length / 2;
  ctx.beginPath();
  for (let k = 0; k <= 40; k++) ctx.lineTo(tail + (k / 40) * length, y - profile(k / 40));
  for (let k = 40; k >= 0; k--) ctx.lineTo(tail + (k / 40) * length, y + profile(k / 40));
  ctx.closePath();
  // Polished copper mirrors its surroundings: sky along the top, the warm ground below.
  const jacket = ctx.createLinearGradient(0, y - radius, 0, y + radius);
  jacket.addColorStop(0, "rgb(64,92,100)");
  jacket.addColorStop(0.08, "rgb(146,166,166)");
  jacket.addColorStop(0.14, "rgb(255,238,218)");
  jacket.addColorStop(0.22, "rgb(234,152,92)");
  jacket.addColorStop(0.45, "rgb(168,84,40)");
  jacket.addColorStop(0.7, "rgb(74,34,15)");
  jacket.addColorStop(0.86, "rgb(156,84,42)");
  jacket.addColorStop(1, "rgb(28,13,6)");
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = jacket;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Rifling engraved into the jacket, turning with the spin.
  ctx.lineWidth = Math.max(1, radius * 0.05);
  for (let k = 0; k < 6; k++) {
    const angle = spin + (k * TAU) / 6;
    const facing = Math.cos(angle);
    if (facing <= 0) continue;
    const offset = Math.sin(angle) * radius * 0.92;
    ctx.globalAlpha = facing * 0.55;
    ctx.strokeStyle = "rgb(60,26,10)";
    ctx.beginPath();
    ctx.moveTo(tail + length * 0.13, y + offset);
    ctx.lineTo(tail + length * 0.56, y + offset + radius * 0.12);
    ctx.stroke();
  }
  // The cannelure, a crimp ring around the body, with a lit lip.
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = "rgb(56,24,10)";
  ctx.fillRect(tail + length * 0.42, y - radius, length * 0.018, radius * 2);
  ctx.fillStyle = "rgba(255,214,170,0.6)";
  ctx.fillRect(tail + length * 0.44, y - radius, length * 0.006, radius * 2);
  ctx.restore();
  ctx.globalCompositeOperation = "lighter";
  dot(ctx, "255,236,210", tail + length * 0.78, y - radius * 0.4, radius * 0.9, 0.5);
}

// The king's profile from the foot up: half-widths at heights, in units of its height.
const KING: [number, number][] = [
  [0.3, 0], [0.3, 0.035], [0.26, 0.055], [0.275, 0.085], [0.2, 0.115], [0.135, 0.17], [0.105, 0.3], [0.095, 0.45],
  [0.1, 0.55], [0.17, 0.575], [0.17, 0.605], [0.115, 0.625], [0.13, 0.66], [0.165, 0.73], [0.17, 0.78], [0.14, 0.815],
  [0.06, 0.835], [0.03, 0.835], [0.03, 0.875], [0.075, 0.875], [0.075, 0.91], [0.03, 0.91], [0.03, 0.975], [0, 0.975],
];
const CROWN = 0.74; // the height of the king's head, where the round strikes
/** The black king, polished, rim-lit by the low sun on its left. */
function drawKing(ctx: CanvasRenderingContext2D, x: number, foot: number, height: number) {
  const outline = () => {
    ctx.beginPath();
    for (const [half, up] of KING) ctx.lineTo(x + half * height, foot - up * height);
    for (let k = KING.length - 1; k >= 0; k--) ctx.lineTo(x - KING[k][0] * height, foot - KING[k][1] * height);
    ctx.closePath();
  };
  outline();
  const body = ctx.createLinearGradient(0, foot - height, 0, foot);
  body.addColorStop(0, "#2e2621");
  body.addColorStop(0.45, "#16110e");
  body.addColorStop(1, "#0a0807");
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = body;
  ctx.fill();
  // A glossy highlight down the body, and the sunset caught along its left edge.
  ctx.save();
  ctx.clip();
  const sheen = ctx.createLinearGradient(x - height * 0.3, 0, x + height * 0.3, 0);
  sheen.addColorStop(0.28, "rgba(255,220,190,0)");
  sheen.addColorStop(0.36, "rgba(255,220,190,0.16)");
  sheen.addColorStop(0.44, "rgba(255,220,190,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(x - height * 0.3, foot - height, height * 0.6, height);
  ctx.restore();
  ctx.beginPath();
  for (let k = KING.length - 1; k >= 0; k--) ctx.lineTo(x - KING[k][0] * height, foot - KING[k][1] * height);
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = "rgba(255,186,120,0.85)";
  ctx.lineWidth = Math.max(1, height * 0.012);
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}
/** The king's stand: a plinth topped with a band of chessboard squares. */
function drawPlinth(ctx: CanvasRenderingContext2D, x: number, top: number, width: number) {
  const tall = width * 0.5;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#1b1512";
  ctx.fillRect(x - width / 2, top, width, tall);
  const square = width / 8;
  for (let k = 0; k < 8; k++) {
    for (let row = 0; row < 2; row++) {
      ctx.fillStyle = (k + row) % 2 ? "#e9dfcf" : "#2a211b";
      ctx.fillRect(x - width / 2 + k * square, top + row * square * 0.5, square, square * 0.5);
    }
  }
  ctx.fillStyle = "rgba(255,186,120,0.5)";
  ctx.fillRect(x - width / 2, top, 2, tall);
}

type Shard = { points: [number, number][]; cx: number; cy: number; vx: number; vy: number; spin: number; tumble: number; lean: number; grow: number };
// The shared low-resolution layer for blurred backgrounds.
let haze: HTMLCanvasElement | null = null;
export function releaseRange() {
  if (haze) haze.width = haze.height = 0;
}

export function range(): Fx {
  const far = ridge(48, 1.2);
  const near = ridge(40, 0.9);
  const hills = ridge(32, 0.7);
  const posts = Array.from({ length: 9 }, (_, index) => ({ at: index / 9 + rand(0, 0.08), tall: rand(0.12, 0.22) }));
  const grass = Array.from({ length: 70 }, () => ({ x: Math.random(), y: rand(0.64, 1), length: rand(0.02, 0.08) }));
  const look: Look = { tint: "141,230,220", light: [0.3, 0.45], bloom: 0.5, haze: 0.05, dust: motes(60), vignette: 0.5, grain: 0.42 };
  let snapshot: HTMLCanvasElement | null = null;
  // The burst king: a sprite of it and the pieces it breaks into.
  let pieces: { sprite: HTMLCanvasElement; left: number; top: number; wide: number; tall: number; shards: Shard[]; born: number } | null = null;
  let shards: Shard[] = [];
  let cracks: [number, number][][] = [];
  let sparks: Spark[] = [];
  let embers: Spark[] = [];
  let shatterAge = 0;
  let spin = 0;
  const rings: { born: number }[] = [];
  const wake: { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number }[] = [];
  let lastRing = -1;
  let aimX = 0; // the rifle's sway while aiming
  let aimY = 0;
  let impactX = 0; // where the round meets the plate, and the lens cracks
  let impactY = 0;

  return (ctx, frame) => {
    const { phase, p, dt, w, h, time, route } = frame;
    const unit = Math.min(w, h);
    const cover = phase === "cover" ? easeInOut(p) : 1;
    const scopeRadius = unit * 0.42 * lerp(1.7, 1, phase === "cover" ? easeOut(p) : 1);
    const inScope = phase !== "reveal" || p < FIRE + 0.04;
    const inFlight = phase === "reveal" && p >= FIRE + 0.04 && p < BREAK;
    const breaking = phase === "reveal" && p >= BREAK;
    if (!impactX) [impactX, impactY] = [w * 0.66, h * 0.5];
    if (phase === "reveal" && p >= IMPACT && p < IMPACT + 0.08) shake(ctx, 16 * (1 - (p - IMPACT) / 0.08));

    // ── Through the scope ──────────────────────────────────────────────────
    if (inScope) {
      // The breath moves the rifle until the trigger breaks; the shot kicks it up.
      const kick = phase === "reveal" ? Math.sin(Math.PI * clamp01(p / (FIRE + 0.04))) : 0;
      if (phase !== "reveal") {
        aimX = Math.sin(time * 1.3) * unit * 0.008 + Math.sin(time * 3.1) * unit * 0.002;
        aimY = Math.cos(time * 1.7) * unit * 0.006;
      }
      const cx = w / 2;
      const cy = h / 2;
      // The scene in the glass: everything shifts opposite to the rifle's sway.
      const ox = -aimX;
      const oy = -aimY + kick * unit * 0.25;
      const horizon = cy + unit * 0.06 + oy;
      const focusPull = phase === "cover" ? 1 - easeOut(clamp01(p / 0.8)) : 0;
      const scene = stage(ctx, w);
      if (!scene) return;
      sky(scene, w, -unit, horizon, cx - unit * 0.62 + ox, horizon - unit * 0.05, unit * 0.03);
      mountains(scene, far, -unit + ox * 0.6, w + unit * 2, horizon, unit * 0.18, "#4b4447");
      mountains(scene, near, -unit + ox * 0.8, w + unit * 2, horizon + 2, unit * 0.1, "#2c2427");
      // The range floor, raking light catching the grass, lane lines running out to the plate.
      const ground = scene.createLinearGradient(0, horizon, 0, h);
      ground.addColorStop(0, "#5a3a24");
      ground.addColorStop(0.25, "#2a1c14");
      ground.addColorStop(1, "#0f0b08");
      scene.fillStyle = ground;
      scene.fillRect(0, horizon, w, h - horizon);
      scene.strokeStyle = "rgba(255,190,130,0.16)";
      scene.lineWidth = 1;
      for (const blade of grass) {
        const y = horizon + (blade.y - 0.6) * (h - horizon) * 1.4;
        scene.beginPath();
        scene.moveTo(blade.x * w + ox, y);
        scene.lineTo(blade.x * w + ox + blade.length * w, y);
        scene.stroke();
      }
      scene.strokeStyle = "rgba(230,220,200,0.35)";
      scene.lineWidth = 2;
      for (const lane of [-1, 1]) {
        scene.beginPath();
        scene.moveTo(cx + ox + lane * unit * 0.2, horizon + unit * 0.02);
        scene.lineTo(cx + ox + lane * unit * 1.4, h + unit * 0.5);
        scene.stroke();
      }
      // The plate, with a flag beside it showing the wind.
      const targetX = cx + ox;
      const targetY = cy + oy; // the king's head, on the crosshair
      const kingHeight = unit * 0.22;
      const foot = targetY + CROWN * kingHeight;
      drawPlinth(scene, targetX, foot, kingHeight * 0.75);
      drawKing(scene, targetX, foot, kingHeight);
      scene.globalCompositeOperation = "lighter";
      dot(scene, "255,60,60", targetX, targetY, unit * 0.03, 0.55 + 0.25 * Math.sin(time * 6));
      scene.globalCompositeOperation = "source-over";
      scene.globalCompositeOperation = "source-over";
      scene.strokeStyle = "#141110";
      scene.lineWidth = 2;
      const poleX = targetX + unit * 0.3;
      scene.beginPath();
      scene.moveTo(poleX, horizon + unit * 0.06);
      scene.lineTo(poleX, horizon - unit * 0.2);
      scene.stroke();
      scene.fillStyle = "#c83a2a";
      scene.beginPath();
      scene.moveTo(poleX, horizon - unit * 0.2);
      for (let k = 0; k <= 8; k++) scene.lineTo(poleX + (k / 8) * unit * 0.1, horizon - unit * 0.2 + Math.sin(time * 7 + k * 0.9) * unit * 0.006 * (k / 8));
      for (let k = 8; k >= 0; k--) scene.lineTo(poleX + (k / 8) * unit * 0.09, horizon - unit * 0.15 + Math.sin(time * 7 + k * 0.9 + 0.5) * unit * 0.006 * (k / 8));
      scene.closePath();
      scene.fill();

      // Through the glass: the shimmer band over the hot ground is redrawn in thin
      // slices, each nudged sideways; the rest goes across whole.
      const dpr = ctx.canvas.width / w;
      const source = scene.canvas;
      const [bandTop, bandBottom] = [Math.max(0, horizon - unit * 0.2), Math.min(h, horizon + unit * 0.05)];
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, scopeRadius, 0, TAU);
      ctx.clip();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = cover;
      for (const [from, to] of [[0, bandTop], [bandBottom, h]]) {
        if (to > from) ctx.drawImage(source, 0, from * dpr, source.width, (to - from) * dpr, 0, from * dpr, source.width, (to - from) * dpr);
      }
      for (let y = bandTop; y < bandBottom; y += 3) {
        const shift = Math.sin(y * 0.09 + time * 9) * 1.6 + Math.sin(y * 0.031 - time * 5) * 1.2;
        ctx.drawImage(source, 0, y * dpr, source.width, 3 * dpr, shift * dpr, y * dpr, source.width, 3 * dpr);
      }
      // Coming up to the eye the image starts out of focus.
      const g = (haze ??= makeCanvas()).getContext("2d");
      if (g && focusPull > 0) {
        const [width, height] = [Math.round(source.width / 6), Math.round(source.height / 6)];
        if (haze.width !== width || haze.height !== height) [haze.width, haze.height] = [width, height];
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(source, 0, 0, width, height);
        ctx.globalAlpha = focusPull * cover;
        ctx.drawImage(haze, 0, 0, source.width, source.height);
      }
      ctx.restore();

      // The muzzle flash fills the glass.
      if (phase === "reveal") flash(ctx, frame, 1 - clamp01(p / (FIRE + 0.04)), AMBER, cx, cy);

      // The scope itself: tube vignette, colour fringe, eye-box crescent, reticle.
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = cover;
      ctx.fillStyle = "#010203";
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.arc(cx, cy, scopeRadius, 0, TAU);
      ctx.fill("evenodd");
      const tubeShade = ctx.createRadialGradient(cx, cy, scopeRadius * 0.78, cx, cy, scopeRadius);
      tubeShade.addColorStop(0, "rgba(0,0,0,0)");
      tubeShade.addColorStop(1, "rgba(0,0,0,0.92)");
      ctx.fillStyle = tubeShade;
      ctx.beginPath();
      ctx.arc(cx, cy, scopeRadius, 0, TAU);
      ctx.fill();
      // The eye is never quite centred: a dark crescent slides round the edge.
      const offX = aimX * 1.8;
      const offY = aimY * 1.8;
      ctx.beginPath();
      ctx.arc(cx, cy, scopeRadius + 1, 0, TAU);
      ctx.arc(cx + offX, cy + offY, scopeRadius * 0.97, 0, TAU, true);
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 1.5;
      for (const [color, dx] of [["255,70,70", 1.2], ["70,240,255", -1.2]] as const) {
        ctx.strokeStyle = `rgba(${color},0.4)`;
        ctx.beginPath();
        ctx.arc(cx + dx, cy, scopeRadius * 0.985, 0, TAU);
        ctx.stroke();
      }
      // Ghost reflections of the sun inside the glass.
      for (const [along, size, alpha] of [[0.35, 0.16, 0.06], [0.62, 0.07, 0.09], [0.9, 0.24, 0.035]] as const) {
        dot(ctx, "255,200,150", cx + (unit * 0.62 - offX) * along * 0.6, cy - unit * 0.05 * along, unit * size, alpha * cover);
      }
      // Reticle: fine crosshair, heavy posts, mil-dots and a lit centre.
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = cover * 0.92;
      ctx.strokeStyle = "#050505";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - scopeRadius, cy);
      ctx.lineTo(cx + scopeRadius, cy);
      ctx.moveTo(cx, cy - scopeRadius);
      ctx.lineTo(cx, cy + scopeRadius);
      ctx.stroke();
      ctx.lineWidth = scopeRadius * 0.035;
      ctx.beginPath();
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1]] as const) {
        ctx.moveTo(cx + dx * scopeRadius * 0.55, cy + dy * scopeRadius * 0.55);
        ctx.lineTo(cx + dx * scopeRadius, cy + dy * scopeRadius);
      }
      ctx.stroke();
      ctx.fillStyle = "#050505";
      for (let k = 1; k <= 5; k++) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          ctx.beginPath();
          ctx.arc(cx + dx * k * scopeRadius * 0.09, cy + dy * k * scopeRadius * 0.09, Math.max(1.5, scopeRadius * 0.008), 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
      ctx.globalCompositeOperation = "lighter";
      dot(ctx, "255,60,60", cx, cy, Math.max(8, scopeRadius * 0.04), cover);
      // Readouts beside the scope.
      const settle = phase === "cover" ? clamp01((p - 0.4) / 0.6) : 1;
      if (settle > 0) {
        ctx.globalCompositeOperation = "source-over";
        ctx.font = `600 11px ${MONO}`;
        ctx.fillStyle = `rgb(${CYAN})`;
        const readout = [`RNG ${(450 + Math.sin(time * 3) * 0.4).toFixed(1)} M`, "WND +0.3 MIL ←", "ELV 2.1 MIL", `TGT ${route}`];
        // Beside the scope where there is room, under it on narrow screens.
        const roomy = cx + scopeRadius + 170 < w;
        const [readX, readY] = roomy ? [cx + scopeRadius + 24, cy - scopeRadius * 0.5] : [cx - scopeRadius, cy + scopeRadius + 28];
        readout.forEach((line, index) => {
          ctx.globalAlpha = settle * 0.85;
          ctx.fillText(line, readX, readY + index * 17);
        });
        ctx.globalAlpha = settle * (Math.floor(time * 4) % 2 ? 0.95 : 0.45);
        ctx.fillText(phase === "reveal" ? "● CHECKMATE" : "● KING IN SIGHT", roomy ? cx - scopeRadius - 150 : cx - scopeRadius, roomy ? cy + scopeRadius * 0.7 : cy - scopeRadius - 18);
      }
    }

    // ── Bullet time: beside the round as it flies ──────────────────────────
    if (inFlight || breaking) {
      const t = clamp01((p - (FIRE + 0.04)) / (IMPACT - FIRE - 0.04)); // 0 at the cut, 1 at impact
      const g = (haze ??= makeCanvas()).getContext("2d");
      const scale = 0.25;
      if (!snapshot && g && haze) {
        if (haze.width !== Math.round(w * scale) || haze.height !== Math.round(h * scale)) {
          haze.width = Math.round(w * scale);
          haze.height = Math.round(h * scale);
        }
        // The world rushing past, drawn small and stretched up: soft focus for free.
        g.setTransform(scale, 0, 0, scale, 0, 0);
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = 1;
        g.fillStyle = "#1a120c";
        g.fillRect(0, 0, w, h);
        const horizon = h * 0.62;
        const travel = t * 1.6 + time * 0.05;
        sky(g, w, 0, horizon, w * 0.16, horizon - h * 0.06, unit * 0.035);
        for (const [heights, speed, base, rise, color] of [
          [far, 0.15, horizon, h * 0.16, "#4b4447"],
          [near, 0.4, horizon + 2, h * 0.09, "#2c2427"],
          [hills, 1.2, horizon + h * 0.04, h * 0.07, "#1a1412"],
        ] as const) {
          const shift = ((travel * speed) % 1) * w * 2;
          mountains(g, heights, -shift, w * 2, base, rise, color);
          mountains(g, heights, w * 2 - shift, w * 2, base, rise, color);
        }
        const ground = g.createLinearGradient(0, horizon, 0, h);
        ground.addColorStop(0, "#4a3020");
        ground.addColorStop(1, "#0d0906");
        g.fillStyle = ground;
        g.fillRect(0, horizon + h * 0.04, w, h);
        g.strokeStyle = "rgba(255,190,130,0.14)";
        g.lineWidth = 3;
        for (const blade of grass) {
          const x = ((((blade.x - travel * 3.2) % 1) + 1) % 1) * w * 1.4 - w * 0.2;
          const y = horizon + h * 0.05 + (blade.y - 0.6) * h * 0.9;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + blade.length * w * 4, y);
          g.stroke();
        }
        g.fillStyle = "#0b0807";
        for (const post of posts) {
          const x = (((post.at - travel * 2.4) % 1) + 1) % 1;
          g.fillRect(x * w * 1.2 - w * 0.1, h * (0.8 - post.tall), w * 0.012, h * post.tall + h * 0.3);
        }
        const dpr = ctx.canvas.width / w;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        // Motion blur: a few copies smeared along the direction of travel.
        for (let k = 0; k < 4; k++) {
          ctx.globalAlpha = k ? 0.35 : 1;
          ctx.drawImage(haze, 0, 0, haze.width, haze.height, -k * 14 * dpr, 0, w * dpr, h * dpr);
        }
        ctx.restore();

        // The round: drifting forward across the frame, turning slowly in slow motion.
        // On a phone held upright it flies shorter and further left, leaving room
        // for the king to come up in frame.
        spin += dt * 2.2;
        const upright = w < h;
        const length = Math.min(w * (upright ? 0.5 : 0.36), h * 0.7);
        const bx = upright ? lerp(w * 0.2, w * 0.32, easeIn(t)) : lerp(w * 0.34, w * 0.58, easeIn(t));
        const by = h * 0.5 + Math.sin(time * 1.7) * h * 0.004;
        const tip = bx + length / 2;
        const base = bx - length / 2;
        // Heat trail: the background behind the round wavers.
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const [top, tall] = [by - length * 0.3, length * 0.6];
        for (let x = Math.max(0, base - w * 0.7); x < base; x += 6) {
          const fade = 1 - (base - x) / (w * 0.7);
          ctx.globalAlpha = 0.8 * fade;
          ctx.drawImage(haze, x * scale, top * scale, 6 * scale, tall * scale, x * dpr, (top + Math.sin(x * 0.07 - time * 14) * 5 * fade) * dpr, 6 * dpr, tall * dpr);
        }
        ctx.restore();
        // Shock waves off the tip and the base: a soft sheet of compressed air with a sharp front.
        ctx.globalCompositeOperation = "lighter";
        for (const [from, strength] of [[tip, 0.3], [base + length * 0.05, 0.14]] as const) {
          for (const side of [-1, 1]) {
            const angle = Math.PI - 0.38;
            const reach = w * 0.9;
            const cone = ctx.createLinearGradient(from, by, from + Math.cos(angle) * reach, by + side * Math.sin(angle) * reach);
            cone.addColorStop(0, `rgba(230,250,255,${strength})`);
            cone.addColorStop(1, "rgba(230,250,255,0)");
            ctx.strokeStyle = cone;
            ctx.globalAlpha = 1;
            for (const [width, alpha] of [[10, 0.12], [2.2, 1]] as const) {
              ctx.globalAlpha = alpha;
              ctx.lineWidth = width;
              ctx.beginPath();
              ctx.moveTo(from, by + side * length * 0.004);
              ctx.lineTo(from + Math.cos(angle) * reach, by + side * Math.sin(angle) * reach);
              ctx.stroke();
            }
          }
        }
        // Vapour rings shed at the nose drift back and spread.
        if (time - lastRing > 0.07) {
          lastRing = time;
          rings.push({ born: time });
        }
        ctx.strokeStyle = "rgb(220,240,245)";
        for (let k = rings.length - 1; k >= 0; k--) {
          const age = time - rings[k].born;
          if (age > 0.9) {
            rings.splice(k, 1);
            continue;
          }
          const x = tip - length * 0.15 - age * w * 0.55;
          const size = length * (0.14 + age * 0.5);
          ctx.globalAlpha = (1 - age / 0.9) * 0.22;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(x, by, size * 0.22, size, 0, 0, TAU);
          ctx.stroke();
        }
        // Turbulent wake off the base.
        for (let k = 0; k < 4; k++) wake.push({ x: base, y: by + rand(-1, 1) * length * 0.08, vx: -rand(260, 520), vy: rand(-40, 40), age: 0, life: rand(0.4, 0.9), size: rand(1.5, 4) });
        for (let k = wake.length - 1; k >= 0; k--) {
          const puff = wake[k];
          puff.age += dt;
          if (puff.age > puff.life) {
            wake.splice(k, 1);
            continue;
          }
          puff.x += puff.vx * dt;
          puff.y += puff.vy * dt;
          puff.vy += Math.sin(puff.age * 12 + puff.x * 0.02) * 60 * dt;
          dot(ctx, "220,235,240", puff.x, puff.y, puff.size * (1 + puff.age * 6), (1 - puff.age / puff.life) * 0.28);
        }
        drawBullet(ctx, bx, by, length, spin);
        // Hot base and a glint along the jacket.
        ctx.globalCompositeOperation = "lighter";
        dot(ctx, "255,140,70", base, by, length * 0.22, 0.35);
        glint(ctx, bx + length * 0.12, by - length / 8 * 0.62, length * 0.16, "255,236,214", 0.6 + 0.4 * Math.sin(spin * 3));

        // The king comes up on the right just before the hit; the round takes it
        // in the head and it bursts into pieces flung on along the shot.
        const kingHeight = Math.min(h * 0.85, w * 1.1);
        const kingFoot = by + CROWN * kingHeight;
        const kingX = lerp(w * 1.3, tip + kingHeight * 0.15, easeOut(clamp01((t - 0.6) / 0.4)));
        if (t > 0.6 && p < IMPACT) drawKing(ctx, kingX, kingFoot, kingHeight);
        if (p >= IMPACT && !pieces) {
          const dpr = ctx.canvas.width / w;
          const [left, top, wide, tall] = [kingX - kingHeight * 0.32, kingFoot - kingHeight, kingHeight * 0.64, kingHeight];
          const sprite = makeCanvas(Math.ceil(wide * dpr), Math.ceil(tall * dpr));
          const g = sprite.getContext("2d");
          if (g) {
            g.scale(dpr, dpr);
            g.translate(-left, -top);
            drawKing(g, kingX, kingFoot, kingHeight);
          }
          const reach = kingHeight * 1.2;
          const angles = Array.from({ length: 14 }, (_, index) => ((index + rand(0.2, 0.8)) / 14) * TAU);
          const radii = [0, reach * 0.07, reach * 0.22, reach * 0.5, reach];
          const shards: Shard[] = [];
          angles.forEach((angle, index) => {
            const next = angles[(index + 1) % angles.length] + (index === angles.length - 1 ? TAU : 0);
            for (let band = 0; band < radii.length - 1; band++) {
              const [inner, outer] = [radii[band], radii[band + 1]];
              const mid = (angle + next) / 2;
              const speed = rand(500, 1300) * (band === 0 ? 1.5 : 1);
              shards.push({
                points: [
                  [tip + Math.cos(angle) * inner, by + Math.sin(angle) * inner],
                  [tip + Math.cos(angle) * outer, by + Math.sin(angle) * outer],
                  [tip + Math.cos(next) * outer, by + Math.sin(next) * outer],
                  [tip + Math.cos(next) * inner, by + Math.sin(next) * inner],
                ],
                cx: tip + Math.cos(mid) * (inner + outer) / 2,
                cy: by + Math.sin(mid) * (inner + outer) / 2,
                vx: Math.cos(mid) * speed + 700, // carried on along the shot
                vy: Math.sin(mid) * speed,
                spin: rand(-6, 6),
                tumble: 0,
                lean: 0,
                grow: 0,
              });
            }
          });
          pieces = { sprite, left, top, wide, tall, shards, born: time };
        }
        if (pieces) {
          const age = time - pieces.born;
          for (const shard of pieces.shards) {
            ctx.save();
            ctx.translate(shard.cx + shard.vx * age, shard.cy + shard.vy * age + 900 * age * age);
            ctx.rotate(shard.spin * age);
            ctx.translate(-shard.cx, -shard.cy);
            ctx.beginPath();
            shard.points.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.closePath();
            ctx.clip();
            ctx.globalCompositeOperation = "source-over";
            ctx.globalAlpha = 1;
            ctx.drawImage(pieces.sprite, pieces.left, pieces.top, pieces.wide, pieces.tall);
            ctx.restore();
          }
        }
        if (p >= IMPACT && !sparks.length) {
          sparks = burst(220, tip, by, 200, 1500, ["255,220,160", "255,255,255", AMBER], 0.8);
          embers = burst(60, tip, by, 60, 500, ["255,140,70", "255,200,120"], 1.4);
        }
        if (p >= IMPACT) {
          const hit = clamp01((p - IMPACT) / 0.06);
          flash(ctx, frame, (1 - hit) * 0.9, AMBER, tip, by);
          streak(ctx, tip, by, w * 0.7 * (1 - hit * 0.5), "255,226,190", 1 - hit);
        }
        drawSparks(ctx, sparks, dt, 0.9, 700);
        drawSparks(ctx, embers, dt, 0.95, 400);
        [impactX, impactY] = [tip, by];
      }
    }

    // ── The shock cracks the lens and the frame falls apart ────────────────
    if (breaking) {
      if (!snapshot) {
        snapshot = makeCanvas();
        snapshot.width = ctx.canvas.width;
        snapshot.height = ctx.canvas.height;
        snapshot.getContext("2d")?.drawImage(ctx.canvas, 0, 0);
        const reach = Math.hypot(w, h) * 1.2;
        const angles = Array.from({ length: 18 }, (_, index) => ((index + rand(0.15, 0.85)) / 18) * TAU);
        const radii = [0, reach * 0.08, reach * 0.22, reach * 0.45, reach];
        cracks = angles.map((angle) => radii.slice(1).map((radius) => [impactX + Math.cos(angle + rand(-0.07, 0.07)) * radius, impactY + Math.sin(angle + rand(-0.07, 0.07)) * radius] as [number, number]));
        shards = [];
        angles.forEach((angle, index) => {
          const next = angles[(index + 1) % angles.length] + (index === angles.length - 1 ? TAU : 0);
          for (let band = 0; band < radii.length - 1; band++) {
            const [inner, outer] = [radii[band], radii[band + 1]];
            const mid = (angle + next) / 2;
            const distance = (inner + outer) / 2;
            const speed = rand(360, 900) * (band === 0 ? 1.6 : 1);
            shards.push({
              points: [
                [impactX + Math.cos(angle) * inner, impactY + Math.sin(angle) * inner],
                [impactX + Math.cos(angle) * outer, impactY + Math.sin(angle) * outer],
                [impactX + Math.cos(next) * outer, impactY + Math.sin(next) * outer],
                [impactX + Math.cos(next) * inner, impactY + Math.sin(next) * inner],
              ],
              cx: impactX + Math.cos(mid) * distance,
              cy: impactY + Math.sin(mid) * distance,
              vx: Math.cos(mid) * speed,
              vy: Math.sin(mid) * speed - rand(0, 220),
              spin: rand(-3, 3),
              tumble: rand(2, 7) * (Math.random() < 0.5 ? -1 : 1),
              lean: rand(0, TAU),
              grow: rand(0.2, 0.9),
            });
          }
        });
      }
      const local = (p - BREAK) / (1 - BREAK);
      const cracking = local < 0.18;
      if (cracking) {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.drawImage(snapshot, 0, 0, w, h);
        const grown = clamp01(local / 0.18);
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "#e9fffb";
        ctx.lineWidth = 1.3;
        for (const crack of cracks) {
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.moveTo(impactX, impactY);
          crack.slice(0, Math.max(1, Math.ceil(grown * crack.length))).forEach(([x, y]) => ctx.lineTo(x, y));
          ctx.stroke();
        }
      } else {
        shatterAge += dt;
        const age = shatterAge;
        // Each shard tumbles in depth: it turns edge-on, swings toward the lens and falls.
        for (const shard of shards) {
          const turn = shard.tumble * age;
          const squeeze = Math.cos(turn);
          const nearer = 1 + shard.grow * age * 2.2;
          ctx.save();
          ctx.translate(shard.cx + shard.vx * age, shard.cy + shard.vy * age + 1500 * age * age);
          ctx.rotate(shard.spin * age + shard.lean);
          ctx.scale(nearer * Math.max(0.05, Math.abs(squeeze)), nearer);
          ctx.rotate(-shard.lean);
          ctx.translate(-shard.cx, -shard.cy);
          ctx.beginPath();
          shard.points.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = Math.max(0, 1 - age * 1.5);
          ctx.save();
          ctx.clip();
          ctx.drawImage(snapshot, 0, 0, w, h);
          ctx.restore();
          // Edges flare as a shard turns through the light.
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = `rgba(205,255,248,${0.25 + 0.75 * Math.abs(Math.sin(turn))})`;
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.restore();
        }
      }
      drawSparks(ctx, sparks, dt, 0.9, 700);
    }

    look.light = inScope ? [0.22, 0.52] : [clamp01(impactX / w), clamp01(impactY / h)];
    look.wind = inFlight ? [-1.6, 0] : [0, 0];
    look.vignette = breaking ? 0 : 0.5;
    cinema(ctx, frame, look, breaking ? Math.max(0, 1 - (p - BREAK) / (1 - BREAK)) : cover);
    terminal(ctx, frame, "scope", CYAN);
  };
}
