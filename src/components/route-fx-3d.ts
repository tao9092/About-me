// A small 3D toolkit for the shutters that are scenes rather than overlays
// (route-fx-*.ts): vectors, a pinhole camera, lit boxes, tubes and wires, and a
// depth of field built from an offscreen copy of the scene. y is up.
import { lerp, makeCanvas } from "@/components/route-fx-kit";

export type Vec3 = [number, number, number];
export const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul3 = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const unit3 = (a: Vec3): Vec3 => mul3(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
export const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** Turns a vector about the vertical axis. */
export const turn3 = (a: Vec3, angle: number): Vec3 => {
  const [c, s] = [Math.cos(angle), Math.sin(angle)];
  return [a[0] * c + a[2] * s, a[1], -a[0] * s + a[2] * c];
};

export type Camera = { eye: Vec3; right: Vec3; up: Vec3; forward: Vec3; focal: number; cx: number; cy: number; near: number };
/** A camera at eye looking at target; fov spans the shorter side of the screen, in
 * radians: vertical on a landscape screen, across on a portrait one, so a phone
 * held upright sees as wide a shot as a desktop rather than a narrow slice of it. */
export function aim(eye: Vec3, target: Vec3, upHint: Vec3, fov: number, w: number, h: number, near = 0.03): Camera {
  const forward = unit3(sub3(target, eye));
  const right = unit3(cross3(forward, upHint));
  return { eye, right, up: cross3(right, forward), forward, focal: Math.min(w, h) / 2 / Math.tan(fov / 2), cx: w / 2, cy: h / 2, near };
}
/** Camera space: x right, y up, z depth. */
export function toView(cam: Camera, point: Vec3): Vec3 {
  const d = sub3(point, cam.eye);
  return [dot3(d, cam.right), dot3(d, cam.up), dot3(d, cam.forward)];
}
export function toScreen(cam: Camera, view: Vec3): [number, number] {
  return [cam.cx + (cam.focal * view[0]) / view[2], cam.cy - (cam.focal * view[1]) / view[2]];
}
export function project(cam: Camera, point: Vec3) {
  const view = toView(cam, point);
  return view[2] < cam.near ? null : toScreen(cam, view);
}
/** On-screen size of a length at a point, or 0 behind the camera. */
export function sizeAt(cam: Camera, point: Vec3, length: number) {
  const depth = toView(cam, point)[2];
  return depth < cam.near ? 0 : (cam.focal * length) / depth;
}
/** Where a segment crosses the near plane, in camera space. */
export function clipNear(cam: Camera, inside: Vec3, outside: Vec3): Vec3 {
  const t = (inside[2] - cam.near) / (inside[2] - outside[2]);
  return [lerp(inside[0], outside[0], t), lerp(inside[1], outside[1], t), cam.near];
}
/** Adds a flat polygon to a fresh path, clipped to what is in front of the camera. */
export function polygonPath(ctx: CanvasRenderingContext2D, cam: Camera, points: Vec3[]) {
  const views = points.map((point) => toView(cam, point));
  const clipped: Vec3[] = [];
  views.forEach((a, index) => {
    const b = views[(index + 1) % views.length];
    if (a[2] >= cam.near) clipped.push(a);
    if (a[2] >= cam.near !== b[2] >= cam.near) clipped.push(a[2] >= cam.near ? clipNear(cam, a, b) : clipNear(cam, b, a));
  });
  if (clipped.length < 3) return false;
  ctx.beginPath();
  clipped.forEach((view, index) => {
    const [x, y] = toScreen(cam, view);
    if (index) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.closePath();
  return true;
}
/** Maps the unit square of a sprite onto a small flat patch: an affine stand-in for
 * perspective. Patches nearer than minDepth are refused, where the stand-in breaks down. */
export function patchTransform(ctx: CanvasRenderingContext2D, cam: Camera, origin: Vec3, across: Vec3, down: Vec3, minDepth = 0) {
  if ([origin, add3(origin, across), add3(origin, down)].some((point) => toView(cam, point)[2] < Math.max(cam.near, minDepth))) return false;
  const o = project(cam, origin);
  const a = project(cam, add3(origin, across));
  const b = project(cam, add3(origin, down));
  if (!o || !a || !b) return false;
  ctx.transform(a[0] - o[0], a[1] - o[1], b[0] - o[0], b[1] - o[1], o[0], o[1]);
  return true;
}

// Materials lit by one key light: a base colour and how tight the highlight is.
export type Finish = { color: Vec3; shine: number };
export type Light = { dir: Vec3; color: Vec3; highlight: string };
export function shadeOf(normal: Vec3, toEye: Vec3, finish: Finish, light: Light, gain = 1) {
  const diffuse = Math.max(0, dot3(normal, light.dir));
  const specular = Math.max(0, dot3(normal, unit3(add3(light.dir, toEye)))) ** finish.shine * gain;
  const lit = (0.16 + 0.95 * diffuse) * gain;
  const [r, g, b] = finish.color;
  const [sr, sg, sb] = light.color;
  return `rgb(${Math.min(255, r * lit + sr * specular)},${Math.min(255, g * lit + sg * specular)},${Math.min(255, b * lit + sb * specular)})`;
}
/** A lit box from its centre, three unit axes and the half sizes along them.
 * Small parts can skip the per-face gradients and bevels (detailed = false). */
export function box(ctx: CanvasRenderingContext2D, cam: Camera, center: Vec3, axes: [Vec3, Vec3, Vec3], half: Vec3, finish: Finish, light: Light, detailed = true) {
  for (let axis = 0; axis < 3; axis++) {
    for (const sign of [1, -1]) {
      const normal = mul3(axes[axis], sign);
      const middle = add3(center, mul3(normal, half[axis]));
      const toEye = unit3(sub3(cam.eye, middle));
      if (dot3(normal, toEye) <= 0) continue; // faces turned away are hidden
      const [a, b] = [(axis + 1) % 3, (axis + 2) % 3];
      const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]].flatMap(([i, j]) => {
        const point = project(cam, add3(middle, add3(mul3(axes[a], half[a] * i), mul3(axes[b], half[b] * j))));
        return point ? [point] : [];
      });
      if (corners.length < 4) continue;
      ctx.beginPath();
      corners.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      if (!detailed) {
        ctx.fillStyle = shadeOf(normal, toEye, finish, light);
        ctx.fill();
        continue;
      }
      // Brighter towards the top of each face, so it reads as metal rather than paint.
      const ys = corners.map(([, y]) => y);
      const sheen = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
      sheen.addColorStop(0, shadeOf(normal, toEye, finish, light, 1.4));
      sheen.addColorStop(1, shadeOf(normal, toEye, finish, light, 0.7));
      ctx.fillStyle = sheen;
      ctx.fill();
      if (normal[1] > 0.5) {
        // A bright bevel on the top faces.
        ctx.strokeStyle = `rgba(${light.color.join(",")},0.4)`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
  }
}
/** A lit cylinder between two points, clipped to the near plane and shaded across its width. */
export function tube(ctx: CanvasRenderingContext2D, cam: Camera, from: Vec3, to: Vec3, radius: number, finish: Finish, light: Light, pieces = 8) {
  let a = toView(cam, from);
  let b = toView(cam, to);
  if (a[2] < cam.near && b[2] < cam.near) return;
  if (a[2] < cam.near) a = clipNear(cam, b, a);
  if (b[2] < cam.near) b = clipNear(cam, a, b);
  const toEye = unit3(sub3(cam.eye, to));
  const top = shadeOf([0, 1, 0], toEye, finish, light);
  const lit = shadeOf(unit3([0.3, 1, -0.3]), toEye, finish, light);
  for (let piece = 0; piece < pieces; piece++) {
    const near = mix3(a, b, piece / pieces);
    const far = mix3(a, b, Math.min(1, (piece + 1.05) / pieces)); // a hair of overlap hides the seams
    const [x0, y0] = toScreen(cam, near);
    const [x1, y1] = toScreen(cam, far);
    const r0 = (cam.focal * radius) / near[2];
    const r1 = (cam.focal * radius) / far[2];
    const length = Math.hypot(x1 - x0, y1 - y0) || 1;
    // Unit normal pointing up the screen, towards the light.
    const flip = x1 - x0 < 0 ? -1 : 1;
    const nx = ((y1 - y0) / length) * flip;
    const ny = (-(x1 - x0) / length) * flip;
    ctx.beginPath();
    ctx.moveTo(x0 + nx * r0, y0 + ny * r0);
    ctx.lineTo(x1 + nx * r1, y1 + ny * r1);
    ctx.lineTo(x1 - nx * r1, y1 - ny * r1);
    ctx.lineTo(x0 - nx * r0, y0 - ny * r0);
    ctx.closePath();
    const [xm, ym, rm] = [(x0 + x1) / 2, (y0 + y1) / 2, (r0 + r1) / 2];
    const shading = ctx.createLinearGradient(xm + nx * rm, ym + ny * rm, xm - nx * rm, ym - ny * rm);
    // Polished: a crisp highlight near the lit edge, falling off into shadow.
    shading.addColorStop(0, top);
    shading.addColorStop(0.13, lit);
    shading.addColorStop(0.2, light.highlight);
    shading.addColorStop(0.28, lit);
    shading.addColorStop(0.55, top);
    shading.addColorStop(1, "rgb(10,8,7)");
    ctx.fillStyle = shading;
    ctx.fill();
  }
}
/** A thin wire through some points, as wide as it is near. */
export function wire(ctx: CanvasRenderingContext2D, cam: Camera, points: Vec3[], radius: number, color: string, shine: string) {
  const projected = points.map((point) => [toView(cam, point), project(cam, point)] as const);
  ctx.lineCap = "round";
  for (const [style, scale] of [[color, 1], [shine, 0.4]] as const) {
    ctx.strokeStyle = style;
    for (let k = 1; k < projected.length; k++) {
      const [view, start] = projected[k - 1];
      const end = projected[k][1];
      if (!start || !end) continue;
      ctx.lineWidth = Math.max(0.6, ((cam.focal * radius) / view[2]) * 2 * scale);
      ctx.beginPath();
      ctx.moveTo(start[0], start[1] - (scale < 1 ? ctx.lineWidth : 0));
      ctx.lineTo(end[0], end[1] - (scale < 1 ? ctx.lineWidth : 0));
      ctx.stroke();
    }
  }
}

// ── Depth of field ──────────────────────────────────────────────────────────
// A scene is drawn sharp into an offscreen layer, then composited as a blurred
// copy everywhere with the sharp one only inside an elliptical patch in focus.
const layers: Record<"scene" | "small" | "tiny", HTMLCanvasElement | null> = { scene: null, small: null, tiny: null };
function layer(name: keyof typeof layers, width: number, height: number) {
  const canvas = (layers[name] ??= makeCanvas());
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return canvas;
}
export function releaseStage() {
  for (const canvas of Object.values(layers)) if (canvas) canvas.width = canvas.height = 0;
}
/** The offscreen layer a scene is drawn into, sized like the frame, in CSS pixels. */
export function stage(ctx: CanvasRenderingContext2D, w: number) {
  const dpr = ctx.canvas.width / w;
  const g = layer("scene", ctx.canvas.width, ctx.canvas.height).getContext("2d");
  if (!g) return null;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;
  return g;
}
export type Focus = { x: number; y: number; rx: number; ry: number };
/** Composites the stage onto the frame, blurred outside the focus (null: all sharp). */
export function develop(ctx: CanvasRenderingContext2D, w: number, h: number, focus: Focus | null, alpha: number) {
  const scene = layers.scene;
  if (!scene || alpha <= 0) return;
  const dpr = ctx.canvas.width / w;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = alpha;
  if (focus) {
    const small = layer("small", Math.max(1, Math.round(scene.width / 4)), Math.max(1, Math.round(scene.height / 4)));
    const tiny = layer("tiny", Math.max(1, Math.round(scene.width / 12)), Math.max(1, Math.round(scene.height / 12)));
    // "copy" replaces the last frame's blur, which would otherwise linger wherever the scene is clear.
    for (const [to, from] of [[small, scene], [tiny, small]]) {
      const g = to.getContext("2d");
      if (!g) continue;
      g.globalCompositeOperation = "copy";
      g.drawImage(from, 0, 0, to.width, to.height);
    }
    ctx.drawImage(tiny, 0, 0, scene.width, scene.height);
    ctx.globalAlpha = alpha * 0.45;
    ctx.drawImage(small, 0, 0, scene.width, scene.height);
    const s = scene.getContext("2d");
    if (s) {
      s.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.translate(focus.x, focus.y);
      s.scale(focus.rx / focus.ry, 1);
      const mask = s.createRadialGradient(0, 0, focus.ry * 0.6, 0, 0, focus.ry * 1.6);
      mask.addColorStop(0, "rgba(0,0,0,1)");
      mask.addColorStop(1, "rgba(0,0,0,0)");
      s.globalCompositeOperation = "destination-in";
      s.globalAlpha = 1;
      s.fillStyle = mask;
      s.fillRect(-w * 4, -h * 4, w * 8, h * 8);
    }
    ctx.globalAlpha = alpha;
  }
  ctx.drawImage(scene, 0, 0);
  ctx.restore();
}
/** How sharp a point is under a focus patch, 0–1 (the same falloff as the mask). */
export function sharpness(focus: Focus | null, x: number, y: number) {
  if (!focus) return 1;
  return Math.min(1, Math.max(0, 1.6 - Math.hypot((x - focus.x) / focus.rx, (y - focus.y) / focus.ry)));
}
