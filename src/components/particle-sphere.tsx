"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hx: number;
  hy: number;
  z: number;
  size: number;
  phase: number;
  energy: number;
  color: number;
};
const palette = [
  [92, 255, 225],
  [68, 215, 255],
  [121, 139, 255],
  [202, 121, 255],
  [255, 133, 203],
  [255, 220, 112],
] as const;

// Opening for `assemble`: particles start scattered and are pulled into the
// sphere as the hero curtain opens. The curtain is a CSS animation that starts
// with the first paint, so the gathering is timed from that animation's start
// rather than from hydration.
const GATHER_DELAY = 700;
const GATHER_DURATION = 1400;

export function ParticleSphere({
  className,
  density = "high",
  label = "Interactive multicolor particle sphere",
  assemble = false,
}: {
  className?: string;
  density?: "high" | "medium" | "low";
  label?: string;
  assemble?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current,
      host = hostRef.current;
    if (!canvas || !host) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const surface: HTMLCanvasElement = canvas;
    const container: HTMLDivElement = host;
    const context: CanvasRenderingContext2D = ctx;
    let points: Particle[] = [],
      raf = 0,
      w = 1,
      h = 1,
      dpr = 1,
      time = 0,
      visible = true,
      alive = true;
    let lightTheme = !document.documentElement.classList.contains("dark");
    const pointer = { x: -9999, y: -9999, active: false, power: 0 };
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let gathering = assemble && !reduce;
    const introStart = container
      .closest(".hero-intro")
      ?.querySelector(".hero-intro-curtain")
      ?.getAnimations({ subtree: true })
      .reduce((earliest, animation) => Math.min(earliest, Number(animation.startTime ?? Infinity)), Infinity);
    const gatherStart =
      (introStart !== undefined && Number.isFinite(introStart) ? introStart : performance.now()) + GATHER_DELAY;
    const counts = { high: 1800, medium: 720, low: 360 };
    // Each frame the dots are grouped by colour and opacity, and every group is
    // filled in one call instead of one call per dot. The canvas stores colours
    // at 8 bits a channel, so taking the opacity to the nearest 1/255 leaves the
    // picture as it was; it only turns ~1,800 fills into a few dozen.
    const inks = [...palette, [24, 44, 68] as const];
    const LIGHT_INK = palette.length;
    const styles: string[] = [];
    const style = (key: number) =>
      (styles[key] ??= `rgba(${inks[key >> 8].join(",")},${(key & 255) / 255})`);
    const coreCounts = new Int32Array(inks.length * 256);
    const glowCounts = new Int32Array(inks.length * 256);
    let px = new Float32Array(0),
      py = new Float32Array(0),
      pr = new Float32Array(0),
      coreKeys = new Int32Array(0),
      glowKeys = new Int32Array(0),
      order = new Int32Array(0);
    function fillGroups(keys: Int32Array, groups: Int32Array, grow: number) {
      let total = 0;
      for (let key = 0; key < groups.length; key += 1) {
        const size = groups[key];
        groups[key] = total;
        total += size;
      }
      for (let index = 0; index < keys.length; index += 1) {
        const key = keys[index];
        if (key >= 0) order[groups[key]++] = index;
      }
      let start = 0;
      for (let key = 0; key < groups.length; key += 1) {
        const end = groups[key];
        if (end === start) continue;
        context.fillStyle = style(key);
        context.beginPath();
        for (let at = start; at < end; at += 1) {
          const index = order[at],
            radius = pr[index] * grow;
          context.moveTo(px[index] + radius, py[index]);
          context.arc(px[index], py[index], radius, 0, Math.PI * 2);
        }
        context.fill();
        start = end;
      }
    }
    function rebuild() {
      const r = container.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      dpr = Math.min(devicePixelRatio || 1, 2);
      surface.width = Math.round(w * dpr);
      surface.height = Math.round(h * dpr);
      surface.style.width = `${w}px`;
      surface.style.height = `${h}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const radius = Math.min(w, h) * 0.4,
        activeDensity = lightTheme ? "high" : density,
        count = Math.min(
          counts[activeDensity],
          Math.round((w * h) / (activeDensity === "high" ? 115 : 230)),
        ),
        golden = Math.PI * (3 - Math.sqrt(5));
      points = Array.from({ length: count }, (_, i) => {
        const yy = 1 - (i / Math.max(1, count - 1)) * 2,
          rr = Math.sqrt(Math.max(0, 1 - yy * yy)),
          a = golden * i,
          xx = Math.cos(a) * rr,
          zz = Math.sin(a) * rr;
        return {
          x: w / 2 + xx * radius,
          y: h / 2 + yy * radius,
          vx: 0,
          vy: 0,
          hx: xx * radius,
          hy: yy * radius,
          z: zz,
          size: 0.55 + Math.random() * 1.05,
          phase: Math.random() * 6.28,
          energy: 0,
          color: i % palette.length,
        };
      });
      px = new Float32Array(count);
      py = new Float32Array(count);
      pr = new Float32Array(count);
      coreKeys = new Int32Array(count);
      glowKeys = new Int32Array(count);
      order = new Int32Array(count);
      if (gathering) {
        const reach = Math.hypot(w, h) * 0.75;
        for (const p of points) {
          const angle = Math.random() * Math.PI * 2,
            distance = reach * (0.55 + Math.random() * 0.6);
          p.x = w / 2 + Math.cos(angle) * distance;
          p.y = h / 2 + Math.sin(angle) * distance;
          p.energy = 0.6 + Math.random() * 0.4;
        }
        context.clearRect(0, 0, w, h);
        return;
      }
      paint(true);
    }
    // Spring strength: eases up from a gentle pull while the sphere gathers,
    // then the formed sphere flashes its palette (with the CSS shockwave).
    function pull(now: number) {
      if (!gathering) return 0.017;
      if (now < gatherStart) return 0;
      const t = Math.min(1, (now - gatherStart) / GATHER_DURATION);
      if (t >= 1) {
        gathering = false;
        for (const p of points) p.energy = Math.max(p.energy, 0.55 + Math.random() * 0.4);
      }
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      return 0.0025 + 0.0145 * eased;
    }
    function paint(still = false) {
      context.clearRect(0, 0, w, h);
      const cx = w / 2,
        cy = h / 2,
        unit = Math.min(w, h),
        rot = still ? 0 : time * 0.00015,
        c = Math.cos(rot),
        s = Math.sin(rot),
        k = still ? 0 : pull(performance.now());
      coreCounts.fill(0);
      glowCounts.fill(0);
      for (let index = 0; index < points.length; index += 1) {
        const p = points[index];
        const tx = cx + p.hx * c - p.z * unit * 0.16 * s,
          ty = cy + p.hy,
          rz = (p.hx / unit) * s + p.z * c;
        if (!still) {
          const dx = p.x - pointer.x,
            dy = p.y - pointer.y,
            dist = Math.sqrt(dx * dx + dy * dy) || 1,
            range = unit * 0.42;
          if (pointer.active && dist < range) {
            const f = (1 - dist / range) * pointer.power,
              swirl = f * 0.34;
            p.vx += (dx / dist) * f + (dy / dist) * swirl;
            p.vy += (dy / dist) * f - (dx / dist) * swirl;
            p.energy = Math.min(1, p.energy + f * 0.045);
          }
          p.vx += (tx - p.x) * k;
          p.vy += (ty - p.y) * k;
          p.vx *= 0.908;
          p.vy *= 0.908;
          p.x += p.vx;
          p.y += p.vy;
          p.energy *= 0.955;
        } else {
          p.x = tx;
          p.y = ty;
        }
        const speed = Math.min(1, Math.sqrt(p.vx * p.vx + p.vy * p.vy) / 5),
          colorIndex = lightTheme
            ? LIGHT_INK
            : p.energy > 0.18
              ? Math.min(
                  palette.length - 1,
                  Math.floor(p.energy * (palette.length - 1)),
                )
              : p.color;
        const alpha = Math.min(0.96, 0.3 + (rz + 1) * 0.25 + p.energy * 0.35),
          radius = p.size * (0.75 + (rz + 1) * 0.23 + speed * 0.65);
        px[index] = p.x;
        py[index] = p.y;
        pr[index] = Math.max(0.5, radius);
        const core = colorIndex * 256 + Math.round(alpha * 255);
        coreKeys[index] = core;
        coreCounts[core] += 1;
        // A faint halo around the bright and near-side dots.
        if ((p.energy > 0.38 || rz > 0.72) && radius > 1) {
          const glow = colorIndex * 256 + Math.round(alpha * 0.1 * 255);
          glowKeys[index] = glow;
          glowCounts[glow] += 1;
        } else {
          glowKeys[index] = -1;
        }
      }
      fillGroups(coreKeys, coreCounts, 1);
      fillGroups(glowKeys, glowCounts, 4);
    }
    function loop(t: number) {
      time = t;
      pointer.power +=
        (pointer.active ? 4.8 - pointer.power : -pointer.power) * 0.12;
      if (visible) paint();
      if (alive) raf = requestAnimationFrame(loop);
    }
    function locate(e: PointerEvent) {
      const r = container.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.active = true;
    }
    function move(e: PointerEvent) {
      locate(e);
    }
    function leave() {
      pointer.active = false;
    }
    function burst(e: PointerEvent) {
      locate(e);
      pointer.power = 22;
      const max = Math.min(w, h) * 0.62;
      for (const p of points) {
        const dx = p.x - pointer.x,
          dy = p.y - pointer.y,
          d = Math.hypot(dx, dy) || 1;
        if (d < max) {
          const f = (1 - d / max) * 17;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
          p.energy = 1;
        }
      }
    }
    const resize = new ResizeObserver(rebuild);
    resize.observe(container);
    const observer = new IntersectionObserver(
      (e) => (visible = e[0]?.isIntersecting ?? true),
      { rootMargin: "150px" },
    );
    observer.observe(container);
    container.addEventListener("pointermove", move);
    container.addEventListener("pointerdown", burst);
    container.addEventListener("pointerleave", leave);
    const onThemeChange = () => {
      lightTheme = !document.documentElement.classList.contains("dark");
      rebuild();
    };
    window.addEventListener("themechange", onThemeChange);
    rebuild();
    if (!reduce) raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      resize.disconnect();
      observer.disconnect();
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerdown", burst);
      container.removeEventListener("pointerleave", leave);
      window.removeEventListener("themechange", onThemeChange);
    };
  }, [density, assemble]);
  return (
    <div
      ref={hostRef}
      className={cn("particle-sphere", className)}
      role="img"
      aria-label={label}
    >
      <canvas ref={canvasRef} />
      <span className="particle-hint" aria-hidden>
        <span className="hint-mouse">Move to disrupt · Click to burst</span>
        <span className="hint-touch">Swipe across to disrupt · Tap to burst</span>
      </span>
    </div>
  );
}
