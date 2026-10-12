// Canvas effects for the page shutters (route-transition.tsx). An effect draws one
// frame at a time: it covers the page during "cover", keeps playing during
// "wait", and during "reveal" breaks open so the new page shows through. Each
// lives in its own module, built on the toolkit (route-fx-kit.ts) and, for the
// scenes, the 3D helpers (route-fx-3d.ts); every one is finished with the
// shared film look.
import { releaseStage } from "@/components/route-fx-3d";
import { blackhole } from "@/components/route-fx-blackhole";
import { cassini } from "@/components/route-fx-cassini";
import { circuit } from "@/components/route-fx-circuit";
import { gargantua } from "@/components/route-fx-gargantua";
import { releaseShaders } from "@/components/route-fx-gl";
import { type Fx, makeCanvas, releaseFilmLook, setViewport } from "@/components/route-fx-kit";
import { rail } from "@/components/route-fx-rail";
import { range, releaseRange } from "@/components/route-fx-range";
import { saturn } from "@/components/route-fx-saturn";
import { vinyl } from "@/components/route-fx-vinyl";

export type FxName = "code" | "scope" | "saturn" | "train" | "blackhole" | "vinyl";

export const createFx: Record<FxName, () => Fx> = {
  code: circuit, // Projects: a circuit board powers up; the camera dives into the die
  scope: range, // Competitions: down the scope, bullet time, the lens shatters
  saturn: () => cassini(saturn), // Certificates: a ray-traced Saturn eclipses the sun (flat without WebGL)
  train: rail, // Experience: the night express, a year in every window
  blackhole: () => gargantua(blackhole), // Index: a ray-traced black hole (flat without WebGL)
  vinyl, // Home: a record plays; the camera dives through the spindle hole
};

/** Frees the frame-sized buffers once a shutter has finished; sprites that the
 * next shutter can reuse (Saturn's globe and rings, the die, the label) stay. */
export function releaseFx() {
  releaseFilmLook();
  releaseStage();
  releaseRange();
  releaseShaders();
}

/** Draws one frame of every effect on a scratch surface, so their sprites and the
 * black hole's shader are ready before the first shutter. Meant for the worker. */
export function warmFx(size: { w: number; h: number; dpr: number }) {
  setViewport(size.w, size.h);
  const ctx = makeCanvas(Math.round(size.w * size.dpr), Math.round(size.h * size.dpr)).getContext("2d");
  if (!ctx) return;
  for (const create of Object.values(createFx)) {
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    create()(ctx, { phase: "wait", p: 0, time: 0, dt: 1 / 60, w: size.w, h: size.h, route: "/" });
  }
  releaseFx();
}
