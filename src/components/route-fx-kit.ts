// Shared toolkit for the page-shutter effects (route-fx.ts, route-fx-vinyl.ts):
// the frame contract, easing, sprites, explosions, the navigation log typed in
// the corner, and the film look every shutter is finished with. Colours are "r,g,b".

export type FxFrame = {
  phase: "cover" | "wait" | "reveal";
  /** 0 → 1 through the cover or the reveal; 0 while waiting. */
  p: number;
  /** Seconds since the shutter appeared. */
  time: number;
  /** Seconds since the previous frame. */
  dt: number;
  w: number;
  h: number;
  /** Destination path, e.g. "/competitions". */
  route: string;
};
export type Fx = (ctx: CanvasRenderingContext2D, frame: FxFrame) => void;
export type Rgb = string;

export const TAU = Math.PI * 2;
export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
export const easeIn = (t: number) => t * t * t;
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (min: number, max: number) => min + Math.random() * (max - min);
export const pick = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
// The effects run on the main thread or inside the shutter worker, so they never
// touch window or document: the viewport is handed in, and sprites are drawn on
// whichever kind of canvas this thread has.
let viewport = { w: 1440, h: 900 };
export function setViewport(w: number, h: number) {
  viewport = { w, h };
}
/** Fewer particles on small screens. */
const density = () => Math.min(1, Math.max(0.4, (viewport.w * viewport.h) / (1440 * 900)));
export const scaled = (count: number) => Math.round(count * density());
/** An offscreen surface. In the worker it is an OffscreenCanvas, which draws, scales
 * and patterns like a canvas element; the cast keeps the effect code on one type. */
export function makeCanvas(width = 300, height = 150): HTMLCanvasElement {
  if (typeof document === "undefined") return new OffscreenCanvas(width, height) as unknown as HTMLCanvasElement;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** A sprite drawn once per colour into a small canvas and stamped with drawImage. */
function spriteCache(size: number, paint: (g: CanvasRenderingContext2D, color: Rgb, size: number) => void) {
  const sprites = new Map<Rgb, HTMLCanvasElement>();
  return (color: Rgb) => {
    let sprite = sprites.get(color);
    if (!sprite) {
      sprite = makeCanvas(size, size);
      const g = sprite.getContext("2d");
      if (g) paint(g, color, size);
      sprites.set(color, sprite);
    }
    return sprite;
  };
}
// Soft round glow.
const glow = spriteCache(64, (g, color) => {
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, `rgba(${color},1)`);
  gradient.addColorStop(0.25, `rgba(${color},0.55)`);
  gradient.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
});
// An out-of-focus highlight: a soft disc with the brighter rim of a real lens.
const bokeh = spriteCache(96, (g, color) => {
  const gradient = g.createRadialGradient(48, 48, 0, 48, 48, 47);
  gradient.addColorStop(0, `rgba(${color},0.32)`);
  gradient.addColorStop(0.72, `rgba(${color},0.42)`);
  gradient.addColorStop(0.9, `rgba(${color},0.85)`);
  gradient.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gradient;
  g.beginPath();
  g.arc(48, 48, 47, 0, TAU);
  g.fill();
});
export function dot(ctx: CanvasRenderingContext2D, color: Rgb, x: number, y: number, size: number, alpha: number) {
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(glow(color), x - size / 2, y - size / 2, size, size);
}
/** A light far out of focus. */
export function defocused(ctx: CanvasRenderingContext2D, color: Rgb, x: number, y: number, size: number, alpha: number) {
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(bokeh(color), x - size / 2, y - size / 2, size, size);
}

export function shake(ctx: CanvasRenderingContext2D, amount: number) {
  if (amount > 0.2) ctx.translate(rand(-amount, amount), rand(-amount, amount));
}

export type Star = { x: number; y: number; size: number; alpha: number; twinkle: number };
export function starfield(count: number): Star[] {
  return Array.from({ length: scaled(count) }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: rand(0.6, 1.9),
    alpha: rand(0.25, 0.9),
    twinkle: rand(1, 4),
  }));
}

