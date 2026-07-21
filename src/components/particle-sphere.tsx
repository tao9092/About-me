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

export function ParticleSphere({
  className,
  density = "high",
  label = "Interactive multicolor particle sphere",
}: {
  className?: string;
  density?: "high" | "medium" | "low";
  label?: string;
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
    const pointer = { x: -9999, y: -9999, active: false, power: 0 };
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const counts = { high: 1050, medium: 480, low: 250 };
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
        count = Math.min(
          counts[density],
          Math.round((w * h) / (density === "high" ? 180 : 260)),
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
      paint(true);
    }
    function paint(still = false) {
      context.clearRect(0, 0, w, h);
      const cx = w / 2,
        cy = h / 2,
        unit = Math.min(w, h),
        rot = still ? 0 : time * 0.00015,
        c = Math.cos(rot),
        s = Math.sin(rot);
      for (const p of points) {
        const tx = cx + p.hx * c - p.z * unit * 0.16 * s,
          ty = cy + p.hy,
          rz = (p.hx / unit) * s + p.z * c;
        if (!still) {
          const dx = p.x - pointer.x,
            dy = p.y - pointer.y,
            dist = Math.hypot(dx, dy) || 1,
            range = unit * 0.42;
          if (pointer.active && dist < range) {
            const f = (1 - dist / range) * pointer.power,
              swirl = f * 0.34;
            p.vx += (dx / dist) * f + (dy / dist) * swirl;
            p.vy += (dy / dist) * f - (dx / dist) * swirl;
            p.energy = Math.min(1, p.energy + f * 0.045);
          }
          p.vx += (tx - p.x) * 0.017;
          p.vy += (ty - p.y) * 0.017;
          p.vx *= 0.908;
          p.vy *= 0.908;
          p.x += p.vx;
          p.y += p.vy;
          p.energy *= 0.955;
        } else {
          p.x = tx;
          p.y = ty;
        }
        const speed = Math.min(1, Math.hypot(p.vx, p.vy) / 5),
          colorIndex =
            p.energy > 0.18
              ? Math.min(
                  palette.length - 1,
                  Math.floor(p.energy * (palette.length - 1)),
                )
              : p.color;
        const col = palette[colorIndex],
          alpha = Math.min(0.96, 0.3 + (rz + 1) * 0.25 + p.energy * 0.35),
          radius = p.size * (0.75 + (rz + 1) * 0.23 + speed * 0.65);
        context.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
        context.beginPath();
        context.arc(p.x, p.y, Math.max(0.5, radius), 0, Math.PI * 2);
        context.fill();
        if ((p.energy > 0.38 || rz > 0.72) && radius > 1) {
          context.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha * 0.1})`;
          context.beginPath();
          context.arc(p.x, p.y, radius * 4, 0, Math.PI * 2);
          context.fill();
        }
      }
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
    };
  }, [density]);
  return (
    <div
      ref={hostRef}
      className={cn("particle-sphere", className)}
      role="img"
      aria-label={label}
    >
      <canvas ref={canvasRef} />
      <span className="particle-hint" aria-hidden>
        Move to disrupt · Click to burst
      </span>
    </div>
  );
}
