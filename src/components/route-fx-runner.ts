// Plays one shutter effect on a canvas until it is stopped. The same loop runs in
// the shutter worker (route-fx-worker.ts), where the main thread mounting the new
// page cannot stall it, or on the main thread where workers can't draw.
import { createFx, type FxName, releaseFx } from "@/components/route-fx";
import { setViewport } from "@/components/route-fx-kit";

export type ShutterPhase = "cover" | "wait" | "reveal";
export type ShutterSize = { w: number; h: number; dpr: number };
export type ShutterTimes = { cover: number; reveal: number };
export type ShutterControl = { setPhase: (phase: ShutterPhase) => void; resize: (size: ShutterSize) => void; stop: () => void };

export function runShutter(canvas: HTMLCanvasElement | OffscreenCanvas, variant: FxName, route: string, times: ShutterTimes, size: ShutterSize): ShutterControl {
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
  if (!ctx) return { setPhase() {}, resize() {}, stop() {} };
  let view = size;
  const fit = () => {
    setViewport(view.w, view.h);
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
  };
  fit();
  const draw = createFx[variant]();
  let phase: ShutterPhase = "cover";
  const start = performance.now();
  let since = start;
  let last = start;
  let frame = 0;
  const loop = (now: number) => {
    const length = phase === "cover" ? times.cover : phase === "reveal" ? times.reveal : 0;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, view.w, view.h);
    draw(ctx, {
      phase,
      p: length ? Math.min(1, (now - since) / length) : 0,
      time: (now - start) / 1000,
      dt: Math.min(0.05, (now - last) / 1000),
      w: view.w,
      h: view.h,
      route,
    });
    last = now;
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  return {
    setPhase(next) {
      phase = next;
      since = performance.now();
    },
    resize(next) {
      view = next;
      fit();
    },
    stop() {
      cancelAnimationFrame(frame);
      releaseFx();
    },
  };
}