/** Deep space backdrop: gradient, two nebulae and twinkling stars. */
export function space(ctx: CanvasRenderingContext2D, frame: FxFrame, alpha: number, tint: Rgb, stars: Star[]) {
  if (alpha <= 0) return;
  const { w, h, time } = frame;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = alpha;
  const base = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
  base.addColorStop(0, "#08142a");
  base.addColorStop(1, "#010309");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  for (const [x, y, color, strength] of [
    [0.28, 0.32, tint, 0.17],
    [0.76, 0.72, "110,80,255", 0.12],
  ] as const) {
    const nebula = ctx.createRadialGradient(w * x, h * y, 0, w * x, h * y, Math.max(w, h) * 0.55);
    nebula.addColorStop(0, `rgba(${color},${strength})`);
    nebula.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = "#ffffff";
  for (const star of stars) {
    ctx.globalAlpha = alpha * star.alpha * (0.65 + 0.35 * Math.sin(time * star.twinkle + star.x * 40));
    ctx.fillRect(star.x * w, star.y * h, star.size, star.size);
  }
}

/** Clears a soft-edged circle so the page underneath shows through. */
export function hole(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, feather: number) {
  if (radius <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.globalAlpha = 1;
  const gradient = ctx.createRadialGradient(x, y, Math.max(0, radius - feather), x, y, radius);
  gradient.addColorStop(0, "rgba(0,0,0,1)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** A glowing circle: wide faint strokes under a sharp one. */
export function ring(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: Rgb, alpha: number, width: number) {
  if (radius <= 0 || alpha <= 0) return;
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgb(${color})`;
  for (const [spread, strength] of [[7, 0.1], [2.6, 0.32], [1, 1]] as const) {
    ctx.globalAlpha = alpha * strength;
    ctx.lineWidth = width * spread;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.stroke();
  }
}

export function flash(ctx: CanvasRenderingContext2D, frame: FxFrame, alpha: number, color: Rgb, x = frame.w / 2, y = frame.h / 2) {
  if (alpha <= 0) return;
  const { w, h } = frame;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.hypot(w, h) * 0.6);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, `rgba(${color},0.75)`);
  gradient.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

/** The shared finale: flash, shock rings and a hole blasting open from the centre. */
export function detonate(ctx: CanvasRenderingContext2D, frame: FxFrame, color: Rgb) {
  const { w, h, p } = frame;
  const reach = (Math.hypot(w, h) / 2 + 80) * easeOut(p);
  hole(ctx, w / 2, h / 2, reach * 0.94, 110);
  ring(ctx, w / 2, h / 2, reach, color, 1 - p, 5);
  ring(ctx, w / 2, h / 2, reach * 0.66, "255,255,255", (1 - p) * 0.55, 2.5);
  flash(ctx, frame, Math.max(0, 1 - p / 0.2), color);
}

export type Spark = { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; color: Rgb; glyph?: string };
export function burst(count: number, x: number, y: number, minSpeed: number, maxSpeed: number, colors: Rgb[], life: number, glyphs?: string): Spark[] {
  return Array.from({ length: scaled(count) }, () => {
    const angle = rand(0, TAU);
    const speed = rand(minSpeed, maxSpeed);
    return {
      x: x + Math.cos(angle) * rand(0, 30),
      y: y + Math.sin(angle) * rand(0, 30),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: rand(life * 0.6, life),
      size: rand(1, 3.2),
      color: pick(colors),
      glyph: glyphs ? pick([...glyphs]) : undefined,
    };
  });
}
export function drawSparks(ctx: CanvasRenderingContext2D, sparks: Spark[], dt: number, drag: number, gravity = 0) {
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  const decay = drag ** (dt * 60);
  for (const spark of sparks) {
    spark.age += dt;
    if (spark.age >= spark.life) continue;
    spark.vx *= decay;
    spark.vy = spark.vy * decay + gravity * dt;
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    const fade = 1 - spark.age / spark.life;
    if (spark.glyph) {
      ctx.globalAlpha = fade;
      ctx.fillStyle = `rgb(${spark.color})`;
      ctx.fillText(spark.glyph, spark.x, spark.y);
      continue;
    }
    ctx.globalAlpha = fade * 0.9;
    ctx.strokeStyle = `rgb(${spark.color})`;
    ctx.lineWidth = spark.size * 0.7;
    ctx.beginPath();
    ctx.moveTo(spark.x, spark.y);
    ctx.lineTo(spark.x - spark.vx * 0.035, spark.y - spark.vy * 0.035);
    ctx.stroke();
    dot(ctx, spark.color, spark.x, spark.y, spark.size * 7, fade);
  }
}

// A navigation log typed in the corner of every shutter.
const SPINNER = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
export function terminal(ctx: CanvasRenderingContext2D, frame: FxFrame, effect: string, color: Rgb) {
  const { phase, p, time, h, route } = frame;
  const name = route.replace(/^\//, "") || "home";
  const component = `${name[0].toUpperCase()}${name.slice(1)}Page`;
  const done = phase === "reveal";
  const lines = [
    `$ next navigate ${route}`,
    `  ✓ prefetch   ${name}.rsc  ${12 + name.length * 3}ms`,
    `  ✓ compile    <${component} />`,
    done ? "  ✓ hydrate    200 OK" : `  ${SPINNER[Math.floor(time * 12) % SPINNER.length]} hydrate    streaming…`,
    done ? `$ fx --${effect} --reveal` : "",
  ];
  let budget = time * 150; // characters typed so far
  const size = Math.max(10, Math.min(12, frame.w / 110));
  // On a phone the title card takes the foot of the frame, so the log runs
  // from the top instead, under the nav bar.
  const narrow = frame.w < 700;
  ctx.font = `${size}px ${MONO}`;
  ctx.globalCompositeOperation = "source-over";
  const alpha = done ? 1 - easeIn(p) : 1;
  lines.forEach((line, index) => {
    if (budget <= 0 || !line) return;
    const text = line.slice(0, Math.floor(budget));
    budget -= line.length;
    const y = narrow ? 92 + index * (size + 6) : h - 26 - (lines.length - 1 - index) * (size + 6);
    ctx.globalAlpha = 0.9 * alpha;
    ctx.fillStyle = line.startsWith("$") ? "#ffffff" : `rgb(${color})`;
    ctx.fillText(text, 24, y);
    if (budget <= 0 && Math.floor(time * 3) % 2 === 0) ctx.fillRect(24 + ctx.measureText(text).width + 2, y - size + 2, size * 0.55, size);
  });
}

// ── Film look ───────────────────────────────────────────────────────────────
// Every shutter is finished like a shot from the same film: lens diffusion,
// haze around the key light, dust drifting through it with out-of-focus
// bokeh in front of the lens, a warm grade, vignette and grain at 24 fps.

/** A four-point lens star, like a sparkle of sunlight on glass. */
export function glint(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: Rgb, alpha: number, angle = 0) {
  if (alpha <= 0 || size <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha;
  for (const [length, thickness] of [
    [size, size * 0.03],
    [size * 0.45, size * 0.022],
  ] as const) {
    for (let spike = 0; spike < 2; spike++) {
      const gradient = ctx.createLinearGradient(-length, 0, length, 0);
      gradient.addColorStop(0, `rgba(${color},0)`);
      gradient.addColorStop(0.5, `rgba(${color},1)`);
      gradient.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(-length, 0);
      ctx.lineTo(0, -thickness);
      ctx.lineTo(length, 0);
      ctx.lineTo(0, thickness);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(Math.PI / 2);
    }
    ctx.rotate(Math.PI / 4);
  }
  ctx.restore();
  dot(ctx, color, x, y, size * 0.4, alpha);
}

/** An anamorphic flare: a thin horizontal streak through a bright source. */
export function streak(ctx: CanvasRenderingContext2D, x: number, y: number, length: number, color: Rgb, alpha: number) {
  if (alpha <= 0 || length <= 0) return;
  ctx.globalCompositeOperation = "lighter";
  const gradient = ctx.createLinearGradient(x - length, 0, x + length, 0);
  gradient.addColorStop(0, `rgba(${color},0)`);
  gradient.addColorStop(0.5, `rgba(${color},1)`);
  gradient.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = gradient;
  ctx.globalAlpha = alpha;
  ctx.fillRect(x - length, y - 1.2, length * 2, 2.4);
  ctx.globalAlpha = alpha * 0.25;
  ctx.fillRect(x - length * 0.7, y - 7, length * 1.4, 14);
}

export type Mote = { x: number; y: number; z: number; vx: number; vy: number; seed: number };
/** Dust hanging in the light: most motes are tiny and far, a few drift right past the lens. */
export function motes(count: number): Mote[] {
  return Array.from({ length: scaled(count) }, () => ({
    x: Math.random(),
    y: Math.random(),
    z: Math.random() ** 2,
    vx: rand(-0.012, 0.012),
    vy: rand(-0.02, 0.006),
    seed: rand(0, TAU),
  }));
}

export type Look = {
  /** Colour of the haze, the dust and the grade. */
  tint: Rgb;
  /** Key light, in fractions of the screen: the haze gathers there and dust near it lights up. */
  light: [number, number];
  /** Lens diffusion, 0–1. */
  bloom: number;
  /** Haze around the key light, 0–1. */
  haze: number;
  dust: Mote[];
  /** Steady drift added to the dust, in screens per second. */
  wind?: [number, number];
  /** Shock pushing the dust away from a point, in pixels per second. */
  blast?: { x: number; y: number; force: number };
  vignette?: number;
  grain?: number;
};

// Lens diffusion: the frame is shrunk twice and screened back over itself, so
// highlights bleed into soft halos.
const BLOOM_STEPS = [4, 12];
const bloomLayers: HTMLCanvasElement[] = [];
function bloom(ctx: CanvasRenderingContext2D, strength: number) {
  if (strength <= 0) return;
  const source = ctx.canvas;
  let previous: HTMLCanvasElement = source;
  for (let index = 0; index < BLOOM_STEPS.length; index++) {
    const layer = (bloomLayers[index] ??= makeCanvas());
    const width = Math.max(1, Math.round(source.width / BLOOM_STEPS[index]));
    const height = Math.max(1, Math.round(source.height / BLOOM_STEPS[index]));
    if (layer.width !== width || layer.height !== height) {
      layer.width = width;
      layer.height = height;
    }
    const g = layer.getContext("2d");
    if (!g) return;
    g.globalCompositeOperation = "copy";
    g.imageSmoothingQuality = "high";
    g.drawImage(previous, 0, 0, width, height);
    previous = layer;
  }
  // Fold the wider halo into the smaller copy, so only one full-size pass is needed.
  const near = bloomLayers[0].getContext("2d");
  if (!near) return;
  near.globalCompositeOperation = "screen";
  near.drawImage(bloomLayers[1], 0, 0, bloomLayers[0].width, bloomLayers[0].height);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = strength * 0.65;
  ctx.drawImage(bloomLayers[0], 0, 0, source.width, source.height);
  ctx.restore();
}
export function releaseFilmLook() {
  for (const layer of bloomLayers) layer.width = layer.height = 0;
}

// Film grain: a few tiles of black and white specks, swapped 24 times a second.
const GRAIN = 256;
let grainTiles: HTMLCanvasElement[] = [];
const grainPatterns = new WeakMap<CanvasRenderingContext2D, (CanvasPattern | null)[]>();
function grainPattern(ctx: CanvasRenderingContext2D, index: number) {
  if (!grainTiles.length) {
    grainTiles = Array.from({ length: 4 }, () => {
      const tile = makeCanvas(GRAIN, GRAIN);
      const g = tile.getContext("2d");
      if (g) {
        const image = g.createImageData(GRAIN, GRAIN);
        for (let i = 0; i < image.data.length; i += 4) {
          const value = Math.random() < 0.5 ? 0 : 255;
          image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
          image.data[i + 3] = Math.random() ** 2 * 90;
        }
        g.putImageData(image, 0, 0);
      }
      return tile;
    });
  }
  let patterns = grainPatterns.get(ctx);
  if (!patterns) {
    patterns = grainTiles.map((tile) => ctx.createPattern(tile, "repeat"));
    grainPatterns.set(ctx, patterns);
  }
  return patterns[index % patterns.length];
}

function drawMotes(ctx: CanvasRenderingContext2D, frame: FxFrame, look: Look, amount: number, lightX: number, lightY: number) {
  const { w, h, dt, time } = frame;
  const [windX, windY] = look.wind ?? [0, 0];
  const reach = Math.max(w, h) * 0.5;
  ctx.globalCompositeOperation = "lighter";
  for (const mote of look.dust) {
    const depth = 0.35 + mote.z * 1.9; // near motes cross the frame faster
    mote.x += (mote.vx + windX + Math.sin(time * 0.5 + mote.seed) * 0.004) * depth * dt;
    mote.y += (mote.vy + windY + Math.cos(time * 0.4 + mote.seed * 1.7) * 0.003) * depth * dt;
    if (look.blast) {
      const dx = mote.x * w - look.blast.x;
      const dy = mote.y * h - look.blast.y;
      const distance = Math.hypot(dx, dy) + 60;
      mote.x += (dx / distance) * ((look.blast.force * depth * dt) / w);
      mote.y += (dy / distance) * ((look.blast.force * depth * dt) / h);
    }
    if (mote.x < -0.06) mote.x += 1.12;
    else if (mote.x > 1.06) mote.x -= 1.12;
    if (mote.y < -0.06) mote.y += 1.12;
    else if (mote.y > 1.06) mote.y -= 1.12;
    const x = mote.x * w;
    const y = mote.y * h;
    const lit = Math.exp(-((x - lightX) ** 2 + (y - lightY) ** 2) / (2 * reach * reach));
    if (mote.z > 0.8) {
      // Right in front of the lens: a big soft disc.
      const size = 26 + ((mote.z - 0.8) / 0.2) * 74;
      ctx.globalAlpha = amount * (0.035 + 0.12 * lit);
      ctx.drawImage(bokeh(look.tint), x - size / 2, y - size / 2, size, size);
    } else {
      const size = 2.4 + mote.z * 8;
      const twinkle = 0.55 + 0.45 * Math.sin(time * (1.2 + mote.z * 2.5) + mote.seed * 5);
      ctx.globalAlpha = amount * (0.1 + 0.75 * lit) * twinkle;
      ctx.drawImage(glow(look.tint), x - size / 2, y - size / 2, size, size);
    }
  }
}

/** Finishes a frame: call it after the effect has drawn, before the corner log. */
export function cinema(ctx: CanvasRenderingContext2D, frame: FxFrame, look: Look, amount: number) {
  const { w, h, time } = frame;
  ctx.setTransform(ctx.canvas.width / w, 0, 0, ctx.canvas.width / w, 0, 0); // drop any shake
  if (amount <= 0) return;
  bloom(ctx, look.bloom * amount);
  const lightX = look.light[0] * w;
  const lightY = look.light[1] * h;
  if (look.haze > 0) {
    const haze = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, Math.max(w, h) * 0.9);
    haze.addColorStop(0, `rgba(${look.tint},${look.haze * amount})`);
    haze.addColorStop(0.35, `rgba(${look.tint},${look.haze * amount * 0.3})`);
    haze.addColorStop(1, `rgba(${look.tint},0)`);
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 1;
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h);
  }
  drawMotes(ctx, frame, look, amount, lightX, lightY);

  // Grade, vignette and grain only touch what the effect has drawn, so they
  // never stain the page while it is being revealed.
  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha = 1;
  const grade = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  grade.addColorStop(0, `rgba(${look.tint},0.05)`);
  grade.addColorStop(1, `rgba(0,0,0,${look.vignette ?? 0.6})`);
  ctx.fillStyle = grade;
  ctx.fillRect(0, 0, w, h);
  const filmFrame = Math.floor(time * 24);
  const pattern = grainPattern(ctx, filmFrame);
  if (pattern) {
    const offsetX = (filmFrame * 97) % GRAIN;
    const offsetY = (filmFrame * 61) % GRAIN;
    ctx.globalAlpha = look.grain ?? 0.3;
    ctx.fillStyle = pattern;
    ctx.translate(-offsetX, -offsetY);
    ctx.fillRect(offsetX, offsetY, w, h);
    ctx.translate(offsetX, offsetY);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}
