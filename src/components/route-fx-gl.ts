// Full-screen fragment shaders on their own WebGL canvases, drawn into a shutter
// with drawImage: the ray-traced scenes (route-fx-gargantua.ts, route-fx-cassini.ts).
// Each shader is compiled once and kept, so later shutters start at once.
import { makeCanvas } from "@/components/route-fx-kit";

const VERTEX = "attribute vec2 corner; void main() { gl_Position = vec4(corner, 0.0, 1.0); }";

export type Shader = { canvas: HTMLCanvasElement; gl: WebGLRenderingContext; uniforms: Record<string, WebGLUniformLocation | null> };
const shaders = new Map<string, Shader | null>(); // null: this shader can't run here

/** The compiled shader by name, or null where WebGL (or the shader) is unavailable. */
export function shader(name: string, fragment: string, uniformNames: string[]): Shader | null {
  const cached = shaders.get(name);
  if (cached && cached.gl.isContextLost()) shaders.delete(name); // the GPU was reset: build it again
  else if (cached !== undefined) return cached;
  const built = build(fragment, uniformNames);
  shaders.set(name, built);
  return built;
}
function build(fragment: string, uniformNames: string[]): Shader | null {
  const canvas = makeCanvas(2, 2);
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, premultipliedAlpha: false });
  if (!gl) return null;
  const compile = (type: number, source: string) => {
    const part = gl.createShader(type);
    if (!part) return null;
    gl.shaderSource(part, source);
    gl.compileShader(part);
    return gl.getShaderParameter(part, gl.COMPILE_STATUS) ? part : null;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const pixels = compile(gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram();
  if (!vertex || !pixels || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, pixels);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  // One triangle that covers the whole viewport.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program, "corner");
  gl.enableVertexAttribArray(corner);
  gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
  return { canvas, gl, uniforms: Object.fromEntries(uniformNames.map((name) => [name, gl.getUniformLocation(program, name)])) };
}
/** Renders a shader at the given size; set fills in its uniforms. */
export function render(target: Shader, width: number, height: number, set: (gl: WebGLRenderingContext, uniforms: Shader["uniforms"]) => void) {
  const { canvas, gl, uniforms } = target;
  if (canvas.width !== width || canvas.height !== height) [canvas.width, canvas.height] = [width, height];
  gl.viewport(0, 0, width, height);
  gl.uniform2f(uniforms.resolution, width, height);
  set(gl, uniforms);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return canvas;
}
/** Shrinks the shader canvases between shutters; the compiled programs stay. */
export function releaseShaders() {
  for (const target of shaders.values()) if (target) target.canvas.width = target.canvas.height = 1;
}
