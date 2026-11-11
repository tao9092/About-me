// Starts a Projects board (lab-board-engine.ts) in the lab board worker, which
// all the boards on a page share, or, where a worker can't draw it exactly as
// the page would (no OffscreenCanvas, or no fonts in workers), on the page.
// A canvas hands over its drawing only once, so React's dev double-mount
// restarts its board in the worker on the canvas it already has.
import { type BoardControl, type CircuitOptions, type MotherboardOptions, runCircuit, runMotherboard } from "@/components/lab-board-engine";
import type { FontSpec, LabBoardMessage } from "@/components/lab-board-worker";

export type Board = { kind: "motherboard"; options: MotherboardOptions } | { kind: "circuit"; options: CircuitOptions };

let labWorker: Promise<Worker | null> | undefined;
function getLabWorker() {
  labWorker ??= new Promise<Worker | null>((resolve) => {
    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || !("transferControlToOffscreen" in HTMLCanvasElement.prototype)) {
      resolve(null);
      return;
    }
    try {
      const worker = new Worker(new URL("./lab-board-worker.ts", import.meta.url), { type: "module" });
      const give = (usable: boolean) => {
        window.clearTimeout(timeout);
        worker.removeEventListener("message", onReady);
        if (usable) resolve(worker);
        else {
          worker.terminate();
          resolve(null);
        }
      };
      const onReady = (event: MessageEvent<{ type: string; fonts: boolean }>) => event.data?.type === "ready" && give(event.data.fonts);
      const timeout = window.setTimeout(() => give(false), 4000);
      worker.addEventListener("message", onReady);
      worker.addEventListener("error", () => give(false));
    } catch {
      resolve(null);
    }
  });
  return labWorker;
}

/** The page's @font-face rules for the families in a font stack, to load in the worker. */
function fontSpecs(stack: string): FontSpec[] {
  const families = stack.split(",").map((name) => name.trim().replace(/^['"]|['"]$/g, ""));
  const specs: FontSpec[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const style = rule.style;
      const family = style.getPropertyValue("font-family").trim().replace(/^['"]|['"]$/g, "");
      if (!families.includes(family)) continue;
      const base = sheet.href ?? location.href;
      const source = style.getPropertyValue("src").replace(/url\((['"]?)([^'")]+)\1\)/g, (_, _quote: string, url: string) => `url("${new URL(url, base).href}")`);
      const descriptors: Record<string, string> = {};
      const read = (property: string, key: keyof FontFaceDescriptors | "sizeAdjust") => {
        const value = style.getPropertyValue(property).trim();
        if (value) descriptors[key] = value;
      };
      read("font-weight", "weight");
      read("font-style", "style");
      read("font-stretch", "stretch");
      read("unicode-range", "unicodeRange");
      read("font-display", "display");
      read("font-feature-settings", "featureSettings");
      read("ascent-override", "ascentOverride");
      read("descent-override", "descentOverride");
      read("line-gap-override", "lineGapOverride");
      read("size-adjust", "sizeAdjust");
      specs.push({ family, source, descriptors: descriptors as FontFaceDescriptors });
    }
  }
  return specs;
}

const ids = new WeakMap<HTMLCanvasElement, number>();
const handedOver = new WeakSet<HTMLCanvasElement>();
let nextId = 1;

function inWorker(worker: Worker, canvas: HTMLCanvasElement, board: Board): BoardControl {
  let id = ids.get(canvas);
  if (!id) ids.set(canvas, (id = nextId++));
  const post = (message: LabBoardMessage, transfer: Transferable[] = []) => worker.postMessage(message, transfer);
  const fonts = fontSpecs(board.options.mono);
  if (handedOver.has(canvas)) post({ type: "start", id, fonts, board });
  else {
    handedOver.add(canvas);
    const offscreen = canvas.transferControlToOffscreen();
    post({ type: "start", id, canvas: offscreen, fonts, board }, [offscreen]);
  }
  const key = id;
  return {
    resize: (size) => post({ type: "resize", id: key, size }),
    setVisible: (visible) => post({ type: "visible", id: key, visible }),
    focus: (slug) => post({ type: "focus", id: key, slug }),
    hover: (on) => post({ type: "hover", id: key, on }),
    rebuild() {}, // the worker draws only once the face has loaded
    stop: () => post({ type: "stop", id: key }),
  };
}

const onPage = (canvas: HTMLCanvasElement, board: Board) => (board.kind === "motherboard" ? runMotherboard(canvas, board.options) : runCircuit(canvas, board.options));

/** A board's controls, usable at once; they act once the board has started. */
export function labBoardOn(canvas: HTMLCanvasElement, board: Board): BoardControl {
  let control: BoardControl | null = null;
  let stopped = false;
  const pending: Array<(control: BoardControl) => void> = [];
  const via = (act: (control: BoardControl) => void) => (control ? act(control) : pending.push(act));
  // A canvas already handed over can only be drawn by the worker that has it.
  void (handedOver.has(canvas) ? labWorker! : getLabWorker()).then((worker) => {
    if (stopped) return;
    control = worker ? inWorker(worker, canvas, board) : onPage(canvas, board);
    pending.splice(0).forEach((act) => act(control!));
  });
  return {
    resize: (size) => via((c) => c.resize(size)),
    setVisible: (visible) => via((c) => c.setVisible(visible)),
    focus: (slug) => via((c) => c.focus(slug)),
    hover: (on) => via((c) => c.hover(on)),
    rebuild: () => via((c) => c.rebuild()),
    stop() {
      stopped = true;
      control?.stop();
    },
  };
}
