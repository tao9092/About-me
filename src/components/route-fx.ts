// Canvas effects for the page shutters (route-transition.tsx). An effect draws one
// frame at a time: it covers the page during "cover", keeps playing during
// "wait", and during "reveal" breaks open so the new page shows through. Each
// lives in its own module, built on the toolkit (route-fx-kit.ts) and, for the
// scenes, the 3D helpers (route-fx-3d.ts); every one is finished with the
// shared film look.
import { releaseStage } from "@/components/route-fx-3d";
import { blackhole } from "@/components/route-fx-blackhole";
import { circuit } from "@/components/route-fx-circuit";
import { gargantua, prepareGargantua } from "@/components/route-fx-gargantua";
import { releaseShaders } from "@/components/route-fx-gl";
import { type Fx, makeCanvas, releaseFilmLook, setViewport } from "@/components/route-fx-kit";
import { rail } from "@/components/route-fx-rail";
import { range, releaseRange } from "@/components/route-fx-range";
import { prepareReentry, reentry } from "@/components/route-fx-reentry";
import { vinyl } from "@/components/route-fx-vinyl";

export type FxName = "code" | "scope" | "saturn" | "train" | "blackhole" | "vinyl";

export const createFx: Record<FxName, () => Fx> = {
  code: circuit, // Projects: a circuit board powers up; the camera dives into the die
  scope: range, // Competitions: down the scope, bullet time, the lens shatters
  saturn: reentry, // Certificates: burning re-entry over a ray-traced Earth; a porthole opens on the page
  train: rail, // Experience: the night express, a year in every window
  blackhole: () => gargantua(blackhole), // Index: a ray-traced black hole (flat without WebGL)
  vinyl, // Home: a record plays; the camera dives through the spindle hole
};

/** Frees the frame-sized buffers once a shutter has finished; sprites that the
 * next shutter can reuse (the die, the label) stay. */
export function releaseFx() {
  releaseFilmLook();
  releaseStage();
  releaseRange();
  releaseShaders();
}

/** Gets every effect ready before its first shutter: the ray-traced shaders
 * compile in the background, then each effect draws one frame on a scratch
 * surface to build its sprites. Building them keeps the GPU busy for a moment, so
 * each effect waits its turn (when nothing else needs the GPU). Meant for the
 * worker. */
export async function warmFx(size: { w: number; h: number; dpr: number }, turn: () => Promise<void>) {
  await turn();
  await Promise.all([prepareReentry(), prepareGargantua()]);
  const ctx = makeCanvas(Math.round(size.w * size.dpr), Math.round(size.h * size.dpr)).getContext("2d");
  if (!ctx) return;
  for (const create of Object.values(createFx)) {
    await turn();
    setViewport(size.w, size.h);
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    create()(ctx, { phase: "wait", p: 0, time: 0, dt: 1 / 60, w: size.w, h: size.h, route: "/" });
  }
  releaseFx();
}
