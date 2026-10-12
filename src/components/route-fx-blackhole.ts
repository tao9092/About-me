import {
  burst,
  cinema,
  clamp01,
  detonate,
  dot,
  drawSparks,
  easeIn,
  easeInOut,
  easeOut,
  type Fx,
  type Look,
  MONO,
  motes,
  rand,
  type Rgb,
  ring,
  scaled,
  shake,
  type Spark,
  streak,
  TAU,
  terminal,
} from "@/components/route-fx-kit";

// ── Index, where WebGL is unavailable: a black hole with a lensed accretion
// disk drawn flat, which collapses and bursts back out as a white hole ──────────────────────────────────────────
const SECTIONS = ["Projects", "Competitions", "Certificates", "Experience", "Index"];
/** Disk colour by distance from the hole, in shadow radii: white-hot inside, red outside. */
function diskColor(radius: number): Rgb {
  if (radius < 3.2) return "255,240,205";
  if (radius < 4.4) return "255,198,120";
  if (radius < 5.8) return "255,150,70";
  return "214,84,40";
}
export function blackhole(): Fx {
  const stars = Array.from({ length: scaled(460) }, () => ({ angle: rand(0, TAU), distance: rand(0.04, 1.3), size: rand(0.6, 1.8), alpha: rand(0.3, 1) }));
  const matter = Array.from({ length: scaled(900) }, () => ({ angle: rand(0, TAU), radius: rand(2.5, 7.6), size: rand(0.7, 2.2) }));
  const orbit = SECTIONS.map((label, index) => ({ label, angle: (index / SECTIONS.length) * TAU }));
  const tilt = 0.16; // the disk is seen almost edge-on
  let sparks: Spark[] = [];
  const look: Look = { tint: "255,178,110", light: [0.5, 0.42], bloom: 0.85, haze: 0.1, dust: motes(45), vignette: 0.55 };
  return (ctx, frame) => {
    const { phase, p, dt, w, h, time } = frame;
    const cover = phase === "cover" ? easeInOut(p) : 1;
    const form = phase === "cover" ? easeOut(p) : 1;
    const collapse = phase === "reveal" ? easeIn(clamp01(p / 0.3)) : 0;
    const open = phase === "reveal" ? clamp01((p - 0.3) / 0.7) : 0;
    const fade = 1 - open;
    if (open > 0) shake(ctx, 18 * (1 - clamp01(open / 0.35)));
    const cx = w / 2;
    const cy = h * 0.42;
    const span = Math.hypot(w, h) / 2;
    // The shadow is about a third of the height and its lensed halo about 60%;
    // the disk runs off both edges.
    const shadow = Math.max(0.5, Math.min(h * 0.17, w * 0.1) * form * (1 - collapse * 0.85));
    const squeeze = (1 + 0.8 * (1 - form)) * (1 - collapse * 0.85); // matter spirals in as it forms and when it collapses

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = cover;
    ctx.fillStyle = "#010103";
    ctx.fillRect(0, 0, w, h);

    // Background stars swirl around the hole and are lensed into an Einstein ring.
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = ctx.strokeStyle = "#ffffff";
    const einstein = shadow * 2.6;
    for (const star of stars) {
      star.angle += (dt * 0.08 * (1 + collapse * 14)) / (star.distance + 0.15);
      if (collapse > 0) star.distance = Math.max(0.02, star.distance - dt * collapse * 1.4);
      const r = Math.max(1, star.distance * span);
      const lensed = r + (einstein * einstein) / r;
      const smear = Math.min(46, ((einstein * einstein) / (r * r)) * 18);
      ctx.globalAlpha = star.alpha * cover * fade;
      if (smear > 1.5) {
        ctx.lineWidth = star.size;
        ctx.beginPath();
        ctx.arc(cx, cy, lensed, star.angle - smear / lensed, star.angle + smear / lensed);
        ctx.stroke();
      } else {
        ctx.fillRect(cx + Math.cos(star.angle) * lensed, cy + Math.sin(star.angle) * lensed, star.size, star.size);
      }
    }

    // Accretion disk bands. The left side swings towards us, so it is brighter.
    const drawDisk = (half: "back" | "front") => {
      const [start, end] = half === "back" ? [Math.PI, TAU] : [0, Math.PI];
      // Flat ends, or the half-ellipses leave beads where the halves meet.
      ctx.lineCap = "butt";
      for (let r = 2.6; r <= 7.6; r += 0.24) {
        const radius = r * shadow * squeeze;
        const color = diskColor(r);
        const strength = (1 - (r - 2.6) / 5.4) * 0.3 * cover * fade;
        const doppler = ctx.createLinearGradient(cx - radius, 0, cx + radius, 0);
        doppler.addColorStop(0, `rgba(${color},${Math.min(1, strength * 1.6)})`);
        doppler.addColorStop(1, `rgba(${color},${strength * 0.4})`);
        ctx.strokeStyle = doppler;
        ctx.lineWidth = shadow * 0.2;
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius, radius * tilt, 0, start, end);
        ctx.stroke();
      }
      ctx.lineCap = "round";
      for (const clump of matter) {
        const sin = Math.sin(clump.angle);
        if (sin < 0 !== (half === "back")) continue;
        const radius = clump.radius * shadow * squeeze;
        const sweep = 0.06 + 0.2 / clump.radius;
        ctx.globalAlpha = (0.35 + 0.65 * (1 - (clump.radius - 2.5) / 5.1)) * (1 - 0.45 * Math.cos(clump.angle)) * cover * fade;
        ctx.strokeStyle = `rgb(${diskColor(clump.radius)})`;
        ctx.lineWidth = clump.size;
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius, radius * tilt, 0, clump.angle - sweep, clump.angle);
        ctx.stroke();
      }
    };
    for (const clump of matter) clump.angle += dt * 2.4 * (3 / clump.radius) ** 1.5 * (1 + collapse * 6);

    ctx.globalCompositeOperation = "lighter";
    drawDisk("back");
    // The far side of the disk, bent over and under the hole by its gravity.
    ctx.lineCap = "butt";
    for (let k = 0; k < 9; k++) {
      const radius = shadow * (1.1 + k * 0.08) * squeeze;
      const strength = (1 - k / 9) * 0.32 * cover * fade;
      ctx.strokeStyle = `rgb(${diskColor(2.8 + k * 0.4)})`;
      ctx.lineWidth = shadow * 0.09;
      ctx.globalAlpha = strength;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, Math.PI, TAU);
      ctx.stroke();
      ctx.globalAlpha = strength * 0.45;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI);
      ctx.stroke();
    }
    // Orbiting sections behind the hole.
    const orbitX = w * 0.46;
    const drawOrbit = (behind: boolean) => {
      ctx.font = `600 11px ${MONO}`;
      ctx.textAlign = "center";
      for (const body of orbit) {
        const ox = cx + Math.cos(body.angle) * orbitX * squeeze;
        const oy = cy + Math.sin(body.angle) * orbitX * 0.3 * squeeze;
        if (Math.sin(body.angle) < 0 !== behind) continue;
        if (behind && Math.hypot(ox - cx, oy - cy) < shadow * 1.05) continue;
        const near = behind ? 0.45 : 1;
        dot(ctx, "255,214,160", ox, oy, 22 * near, cover * fade);
        ctx.globalAlpha = 0.8 * near * cover * fade * form;
        ctx.fillStyle = "#ffe2bd";
        ctx.fillText(body.label.toUpperCase(), ox, oy - 14);
      }
      ctx.textAlign = "start";
    };
    for (const body of orbit) body.angle += dt * 0.35;
    drawOrbit(true);

    // The event horizon and its photon ring.
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = cover;
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(cx, cy, shadow, 0, TAU);
    ctx.fill();
    ring(ctx, cx, cy, shadow * 1.03, "255,232,190", (0.75 + 0.25 * Math.sin(time * 9)) * cover * fade, 1.4);

    ctx.globalCompositeOperation = "lighter";
    drawDisk("front");
    drawOrbit(false);
    // As it collapses the core turns white-hot before bursting.
    if (collapse > 0) {
      dot(ctx, "255,250,240", cx, cy, shadow * 6 * collapse + 10, collapse * fade);
      streak(ctx, cx, cy, w * 0.55 * collapse, "255,222,186", collapse * fade);
    }

    if (open > 0) {
      if (!sparks.length) sparks = burst(360, cx, cy, 300, 1800, ["255,232,190", "255,170,90", "255,255,255", "200,170,255"], 1);
      detonate(ctx, { ...frame, p: open }, "255,214,160");
      drawSparks(ctx, sparks, dt, 0.93);
    }
    look.light = [cx / w, cy / h];
    look.blast = open > 0 ? { x: cx, y: cy, force: 1600 * (1 - open) } : undefined;
    cinema(ctx, frame, look, cover * (1 - open));
    terminal(ctx, frame, "blackhole", "255,194,122");
  };
}
