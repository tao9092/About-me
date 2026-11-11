// The lab board worker: the Projects page's boards (lab-board.ts) hand their
// canvases over as OffscreenCanvases and are drawn here, all of them in one
// worker, so their frames never take the page's thread. The boards' labels are
// set in the page's mono face, so its @font-face rules come along and are
// loaded here before a board is first drawn.
import { type BoardControl, type BoardSize, type CircuitOptions, type MotherboardOptions, runCircuit, runMotherboard } from "@/components/lab-board-engine";

export type FontSpec = { family: string; source: string; descriptors: FontFaceDescriptors };
export type LabBoardMessage =
  // canvas is omitted when a board restarts on the canvas it already handed over.
  | { type: "start"; id: number; canvas?: OffscreenCanvas; fonts: FontSpec[]; board: { kind: "motherboard"; options: MotherboardOptions } | { kind: "circuit"; options: CircuitOptions } }
  | { type: "resize"; id: number; size: BoardSize }
  | { type: "visible"; id: number; visible: boolean }
  | { type: "focus"; id: number; slug: string | null }
  | { type: "hover"; id: number; on: boolean }
  | { type: "stop"; id: number };

const canvases = new Map<number, OffscreenCanvas>();
const boards = new Map<number, BoardControl>();
// Messages for a board whose fonts are still loading wait their turn.
const waiting = new Map<number, LabBoardMessage[]>();
const starts = new Map<number, number>(); // the latest start of each board
const faces = new Map<string, Promise<void>>();
const fontSet = (self as unknown as { fonts?: FontFaceSet }).fonts;
// The page hands boards over only once the worker says it can load their face.
self.postMessage({ type: "ready", fonts: Boolean(fontSet) && typeof FontFace !== "undefined" });

function loadFonts(specs: FontSpec[]) {
  return Promise.all(
    specs.map((spec) => {
      const key = JSON.stringify(spec);
      let loading = faces.get(key);
      if (!loading) {
        const face = new FontFace(spec.family, spec.source, spec.descriptors);
        fontSet!.add(face);
        loading = face.load().then(
          () => {},
          () => {},
        );
        faces.set(key, loading);
      }
      return loading;
    }),
  );
}

function apply(message: LabBoardMessage) {
  const board = boards.get(message.id);
  if (message.type === "resize") board?.resize(message.size);
  else if (message.type === "visible") board?.setVisible(message.visible);
  else if (message.type === "focus") board?.focus(message.slug);
  else if (message.type === "hover") board?.hover(message.on);
}

self.addEventListener("message", (event: MessageEvent<LabBoardMessage>) => {
  const message = event.data;
  if (message.type === "start") {
    boards.get(message.id)?.stop();
    boards.delete(message.id);
    if (message.canvas) canvases.set(message.id, message.canvas);
    const canvas = canvases.get(message.id);
    if (!canvas) return;
    waiting.set(message.id, []);
    const turn = (starts.get(message.id) ?? 0) + 1;
    starts.set(message.id, turn);
    void loadFonts(message.fonts).then(() => {
      const queued = waiting.get(message.id);
      if (!queued || starts.get(message.id) !== turn) return; // stopped or restarted while its fonts loaded
      waiting.delete(message.id);
      const { board } = message;
      boards.set(message.id, board.kind === "motherboard" ? runMotherboard(canvas, board.options) : runCircuit(canvas, board.options));
      queued.forEach(apply);
    });
  } else if (message.type === "stop") {
    waiting.delete(message.id);
    starts.set(message.id, (starts.get(message.id) ?? 0) + 1);
    boards.get(message.id)?.stop();
    boards.delete(message.id);
  } else if (waiting.has(message.id)) waiting.get(message.id)!.push(message);
  else apply(message);
});
