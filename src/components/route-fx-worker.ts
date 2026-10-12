// The shutter worker: route-transition.tsx hands each shutter's canvas over as an
// OffscreenCanvas and drives it with messages, so the effect keeps its frame rate
// while the main thread is busy mounting the page underneath. Between shutters it
// prepares every effect's sprites, so even the first one starts cleanly.
import { type FxName, warmFx } from "@/components/route-fx";
import { runShutter, type ShutterControl, type ShutterPhase, type ShutterSize, type ShutterTimes } from "@/components/route-fx-runner";

export type ShutterMessage =
  // canvas is omitted when a shutter restarts on the canvas it already handed over.
  | { type: "start"; canvas?: OffscreenCanvas; variant: FxName; route: string; times: ShutterTimes; size: ShutterSize }
  | { type: "phase"; phase: ShutterPhase }
  | { type: "resize"; size: ShutterSize }
  | { type: "stop" }
  | { type: "warm"; size: ShutterSize }
  // The visitor scrolled, tapped or typed: warming waits for them to pause.
  | { type: "activity" };

let canvas: OffscreenCanvas | null = null;
let current: ShutterControl | null = null;
let warming: Promise<void> | null = null;
let lastActivity = -Infinity;
const QUIET_MS = 1200;
// An effect warms only while no shutter plays and the visitor has been still a
// moment: warming takes the GPU briefly, which would catch a scroll or a tap.
const quietTurn = () =>
  new Promise<void>((resolve) => {
    const check = () => (current === null && performance.now() - lastActivity > QUIET_MS ? resolve() : setTimeout(check, 200));
    setTimeout(check, 150);
  });
self.addEventListener("message", (event: MessageEvent<ShutterMessage>) => {
  const message = event.data;
  if (message.type === "start") {
    current?.stop();
    canvas = message.canvas ?? canvas;
    current = canvas ? runShutter(canvas, message.variant, message.route, message.times, message.size) : null;
  } else if (message.type === "phase") current?.setPhase(message.phase);
  else if (message.type === "resize") current?.resize(message.size);
  else if (message.type === "stop") {
    current?.stop();
    current = null;
  } else if (message.type === "activity") lastActivity = performance.now();
  else if (message.type === "warm") warming ??= warmFx(message.size, quietTurn);
});
