"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { GATHER_DELAY, runSphere, type SphereControl, type SphereDensity, type SphereOptions } from "@/components/particle-sphere-engine";
import type { SphereMessage } from "@/components/particle-sphere-worker";

// The sphere is simulated and drawn in a worker on an OffscreenCanvas
// (particle-sphere-worker.ts), so its frames never hold up the page; where a
// worker can't draw, the same engine runs here. A canvas hands over its drawing
// only once, so React's dev double-mount reuses the worker it went to, and the
// worker is ended only when the canvas is really gone.
const workers = new WeakMap<HTMLCanvasElement, { worker: Worker; ending: number }>();
const canHandOver = () =>
  typeof Worker !== "undefined" &&
  typeof OffscreenCanvas !== "undefined" &&
  "transferControlToOffscreen" in HTMLCanvasElement.prototype;

function sphereOn(canvas: HTMLCanvasElement, options: SphereOptions): SphereControl {
  const held = workers.get(canvas);
  let worker = held?.worker;
  if (held) window.clearTimeout(held.ending);
  if (!worker && canHandOver()) {
    try {
      const fresh = new Worker(new URL("./particle-sphere-worker.ts", import.meta.url), { type: "module" });
      const offscreen = canvas.transferControlToOffscreen();
      fresh.postMessage({ type: "start", canvas: offscreen, options } satisfies SphereMessage, [offscreen]);
      worker = fresh;
    } catch {
      worker = undefined;
    }
  } else if (worker) worker.postMessage({ type: "start", options } satisfies SphereMessage);
  if (!worker) return runSphere(canvas, options);
  const live = worker;
  workers.set(canvas, { worker: live, ending: 0 });
  const post = (message: SphereMessage) => live.postMessage(message);
  return {
    resize: (size) => post({ type: "resize", size }),
    setTheme: (light) => post({ type: "theme", light }),
    setVisible: (visible) => post({ type: "visible", visible }),
    setGatherStart: (at) => post({ type: "gather", at }),
    pointer: (x, y) => post({ type: "pointer", x, y }),
    leave: () => post({ type: "leave" }),
    burst: (x, y) => post({ type: "burst", x, y }),
    stop() {
      post({ type: "stop" });
      const ending = window.setTimeout(() => {
        live.terminate();
        workers.delete(canvas);
      }, 1000);
      workers.set(canvas, { worker: live, ending });
    },
  };
}

export function ParticleSphere({
  className,
  density = "high",
  label = "Interactive multicolor particle sphere",
  assemble = false,
}: {
  className?: string;
  density?: SphereDensity;
  label?: string;
  assemble?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current,
      container = hostRef.current;
    if (!canvas || !container) return;
    const isLight = () => !document.documentElement.classList.contains("dark");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gathering = assemble && !reduce;
    const epoch = () => performance.timeOrigin + performance.now();
    const curtain = () =>
      container.closest(".hero-intro")?.querySelector(".hero-intro-curtain")?.getAnimations({ subtree: true }) ?? [];
    // Without a curtain the gathering is timed from now. With one it waits until
    // the curtain plays: it holds, paused, behind the intro gate (IntroGate).
    const waitForCurtain = gathering && curtain().length > 0;
    const sphere = sphereOn(canvas, {
      density,
      gathering,
      still: reduce,
      lightTheme: isLight(),
      gatherAt: waitForCurtain ? NaN : epoch() + GATHER_DELAY,
    });
    let watching = 0;
    if (waitForCurtain) {
      const watch = () => {
        const started = curtain().reduce((earliest, animation) => Math.min(earliest, Number(animation.startTime ?? Infinity)), Infinity);
        if (Number.isFinite(started)) sphere.setGatherStart(performance.timeOrigin + started + GATHER_DELAY);
        else watching = requestAnimationFrame(watch);
      };
      watching = requestAnimationFrame(watch);
    }
    const resize = new ResizeObserver(() => {
      const r = container.getBoundingClientRect();
      const w = Math.max(1, r.width),
        h = Math.max(1, r.height);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sphere.resize({ w, h, dpr: Math.min(devicePixelRatio || 1, 2) });
    });
    resize.observe(container);
    const observer = new IntersectionObserver(
      (e) => sphere.setVisible(e[0]?.isIntersecting ?? true),
      { rootMargin: "150px" },
    );
    observer.observe(container);
    const at = (e: PointerEvent) => {
      const r = container.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const move = (e: PointerEvent) => sphere.pointer(...at(e));
    const leave = () => sphere.leave();
    const burst = (e: PointerEvent) => sphere.burst(...at(e));
    container.addEventListener("pointermove", move);
    container.addEventListener("pointerdown", burst);
    container.addEventListener("pointerleave", leave);
    const onThemeChange = () => sphere.setTheme(isLight());
    window.addEventListener("themechange", onThemeChange);
    return () => {
      cancelAnimationFrame(watching);
      sphere.stop();
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
