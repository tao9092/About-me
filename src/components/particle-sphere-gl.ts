// Draws the particle sphere's dots with WebGL (particle-sphere-engine.ts). The 2D
// canvas filled them as paths of hundreds of arcs, which the GPU has to break
// down shape by shape: the sphere alone kept a phone's GPU busy for most of
// every frame, so scrolling and everything else on the page stuttered. Here each
// dot is one instance of a square whose fragment shader covers the same circle
// with the same edge antialiasing, blended source-over in the same order, so
// the picture is the one the 2D canvas drew.

export type DotRenderer = {
  /** Room for this many dots per frame. */
  reserve: (count: number) => void;
  /** Starts a frame: the dots added next replace the last frame's. */
  begin: () => void;
  /** One dot, in CSS pixels, with straight (not premultiplied) colour 0..1. */
  add: (x: number, y: number, radius: number, r: number, g: number, b: number, a: number) => void;
  /** Clears the surface and draws the frame's dots. */
  draw: (dpr: number) => void;
};

const VERTEX = `#version 300 es
in vec2 corner;
in vec4 dot;   // x, y, radius (CSS px), unused
in vec4 color; // straight rgba
uniform vec2 size; // drawing buffer, device px
uniform float dpr;
out vec2 local;
out float radius;
out vec4 tint;
void main() {
  radius = dot.z * dpr;
  // One device pixel of margin so the antialiased edge is never cut off.
  local = corner * (radius + 1.0);
  vec2 at = dot.xy * dpr + local;
  gl_Position = vec4(at / size * 2.0 - 1.0, 0.0, 1.0);
  gl_Position.y = -gl_Position.y;
  tint = color;
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 local;
in float radius;
in vec4 tint;
out vec4 outColor;
void main() {
  // Coverage of the pixel by the circle's edge, as the 2D canvas antialiases it.
  float cover = clamp(radius - length(local) + 0.5, 0.0, 1.0) * tint.a;
  outColor = vec4(tint.rgb * cover, cover);
}`;

const FLOATS = 8; // per dot: x, y, radius, 0, r, g, b, a

export function createDotRenderer(surface: HTMLCanvasElement | OffscreenCanvas): DotRenderer | null {
  const gl = surface.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
  }) as WebGL2RenderingContext | null;
  if (!gl) return null;

  let program: WebGLProgram | null = null;
  let instances: WebGLBuffer | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let sizeAt: WebGLUniformLocation | null = null;
  let dprAt: WebGLUniformLocation | null = null;

  function setup() {
    const shader = (type: number, source: string) => {
      const made = gl!.createShader(type)!;
      gl!.shaderSource(made, source);
      gl!.compileShader(made);
      return made;
    };
    const linked = gl!.createProgram()!;
    gl!.attachShader(linked, shader(gl!.VERTEX_SHADER, VERTEX));
    gl!.attachShader(linked, shader(gl!.FRAGMENT_SHADER, FRAGMENT));
    gl!.linkProgram(linked);
    if (!gl!.getProgramParameter(linked, gl!.LINK_STATUS)) return false;
    program = linked;
    gl!.useProgram(program);
    vao = gl!.createVertexArray();
    gl!.bindVertexArray(vao);
    const corners = gl!.createBuffer();
    gl!.bindBuffer(gl!.ARRAY_BUFFER, corners);
    gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl!.STATIC_DRAW);
    const corner = gl!.getAttribLocation(program, "corner");
    gl!.enableVertexAttribArray(corner);
    gl!.vertexAttribPointer(corner, 2, gl!.FLOAT, false, 0, 0);
    instances = gl!.createBuffer();
    gl!.bindBuffer(gl!.ARRAY_BUFFER, instances);
    const dot = gl!.getAttribLocation(program, "dot");
    const color = gl!.getAttribLocation(program, "color");
    gl!.enableVertexAttribArray(dot);
    gl!.vertexAttribPointer(dot, 4, gl!.FLOAT, false, FLOATS * 4, 0);
    gl!.vertexAttribDivisor(dot, 1);
    gl!.enableVertexAttribArray(color);
    gl!.vertexAttribPointer(color, 4, gl!.FLOAT, false, FLOATS * 4, 16);
    gl!.vertexAttribDivisor(color, 1);
    sizeAt = gl!.getUniformLocation(program, "size");
    dprAt = gl!.getUniformLocation(program, "dpr");
    // Source-over on premultiplied colour, as the 2D canvas composites.
    gl!.enable(gl!.BLEND);
    gl!.blendFunc(gl!.ONE, gl!.ONE_MINUS_SRC_ALPHA);
    return true;
  }
  if (!setup()) return null;
  // A lost context (the GPU was reset) comes back empty: build it again.
  surface.addEventListener("webglcontextlost", (event) => event.preventDefault());
  surface.addEventListener("webglcontextrestored", () => void setup());

  let data = new Float32Array(0);
  let count = 0;
  return {
    reserve(dots) {
      if (data.length < dots * FLOATS) data = new Float32Array(dots * FLOATS);
    },
    begin() {
      count = 0;
    },
    add(x, y, radius, r, g, b, a) {
      const at = count * FLOATS;
      if (at + FLOATS > data.length) return;
      data[at] = x;
      data[at + 1] = y;
      data[at + 2] = radius;
      data[at + 4] = r;
      data[at + 5] = g;
      data[at + 6] = b;
      data[at + 7] = a;
      count += 1;
    },
    draw(dpr) {
      if (gl.isContextLost() || !program) return;
      gl.viewport(0, 0, surface.width, surface.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (count === 0) return;
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(sizeAt, surface.width, surface.height);
      gl.uniform1f(dprAt, dpr);
      gl.bindBuffer(gl.ARRAY_BUFFER, instances);
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * FLOATS), gl.DYNAMIC_DRAW);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    },
  };
}
