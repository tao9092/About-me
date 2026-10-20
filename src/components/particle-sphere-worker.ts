// The sphere worker: ParticleSphere hands its canvas over as an OffscreenCanvas
// and drives it with messages, so its ~1,800 dots are simulated and drawn off the
// main thread, which a phone needs for scrolling and everything else on the page.
import { runSphere, type SphereControl, type SphereOptions, type SphereSize } from "@/components/particle-sphere-engine";

export type SphereMessage =
  // canvas is omitted when the sphere restarts on the canvas it already handed over.
  | { type: "start"; canvas?: OffscreenCanvas; options: SphereOptions }
  | { type: "resize"; size: SphereSize }
  | { type: "theme"; light: boolean }
  | { type: "visible"; visible: boolean }
  | { type: "gather"; at: number }
  | { type: "pointer"; x: number; y: number }
  | { type: "leave" }
  | { type: "burst"; x: number; y: number }
  | { type: "stop" };

let canvas: OffscreenCanvas | null = null;
let sphere: SphereControl | null = null;
self.addEventListener("message", (event: MessageEvent<SphereMessage>) => {
  const message = event.data;
  switch (message.type) {
    case "start":
      sphere?.stop();
      canvas = message.canvas ?? canvas;
      sphere = canvas ? runSphere(canvas, message.options) : null;
      break;
    case "resize":
      sphere?.resize(message.size);
      break;
    case "theme":
      sphere?.setTheme(message.light);
      break;
    case "visible":
      sphere?.setVisible(message.visible);
      break;
    case "gather":
      sphere?.setGatherStart(message.at);
      break;
    case "pointer":
      sphere?.pointer(message.x, message.y);
      break;
    case "leave":
      sphere?.leave();
      break;
    case "burst":
      sphere?.burst(message.x, message.y);
      break;
    case "stop":
      sphere?.stop();
      sphere = null;
      break;
  }
});
