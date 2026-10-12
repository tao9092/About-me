"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { FxName } from "@/components/route-fx";
import { runShutter, type ShutterControl, type ShutterSize } from "@/components/route-fx-runner";
import type { ShutterMessage } from "@/components/route-fx-worker";
import { ScrambleText } from "@/components/scramble-text";

type Phase = "idle" | "cover" | "wait" | "reveal";
export type ShutterVariant = FxName;
export type RouteTarget = {
  href: string;
  label: string;
  index: number;
  total: number;
  variant: ShutterVariant;
};

// Each destination has its own canvas effect (route-fx.ts). cover: ms until the
// screen is fully covered; reveal: ms until the effect has cleared away.
const VARIANTS: Record<ShutterVariant, { kicker: string; cover: number; reveal: number }> = {
  code: { kicker: "Compile", cover: 700, reveal: 1100 },
  scope: { kicker: "Target lock", cover: 650, reveal: 1500 },
  saturn: { kicker: "Saturn", cover: 800, reveal: 1200 },
  train: { kicker: "Express", cover: 750, reveal: 950 },
  blackhole: { kicker: "Event horizon", cover: 700, reveal: 1100 },
  vinyl: { kicker: "Now playing", cover: 760, reveal: 1100 },
};
const MIN_HOLD_MS = 240; // keep the destination readable at least this long
const GIVE_UP_MS = 8000; // reveal anyway if the route never commits

const RouteTransitionContext = createContext<(target: RouteTarget) => boolean>(() => false);

/** Returns a function that plays the shutter and navigates; false means "navigate normally". */
export function useRouteTransition() {
  return useContext(RouteTransitionContext);
}

const shutterSize = (): ShutterSize => ({ w: window.innerWidth, h: window.innerHeight, dpr: Math.min(window.devicePixelRatio || 1, 1.5) });

// The effects are drawn in a worker on an OffscreenCanvas, so the shutter keeps its
// frame rate while the new page mounts on the main thread. One worker serves every
// shutter and keeps their sprites; without OffscreenCanvas they draw here instead.
let shutterWorker: Worker | null | undefined;
function getShutterWorker() {
  if (shutterWorker !== undefined) return shutterWorker;
  shutterWorker = null;
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || !("transferControlToOffscreen" in HTMLCanvasElement.prototype)) return null;
  try {
    const worker = new Worker(new URL("./route-fx-worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("error", () => (shutterWorker = null)); // later shutters draw on the main thread
    shutterWorker = worker;
  } catch {
    shutterWorker = null;
  }
  return shutterWorker;
}
const post = (worker: Worker, message: ShutterMessage, transfer: Transferable[] = []) => worker.postMessage(message, transfer);
// A canvas hands over its drawing only once; React's dev double-mount reuses it.
const handedOver = new WeakSet<HTMLCanvasElement>();

function ShutterCanvas({ variant, phase, route }: { variant: ShutterVariant; phase: Exclude<Phase, "idle">; route: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const control = useRef<ShutterControl | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const times = { cover: VARIANTS[variant].cover, reveal: VARIANTS[variant].reveal };
    const worker = getShutterWorker();
    if (worker) {
      if (handedOver.has(canvas)) post(worker, { type: "start", variant, route, times, size: shutterSize() });
      else {
        handedOver.add(canvas);
        const offscreen = canvas.transferControlToOffscreen();
        post(worker, { type: "start", canvas: offscreen, variant, route, times, size: shutterSize() }, [offscreen]);
      }
      control.current = {
        setPhase: (next) => post(worker, { type: "phase", phase: next }),
        resize: (size) => post(worker, { type: "resize", size }),
        stop: () => post(worker, { type: "stop" }),
      };
    } else {
      control.current = runShutter(canvas, variant, route, times, shutterSize());
    }
    const resize = () => control.current?.resize(shutterSize());
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      control.current?.stop();
      control.current = null;
    };
  }, [variant, route]);

  useEffect(() => {
    if (phase !== "cover") control.current?.setPhase(phase);
  }, [phase]);

  return <canvas ref={canvasRef} className="route-fx" />;
}

// Shutter between pages: an effect covers the content, the destination decodes
// in the middle, the route is pushed while covered, and the effect breaks open
// once the new page has rendered underneath.
export function RouteTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [target, setTarget] = useState<RouteTarget | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const coveredAt = useRef(0);
  const timers = useRef<number[]>([]);

  const go = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const later = useCallback((callback: () => void, ms: number) => {
    timers.current.push(window.setTimeout(callback, ms));
  }, []);

  const reveal = useCallback(
    (variant: ShutterVariant) => {
      if (phaseRef.current !== "wait") return;
      go("reveal");
      later(() => {
        go("idle");
        setTarget(null);
      }, VARIANTS[variant].reveal);
    },
    [go, later],
  );

  const begin = useCallback(
    (next: RouteTarget) => {
      if (phaseRef.current !== "idle") return true; // ignore clicks mid-transition
      if (next.href === pathname) return false;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
      setTarget(next);
      go("cover");
      later(() => {
        coveredAt.current = performance.now();
        go("wait");
        // Jump to the top while covered. Next's own scroll would run after the
        // reveal and land the page under the sticky nav.
        window.scrollTo({ top: 0, behavior: "instant" });
        router.push(next.href, { scroll: false });
        later(() => reveal(next.variant), GIVE_UP_MS);
      }, VARIANTS[next.variant].cover);
      return true;
    },
    [go, later, pathname, reveal, router],
  );

  useEffect(() => {
    if (phase !== "wait" || !target || pathname !== target.href) return;
    let id = 0;
    // The route can commit with the loading skeleton (app/loading.tsx) first; wait
    // for the real page, keep the label up briefly, then give it two frames to paint.
    const whenReady = () => {
      if (document.querySelector('main[aria-busy="true"]')) {
        id = window.setTimeout(whenReady, 60);
        return;
      }
      const hold = Math.max(0, MIN_HOLD_MS - (performance.now() - coveredAt.current));
      id = window.setTimeout(
        () => requestAnimationFrame(() => requestAnimationFrame(() => reveal(target.variant))),
        hold,
      );
    };
    whenReady();
    return () => window.clearTimeout(id);
  }, [phase, pathname, target, reveal]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  // Once the page has settled, start the worker and let it build every effect's
  // sprites and shaders, so the first shutter doesn't stall while they're made.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setTimeout(() => {
      const worker = getShutterWorker();
      if (worker) post(worker, { type: "warm", size: shutterSize() });
    }, 2500);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <RouteTransitionContext.Provider value={begin}>
      {children}
      {target && phase !== "idle" && (
        <div className={`route-shutter v-${target.variant} is-${phase}`} aria-hidden>
          <ShutterCanvas variant={target.variant} phase={phase} route={target.href} />
          <div className="route-shutter-label">
            <small>
              {VARIANTS[target.variant].kicker} · {String(target.index + 1).padStart(2, "0")} /{" "}
              {String(target.total).padStart(2, "0")}
            </small>
            <strong>
              <ScrambleText text={target.label} delay={120} speed={30} />
            </strong>
            <i />
          </div>
        </div>
      )}
    </RouteTransitionContext.Provider>
  );
}
