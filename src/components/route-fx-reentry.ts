// ── Certificates: re-entry. A storm of burning debris tears past the lens and
// the camera falls out of the fire above the Earth, ray-traced on the GPU: cloud
// fields baked once into maps and eroded with fine detail per pixel, sunlight
// scattered through a real shell of air (a blue limb, an orange terminator, a
// thin airglow over the night side), cities lit in the dark. The last fragments
// burn out in the atmosphere. On the way out a ring station streaks past wrapped
// in a bow shock and dives for the planet until it is one spark of light, and
// from that spark a bronze porthole opens onto the page ───────────────────────
// Units are the Earth's radius; the Earth sits at the origin, the camera on +z.
import {
  cinema,
  clamp01,
  defocused,
  dot,
  easeIn,
  easeInOut,
  easeOut,
  type Fx,
  glint,
  hole,
  type Look,
  lerp,
  rand,
  scaled,
  shake,
  streak,
  TAU,
  terminal,
} from "@/components/route-fx-kit";
import { prepareShader, render, type Shader, shader } from "@/components/route-fx-gl";

const NOISE = `
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
// Value noise read from a tile of random values: one filtered fetch gives a slice
// and the next slice up (the green channel is the red one shifted by (37, 17)).
uniform sampler2D noiseMap;
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  vec2 slices = texture2D(noiseMap, (i.xy + vec2(37.0, 17.0) * i.z + f.xy + 0.5) / 256.0).xy;
  return mix(slices.x, slices.y, f.z);
}
float fbm(vec3 p) {
  float sum = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 6; i++) {
    sum += noise(p) * amplitude;
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    amplitude *= 0.5;
  }
  return sum;
}
float fbm4(vec3 p) {
  float sum = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += noise(p) * amplitude;
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    amplitude *= 0.5;
  }
  return sum / 0.9375;
}`;

// The planet's maps, painted once into equirectangular textures. Clouds: density,
// relief (lit towards the sun), fine texture. Surface: land, its tint, city lights.
const BAKE = `
precision highp float;
uniform vec2 resolution;
uniform float layer;
uniform vec3 light;
${NOISE}
void main() {
  vec2 at = gl_FragCoord.xy / resolution;
  float lon = (at.x - 0.5) * 6.2831853;
  float lat = (at.y - 0.5) * 3.1415927;
  vec3 q = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
  if (layer < 0.5) {
    // Weather: fields warped into swirls and combed into streaks along the winds.
    vec3 warp = vec3(fbm(q * 1.3), fbm(q * 1.3 + 5.2), fbm(q * 1.3 + 9.7));
    vec3 p = q * 4.6 + warp * 2.6;
    vec3 f = q * 16.0 + warp * 4.0;
    vec3 comb = vec3(q.x * 26.0, q.y * 7.0, q.z * 26.0) + warp * 5.0;
    float fine = fbm(f);
    float height = fbm(p) + (fine - 0.5) * 0.3 + (fbm(comb) - 0.5) * 0.16;
    float density = smoothstep(0.46, 0.64, height);
    // Cloud tops are lit on the side that faces the sun.
    float towards = fbm(p + light * 0.07) + (fbm(f + light * 0.05) - 0.5) * 0.3 + (fbm(comb) - 0.5) * 0.16;
    float relief = clamp(0.5 + (height - towards) * 4.0, 0.0, 1.0);
    gl_FragColor = vec4(density, relief, fine, 1.0);
  } else {
    float shape = fbm(q * 1.7 + 3.0) + (fbm(q * 9.0) - 0.5) * 0.1;
    float land = smoothstep(0.495, 0.515, shape);
    float tint = fbm(q * 14.0 + 2.0);
    float sprawl = smoothstep(0.42, 0.66, fbm(q * 7.0 + 11.0));
    float cities = pow(smoothstep(0.5, 0.8, fbm(q * 60.0)), 2.0) * sprawl * smoothstep(0.505, 0.53, shape);
    gl_FragColor = vec4(land, tint, cities, 1.0);
  }
}`;

const FRAGMENT = `
precision highp float;
uniform vec2 resolution;
uniform vec3 eye;
uniform vec3 right;
uniform vec3 up;
uniform vec3 forward;
uniform float tanHalf;
uniform vec3 sun;
uniform float spin;
uniform float exposure;
uniform vec4 burn;
uniform float fire;
uniform float flame;
uniform vec2 flow;
uniform float clock;
uniform sampler2D clouds;
uniform sampler2D surface;
${NOISE}
const float PI = 3.14159265;
const float HEIGHT = 0.011; // scale height of the air
const float SHELL = 1.07;
const vec3 BETA = vec3(0.17, 0.41, 1.0) * 11.0; // Rayleigh: blue scatters most

vec3 spun(vec3 v) {
  float c = cos(spin);
  float s = sin(spin);
  return vec3(c * v.x - s * v.z, v.y, s * v.x + c * v.z);
}
vec2 mapAt(vec3 q) {
  return vec2(atan(q.z, q.x) / (2.0 * PI) + 0.5, asin(clamp(q.y, -1.0, 1.0)) / PI + 0.5);
}
// Sunlight at a place where the sun stands mu above the horizon: reddened low, gone below.
vec3 sunlight(float mu) {
  return mix(vec3(1.0, 0.38, 0.1), vec3(1.0, 0.96, 0.9), smoothstep(-0.02, 0.32, mu)) * smoothstep(-0.14, 0.05, mu);
}
vec3 stars(vec3 dir) {
  vec3 color = vec3(0.0);
  for (int layer = 0; layer < 2; layer++) {
    float near = layer == 0 ? 1.0 : 0.0;
    vec3 p = dir * mix(230.0, 90.0, near);
    vec3 cell = floor(p);
    float lit = step(mix(0.99, 0.996, near), hash(cell + near * 17.0));
    float shape = smoothstep(0.35, 0.0, length(fract(p) - 0.5));
    vec3 tint = mix(vec3(1.0, 0.82, 0.66), vec3(0.72, 0.84, 1.0), hash(cell + 3.7));
    color += lit * shape * tint * mix(0.6, 1.6, near) * (0.3 + hash(cell + 8.1));
  }
  // The faint band of the galaxy.
  float band = exp(-pow(dot(dir, normalize(vec3(0.35, 0.82, -0.45))), 2.0) / 0.03);
  return color + vec3(0.5, 0.55, 0.75) * band * fbm4(dir * 7.0) * 0.035;
}
// Sunlight scattered towards the eye between t0 and t1 along the ray, and in
// through how much of what lies beyond still gets through.
vec3 atmosphere(vec3 dir, float t0, float t1, out vec3 through) {
  float ds = (t1 - t0) / 12.0;
  vec3 gathered = vec3(0.0);
  float optical = 0.0;
  for (int i = 0; i < 12; i++) {
    vec3 p = eye + dir * (t0 + ds * (float(i) + 0.5));
    float r = length(p);
    float density = exp(-max(r - 1.0, 0.0) / HEIGHT);
    optical += density * ds;
    // Higher up the sun sets later.
    gathered += density * ds * sunlight(dot(p / r, sun) + (r - 1.0) * 2.5) * exp(-optical * BETA);
  }
  through = exp(-optical * BETA);
  float c = dot(dir, sun);
  float g = 0.76;
  float mie = 1.5 * ((1.0 - g * g) / (2.0 + g * g)) * (1.0 + c * c) / pow(1.0 + g * g - 2.0 * g * c, 1.5);
  return gathered * (BETA * 0.75 * (1.0 + c * c) * 0.75 + vec3(1.0, 0.92, 0.82) * mie * 0.9);
}
vec3 ground(vec3 n, vec3 dir) {
  vec3 q = spun(n);
  vec2 at = mapAt(q);
  vec3 cloud = texture2D(clouds, at).rgb;
  vec3 land = texture2D(surface, at).rgb;
  // Detail finer than the map can hold, eroding the cloud edges.
  // (It only moves the edges, so clear sky and solid cloud skip it.)
  float edge = cloud.r * (1.0 - cloud.r);
  float density = cloud.r;
  if (edge > 0.0) density = clamp(cloud.r + (fbm4(q * 80.0) * 0.75 + fbm4(q * 260.0) * 0.25 - 0.5) * edge * 2.6, 0.0, 1.0);
  float shadow = texture2D(clouds, mapAt(normalize(q - spun(sun) * 0.01))).r;
  float mu = dot(n, sun);
  vec3 light = sunlight(mu);
  float facing = max(dot(n, -dir), 0.0);
  // Sea and land, in the shadows of the clouds.
  vec3 soil = mix(vec3(0.03, 0.04, 0.028), vec3(0.1, 0.085, 0.06), land.g);
  vec3 color = mix(vec3(0.004, 0.014, 0.034), soil, land.r) * (light * max(mu, 0.0) * (1.0 - 0.65 * shadow) + vec3(0.01, 0.016, 0.03));
  // The sun on open water.
  float toward = max(dot(n, normalize(sun - dir)), 0.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - facing, 5.0);
  color += light * (pow(toward, 220.0) * 3.0 + pow(toward, 24.0) * 0.06) * (1.0 - land.r) * (1.0 - shadow * 0.8) * (0.3 + fresnel);
  // Cities across the night side.
  float night = smoothstep(0.03, -0.14, mu);
  color += vec3(1.0, 0.62, 0.28) * land.b * night * 2.6;
  // Clouds, their tops lit on the side towards the sun.
  float wrap = clamp((mu + 0.12) / 1.12, 0.0, 1.0);
  vec3 tops = vec3(0.9, 0.93, 0.97) * (light * wrap * (0.55 + 0.9 * (cloud.g - 0.5)) * (0.75 + 0.35 * density) + vec3(0.02, 0.03, 0.05));
  color = mix(color, tops, density);
  color += vec3(1.0, 0.6, 0.3) * land.b * night * density * 0.35; // city glow through thin cloud
  // Fire high in the atmosphere lights the cloud tops beneath it.
  vec3 toBurn = n - burn.xyz;
  color += vec3(1.0, 0.46, 0.16) * exp(-dot(toBurn, toBurn) / 0.004) * burn.w * (0.25 + density * 1.2);
  return color;
}
vec3 blackbody(float t) {
  t = clamp(t, 0.0, 1.5);
  vec3 c = vec3(0.6, 0.08, 0.01) * smoothstep(0.0, 0.3, t);
  c = mix(c, vec3(1.0, 0.42, 0.08), smoothstep(0.2, 0.55, t));
  c = mix(c, vec3(1.0, 0.78, 0.42), smoothstep(0.5, 0.85, t));
  c = mix(c, vec3(1.0, 0.97, 0.9), smoothstep(0.85, 1.3, t));
  return c * t * 2.2;
}
void main() {
  vec2 uv = gl_FragCoord.xy / resolution * 2.0 - 1.0;
  uv.x *= resolution.x / resolution.y;
  if (fire > 0.0) uv += (vec2(noise(vec3(uv * 6.0, clock * 4.0)), noise(vec3(uv * 6.0 + 7.3, clock * 4.0))) - 0.5) * 0.02 * fire; // heat shimmer
  vec3 dir = normalize(forward + (uv.x * right + uv.y * up) * tanHalf);
  float b = dot(eye, dir);
  float closest = length(eye - dir * b);
  // The limb is blended across one pixel instead of stepping.
  float pixel = max(-b, 0.1) * 2.0 * tanHalf / resolution.y;
  float coverage = b < 0.0 ? smoothstep(1.0 + pixel, 1.0 - pixel, closest) : 0.0;
  float enter = max(-b - sqrt(max(SHELL * SHELL - closest * closest, 0.0)), 0.0);
  vec3 through;
  vec3 color = vec3(0.0);
  if (coverage < 1.0) {
    vec3 sky = stars(dir);
    if (b < 0.0 && closest < SHELL) {
      vec3 glow = atmosphere(dir, enter, -b + sqrt(SHELL * SHELL - closest * closest), through);
      sky = sky * through + glow;
      // Airglow: a thin green line high over the night side.
      float night = smoothstep(0.05, -0.2, dot(normalize(eye - dir * b), sun));
      sky += vec3(0.32, 0.5, 0.36) * exp(-pow((closest - 1.016) / 0.0018, 2.0)) * night * 0.1;
    }
    color = sky * (1.0 - coverage);
  }
  if (coverage > 0.0) {
    float hit = -b - sqrt(max(1.0 - closest * closest, 0.0));
    vec3 glow = atmosphere(dir, enter, hit, through);
    color += (ground(normalize(eye + dir * hit), dir) * through + glow) * coverage;
  }
  // The fireball: flame streaks raked along the stream of wreckage, its core sweeping past.
  if (fire > 0.0) {
    vec2 across = vec2(-flow.y, flow.x);
    float a = dot(uv, flow);
    float c = dot(uv, across);
    vec3 p = vec3(a * 1.6 - clock * 9.0, c * 7.0, clock * 1.3);
    float streaks = fbm4(p + vec3(0.0, fbm4(p * vec3(0.6, 0.6, 1.0)) * 2.5, 0.0));
    float core = a - mix(-2.4, 2.4, flame);
    float envelope = exp(-c * c / 1.4) * (0.55 + 0.65 * exp(-core * core / 0.5));
    float heat = fire * envelope * (0.25 + 1.25 * streaks * streaks);
    color = color * (1.0 - min(heat, 1.0) * 0.7) + blackbody(heat);
  }
  color = vec3(1.0) - exp(-color * exposure * 1.5);
  color = mix(color, color * color * (3.0 - 2.0 * color), 0.25); // a little filmic contrast
  gl_FragColor = vec4(color, 1.0);
}`;

type Vec = [number, number, number];
const unit = (v: Vec): Vec => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const along = (a: Vec, s: number, b: Vec, t: number): Vec => [a[0] * s + b[0] * t, a[1] * s + b[1] * t, a[2] * s + b[2] * t];
const dot3 = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const spun = (v: Vec, angle: number): Vec => [Math.cos(angle) * v[0] - Math.sin(angle) * v[2], v[1], Math.sin(angle) * v[0] + Math.cos(angle) * v[2]];

const DISTANCE = 1.7;
// Low in the west: the terminator crosses the right of the frame, so the wreck
// and the capsule burn over the night side.
const SUN = unit([-0.88, 0.42, -0.05]);
const SPIN = 0.6; // the planet's turn when a shutter starts; it drifts on from there
type Camera = { eye: Vec; forward: Vec; right: Vec; up: Vec; tanHalf: number };
/** The camera on +z, tilted up by pitch so the limb crosses the upper frame. */
function camera(pitch: number, yaw: number, w: number, h: number): Camera {
  const eye: Vec = [0, 0, DISTANCE];
  const forward = unit([Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)]);
  const level = unit(cross(forward, [0, 1, 0]));
  const roll = 0.07; // the horizon leans a little
  const right = along(level, Math.cos(roll), cross(level, forward), Math.sin(roll));
  return { eye, forward, right, up: cross(right, forward), tanHalf: Math.tan((h > w ? 1.0 : 0.62) / 2) };
}
const project = (view: Camera, point: Vec, w: number, h: number) => {
  const d: Vec = [point[0] - view.eye[0], point[1] - view.eye[1], point[2] - view.eye[2]];
  const depth = dot3(d, view.forward);
  return { x: w / 2 + (dot3(d, view.right) / depth / view.tanHalf) * (h / 2), y: h / 2 - (dot3(d, view.up) / depth / view.tanHalf) * (h / 2) };
};
/** The point on the Earth seen at a place on screen (fractions of the frame), or null over space. */
function surfaceAt(view: Camera, fx: number, fy: number, w: number, h: number): Vec | null {
  const x = ((fx - 0.5) * w) / (h / 2);
  const y = ((0.5 - fy) * h) / (h / 2);
  const dir = unit(along(view.forward, 1, along(view.right, x * view.tanHalf, view.up, y * view.tanHalf), 1));
  const b = dot3(view.eye, dir);
  const disc = b * b - (dot3(view.eye, view.eye) - 1);
  if (disc < 0) return null;
  return along(view.eye, 1, dir, -b - Math.sqrt(disc));
}

// The tile of random values behind the shaders' noise, the same on every visit.
let noisePixels: Uint8Array | null = null;
function noiseTile() {
  if (noisePixels) return noisePixels;
  let seed = 20261024;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const red = Array.from({ length: 256 * 256 }, () => Math.floor(random() * 256));
  noisePixels = new Uint8Array(256 * 256 * 4);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const at = (y * 256 + x) * 4;
      noisePixels[at] = red[y * 256 + x];
      noisePixels[at + 1] = red[((y + 17) & 255) * 256 + ((x + 37) & 255)];
      noisePixels[at + 3] = 255;
    }
  return noisePixels;
}
const noiseBound = new WeakMap<WebGLRenderingContext, true>();
function bindNoise(target: Shader, slot: number) {
  const gl = target.gl;
  if (noiseBound.has(gl)) return;
  gl.activeTexture(gl.TEXTURE0 + slot);
  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, noiseTile());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.uniform1i(target.uniforms.noiseMap, slot);
  noiseBound.set(gl, true);
}

// The baked maps live as textures in the Earth shader's own context; a new
// context (after the GPU resets) bakes them again.
const baked = new WeakMap<WebGLRenderingContext, true>();
function bake(target: Shader, wide: boolean) {
  const gl = target.gl;
  if (baked.has(gl)) return true;
  const painter = shader("reentry-map", BAKE, BAKE_UNIFORMS);
  if (!painter) return false;
  bindNoise(painter, 0);
  bindNoise(target, 2);
  const limit = Math.min(
    gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    (painter.gl.getParameter(painter.gl.MAX_VIEWPORT_DIMS) as Int32Array)[0],
  );
  const light = spun(SUN, SPIN);
  const paint = (layer: number, width: number) => {
    const image = render(painter, width, width / 2, (g, uniforms) => {
      g.uniform1f(uniforms.layer, layer);
      g.uniform3f(uniforms.light, ...light);
    });
    if (painter.gl.drawingBufferWidth !== width) return false; // the browser would not give the full size
    gl.activeTexture(gl.TEXTURE0 + layer);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); // round the globe
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return true;
  };
  const ok = (paint(0, Math.min(limit, wide ? 4096 : 2048)) || paint(0, 2048)) && paint(1, Math.min(limit, 2048));
  painter.canvas.width = painter.canvas.height = 1; // the maps live on in the textures
  if (!ok) return false;
  gl.uniform1i(target.uniforms.clouds, 0);
  gl.uniform1i(target.uniforms.surface, 1);
  baked.set(gl, true);
  return true;
}

type Shard = { x: number; y: number; z: number; speed: number; spin: number; angle: number; shape: number[]; heat: number; seed: number };
/** A fragment of the wreck: a jagged sliver of charred metal. */
function makeShard(diagonal: number, lateral: number, behind: number): Shard {
  const z = Math.random() ** 1.6; // most are far and small, a few fill the lens
  return {
    x: -behind,
    y: lateral,
    z,
    speed: diagonal * lerp(0.9, 3.4, z) * rand(0.85, 1.15),
    spin: rand(-6, 6),
    angle: rand(0, TAU),
    shape: Array.from({ length: 8 }, (_, index) => rand(0.4, 1) * (index % 2 ? 0.75 : 1)),
    heat: rand(0.6, 1),
    seed: rand(0, 1),
  };
}
function shardPath(ctx: CanvasRenderingContext2D, shard: Shard, size: number) {
  ctx.beginPath();
  shard.shape.forEach((radius, index) => {
    const a = (index / shard.shape.length) * TAU;
    const px = Math.cos(a) * radius * size;
    const py = Math.sin(a) * radius * size * 0.55;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
}
function drawShard(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, shard: Shard, ux: number, uy: number, alpha: number, time: number) {
  if (alpha <= 0) return;
  const tail = size * (4 + shard.z * 10);
  const [px, py] = [-uy, ux]; // across the stream
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 1;
  // The burn: a wide ochre plume round a narrow white-hot core.
  for (const [width, reach, inner, outer] of [
    [1.4, 1, `rgba(255,118,36,${0.3 * alpha})`, "rgba(150,36,8,0)"],
    [0.45, 0.55, `rgba(255,238,206,${0.85 * alpha})`, "rgba(255,150,60,0)"],
  ] as const) {
    const end = tail * reach;
    const spread = size * width;
    const gradient = ctx.createLinearGradient(x, y, x - ux * end, y - uy * end);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(1, outer);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x + px * spread * 0.5, y + py * spread * 0.5);
    ctx.quadraticCurveTo(x - ux * end * 0.3 + px * spread * 0.45, y - uy * end * 0.3 + py * spread * 0.45, x - ux * end, y - uy * end);
    ctx.quadraticCurveTo(x - ux * end * 0.3 - px * spread * 0.45, y - uy * end * 0.3 - py * spread * 0.45, x - px * spread * 0.5, y - py * spread * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  // Molten droplets shed into the wake.
  for (let index = 0; index < 4; index++) {
    const back = (shard.seed + index * 0.27 + time * (1.5 + index * 0.4)) % 1;
    const drift = Math.sin(shard.seed * 40 + index * 2.1) * size * 0.9 * back;
    dot(ctx, "255,190,110", x - ux * tail * back * 1.2 + px * drift, y - uy * tail * back * 1.2 + py * drift, size * 0.7 * (1 - back) + 2, alpha * (1 - back) * 0.9);
  }
  dot(ctx, "255,140,50", x, y, size * 5, alpha * 0.35 * shard.heat);
  // The fragment, smeared along its flight when it is close; charred, and white-hot
  // along the edge that meets the air.
  const ghosts = size > 16 ? 3 : 1;
  const lx = ux * Math.cos(shard.angle) + uy * Math.sin(shard.angle); // the flight, in the fragment's own frame
  const ly = uy * Math.cos(shard.angle) - ux * Math.sin(shard.angle);
  for (let ghost = ghosts - 1; ghost >= 0; ghost--) {
    ctx.save();
    ctx.translate(x - ux * size * 0.45 * ghost, y - uy * size * 0.45 * ghost);
    ctx.rotate(shard.angle);
    shardPath(ctx, shard, size);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = alpha * (ghost ? 0.14 / ghost : 1);
    ctx.fillStyle = "rgb(52,30,20)";
    ctx.fill();
    const heat = ctx.createLinearGradient(lx * size, ly * size, -lx * size, -ly * size);
    heat.addColorStop(0, "rgba(255,252,240,1)");
    heat.addColorStop(0.35, `rgba(255,${Math.round(180 + 50 * shard.heat)},90,0.95)`);
    heat.addColorStop(0.75, "rgba(200,70,20,0.45)");
    heat.addColorStop(1, "rgba(120,30,10,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = heat;
    ctx.fill(); // the same outline again, lit, rather than a rectangle clipped to it
    ctx.restore();
  }
}

/** The ring station, its face tilted towards its flight (+x once rotated). */
function ringPath(ctx: CanvasRenderingContext2D, outer: number, inner: number, dx = 0) {
  ctx.beginPath();
  ctx.arc(dx, 0, outer, 0, TAU);
  ctx.arc(dx, 0, inner, 0, TAU, true);
}
function drawCapsule(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, heading: number, heat: number, alpha: number, time: number) {
  if (alpha <= 0) return;
  const radius = size / 2;
  ctx.globalCompositeOperation = "lighter";
  // Ionised air glowing all round it.
  dot(ctx, "255,120,40", x + Math.cos(heading) * radius * 0.6, y + Math.sin(heading) * radius * 0.6, size * 3.6, alpha * heat * 0.55);
  if (size < 9) {
    dot(ctx, "255,226,190", x, y, size * 3 + 8, alpha);
    dot(ctx, "255,255,255", x, y, size + 3, alpha);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.globalAlpha = 1;
  // The bow shock: white-hot gas wrapped round the leading face.
  const shock = ctx.createRadialGradient(radius * 0.85, 0, radius * 0.1, radius * 0.45, 0, radius * 1.5);
  shock.addColorStop(0, `rgba(255,250,236,${0.95 * heat * alpha})`);
  shock.addColorStop(0.3, `rgba(255,186,96,${0.7 * heat * alpha})`);
  shock.addColorStop(0.7, `rgba(240,90,30,${0.25 * heat * alpha})`);
  shock.addColorStop(1, "rgba(200,40,10,0)");
  ctx.fillStyle = shock;
  ctx.fillRect(-radius * 1.2, -radius * 1.6, radius * 3.4, radius * 3.2);
  // Tongues of plasma peeling off the rim and licking back past the hull.
  ctx.lineCap = "round";
  for (let index = 0; index < 8; index++) {
    const side = index % 2 ? 1 : -1;
    const rank = Math.floor(index / 2);
    const flicker = Math.sin(time * 13 + index * 1.9) * 0.15;
    const startY = side * radius * (0.5 + 0.12 * rank);
    const endX = -radius * (2.1 + rank * 0.45);
    const endY = side * radius * (0.85 + 0.12 * rank + flicker);
    const tongue = ctx.createLinearGradient(radius * 0.6, startY, endX, endY);
    tongue.addColorStop(0, `rgba(255,214,150,${0.85 * heat * alpha})`);
    tongue.addColorStop(0.4, `rgba(255,110,60,${0.35 * heat * alpha})`);
    tongue.addColorStop(1, "rgba(255,70,90,0)");
    ctx.strokeStyle = tongue;
    ctx.lineWidth = radius * (0.09 - rank * 0.015);
    ctx.beginPath();
    ctx.moveTo(radius * 0.6, startY);
    ctx.quadraticCurveTo(-radius * 0.15, side * radius * (1.12 + flicker), endX, endY);
    ctx.stroke();
  }

  // The hull, seen at a slant.
  ctx.scale(0.55, 1);
  const spinAngle = time * 0.9;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = alpha;
  // Its depth: the far rim showing behind the face.
  ctx.fillStyle = "#24272d";
  ringPath(ctx, radius, radius * 0.6, -radius * 0.16);
  ctx.fill("evenodd");
  // The face: brushed metal with an anisotropic sheen that holds still as the ring turns.
  const metal =
    "createConicGradient" in ctx
      ? ctx.createConicGradient(-0.6, 0, 0)
      : (ctx as CanvasRenderingContext2D).createLinearGradient(-radius, -radius, radius, radius);
  for (const [stop, color] of [
    [0, "#8d929b"],
    [0.12, "#eceef2"],
    [0.25, "#7b808a"],
    [0.4, "#c9ccd3"],
    [0.55, "#5d626b"],
    [0.7, "#d9dce1"],
    [0.85, "#6e737c"],
    [1, "#8d929b"],
  ] as const)
    metal.addColorStop(stop, color);
  ctx.fillStyle = metal;
  ringPath(ctx, radius, radius * 0.6);
  ctx.fill("evenodd");
  // Panel seams, modules round the rim and lit windows, all turning with the ring.
  ctx.save();
  ctx.rotate(spinAngle);
  ctx.strokeStyle = "rgba(20,22,26,0.45)";
  ctx.lineWidth = Math.max(0.6, radius * 0.012);
  ctx.beginPath();
  for (let index = 0; index < 28; index++) {
    const a = (index / 28) * TAU;
    ctx.moveTo(Math.cos(a) * radius * 0.62, Math.sin(a) * radius * 0.62);
    ctx.lineTo(Math.cos(a) * radius * 0.98, Math.sin(a) * radius * 0.98);
  }
  ctx.stroke();
  for (let index = 0; index < 10; index++) {
    ctx.save();
    ctx.rotate((index / 10) * TAU);
    ctx.fillStyle = "#b9bdc4";
    ctx.fillRect(radius * 0.94, -radius * 0.08, radius * 0.14, radius * 0.16);
    ctx.strokeStyle = "rgba(20,22,26,0.6)";
    ctx.strokeRect(radius * 0.94, -radius * 0.08, radius * 0.14, radius * 0.16);
    ctx.restore();
  }
  ctx.fillStyle = "rgba(255,214,150,0.75)";
  for (let index = 0; index < 30; index++) {
    const a = (index / 30) * TAU + 0.05;
    ctx.fillRect(Math.cos(a) * radius * 0.8 - radius * 0.012, Math.sin(a) * radius * 0.8 - radius * 0.012, radius * 0.024, radius * 0.024);
  }
  ctx.restore();
  // Light from the upper left: the far side falls into shadow, the near catches a
  // highlight, and the leading face glows with the heat.
  const shade = ctx.createLinearGradient(-radius, -radius, radius, radius);
  shade.addColorStop(0.35, "rgba(10,12,16,0)");
  shade.addColorStop(1, "rgba(10,12,16,0.6)");
  // Filled through the face's own outline (rim modules included) rather than clipped to it.
  const face = (style: CanvasGradient) => {
    ctx.fillStyle = style;
    ringPath(ctx, radius * 1.12, radius * 0.6);
    ctx.fill("evenodd");
  };
  face(shade);
  ctx.globalCompositeOperation = "lighter";
  const shine = ctx.createRadialGradient(-radius * 0.5, -radius * 0.6, 0, -radius * 0.5, -radius * 0.6, radius * 0.75);
  shine.addColorStop(0, "rgba(255,255,255,0.5)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  face(shine);
  const glow = ctx.createLinearGradient(radius, 0, -radius * 0.4, 0);
  glow.addColorStop(0, `rgba(255,246,226,${heat})`);
  glow.addColorStop(0.45, `rgba(255,140,50,${0.5 * heat})`);
  glow.addColorStop(1, "rgba(255,90,30,0)");
  face(glow);
  // Spokes and the hub.
  ctx.save();
  ctx.rotate(spinAngle);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#9ea3ab";
  ctx.strokeStyle = "rgba(20,22,26,0.5)";
  ctx.lineWidth = Math.max(0.6, radius * 0.012);
  for (let index = 0; index < 3; index++) {
    ctx.save();
    ctx.rotate((index / 3) * TAU);
    ctx.fillRect(radius * 0.18, -radius * 0.035, radius * 0.44, radius * 0.07);
    ctx.strokeRect(radius * 0.18, -radius * 0.035, radius * 0.44, radius * 0.07);
    ctx.restore();
  }
  ctx.restore();
  const hub = ctx.createRadialGradient(-radius * 0.06, -radius * 0.08, 0, 0, 0, radius * 0.2);
  hub.addColorStop(0, "#eceef1");
  hub.addColorStop(1, "#5c616a");
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#1c1e22";
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.07, 0, TAU);
  ctx.fill();
  // The rim burning where it meets the air.
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(255,214,160,${0.9 * heat * alpha})`;
  ctx.lineWidth = radius * 0.08;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.02, -1.2, 1.2);
  ctx.stroke();
  ctx.restore();
}

/** The capsule's wake: a soft trail of glowing gas, and thin streamers that peel off
 * the rim, taper and fan out, wavering as they go. */
function drawPlasma(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, back: number, length: number, alpha: number, time: number) {
  if (alpha <= 0 || length <= 0) return;
  const [bx, by] = [Math.cos(back), Math.sin(back)];
  const [px, py] = [-by, bx];
  ctx.globalCompositeOperation = "lighter";
  for (let index = 0; index < 14; index++) {
    const t = index / 13;
    dot(ctx, index < 4 ? "255,190,140" : "190,215,255", x + bx * length * t, y + by * length * t, (size * 0.6 + length * 0.22 * t) * 2.4, alpha * 0.22 * (1 - t));
  }
  ctx.globalAlpha = 1;
  for (let index = 0; index < 22; index++) {
    const side = ((index * 9) % 22) / 10.5 - 1;
    const reach = length * (0.35 + 0.65 * (1 - Math.abs(side) * 0.5) * (0.5 + 0.5 * Math.abs(Math.sin(index * 2.3))));
    const fan = 0.12 + 0.28 * Math.abs(Math.sin(index * 1.7));
    const width = Math.max(0.8, Math.min(6, size * (0.008 + 0.014 * Math.abs(Math.cos(index * 1.3)))));
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    for (let step = 0; step <= 10; step++) {
      const t = step / 10;
      const lateral = side * size * 0.4 * (1 + t * 2) + side * reach * fan * t * t + Math.sin(t * 5 + time * 9 + index * 1.7) * size * 0.12 * t;
      const cx = x + bx * reach * t + px * lateral;
      const cy = y + by * reach * t + py * lateral;
      const half = width * (1 - t) * 0.5;
      left.push([cx + px * half, cy + py * half]);
      right.push([cx - px * half, cy - py * half]);
    }
    const gradient = ctx.createLinearGradient(left[0][0], left[0][1], left[10][0], left[10][1]);
    gradient.addColorStop(0, `rgba(255,214,170,${alpha * 0.7})`);
    gradient.addColorStop(0.15, `rgba(235,242,255,${alpha * 0.4})`);
    gradient.addColorStop(0.6, `rgba(170,205,255,${alpha * 0.1})`);
    gradient.addColorStop(1, "rgba(150,190,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    left.forEach(([px2, py2], i) => (i ? ctx.lineTo(px2, py2) : ctx.moveTo(px2, py2)));
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
  }
}

/** The capsule's last flash, as a lens sees it: a hot core, an anamorphic streak and
 * ghosts strung through the centre of the frame. */
function flareAt(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, size: number, strength: number) {
  if (strength <= 0.01) return;
  ctx.globalCompositeOperation = "lighter";
  dot(ctx, "255,170,90", x, y, size * 0.7 * strength, strength * 0.5);
  dot(ctx, "255,240,220", x, y, size * 0.12 * strength, strength);
  glint(ctx, x, y, size * 0.14 * strength, "255,236,214", strength * 0.6, 0.35);
  streak(ctx, x, y, w * 0.55 * strength, "150,185,255", strength * 0.7);
  streak(ctx, x, y, w * 0.18 * strength, "255,220,190", strength * 0.6);
  for (const [t, scale, color, alpha] of [
    [0.3, 0.05, "120,255,190", 0.18],
    [0.55, 0.11, "180,140,255", 0.12],
    [0.8, 0.03, "255,200,120", 0.25],
    [1.0, 0.16, "120,170,255", 0.08],
  ] as const) {
    defocused(ctx, color, x + (w / 2 - x) * 2 * t, y + (h / 2 - y) * 2 * t, size * scale * 2, alpha * strength);
  }
}

function annulus(ctx: CanvasRenderingContext2D, x: number, y: number, inner: number, outer: number) {
  ctx.beginPath();
  ctx.arc(x, y, outer, 0, TAU);
  ctx.arc(x, y, Math.max(0, inner), 0, TAU, true);
}
/** The porthole: a bronze housing turned on a lathe and bolted down, a polished lip,
 * the glass edge, and the page sitting recessed behind it. */
function porthole(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, width: number, open: number) {
  if (radius <= 0 || width <= 0) return;
  const outer = radius + width;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  // The shadow the housing casts over the scene round it.
  const drop = ctx.createRadialGradient(x, y, outer * 0.98, x, y, outer + width * 0.6);
  drop.addColorStop(0, "rgba(0,0,0,0.55)");
  drop.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = drop;
  annulus(ctx, x, y, outer * 0.98, outer + width * 0.6);
  ctx.fill("evenodd");
  // The housing.
  const lip = radius + width * 0.1;
  const bronze = ctx.createRadialGradient(x, y, lip, x, y, outer);
  bronze.addColorStop(0, "#3b2214");
  bronze.addColorStop(0.25, "#8a5532");
  bronze.addColorStop(0.55, "#5a341d");
  bronze.addColorStop(0.8, "#2a170c");
  bronze.addColorStop(1, "#140b06");
  ctx.fillStyle = bronze;
  annulus(ctx, x, y, lip, outer);
  ctx.fill("evenodd");
  // Brushed: a sheen that runs round the ring, lit from the upper left.
  if ("createConicGradient" in ctx) {
    const sheen = ctx.createConicGradient(-Math.PI * 0.75, x, y);
    sheen.addColorStop(0, "rgba(255,214,170,0.5)");
    sheen.addColorStop(0.12, "rgba(255,214,170,0)");
    sheen.addColorStop(0.5, "rgba(255,200,150,0.22)");
    sheen.addColorStop(0.62, "rgba(255,200,150,0)");
    sheen.addColorStop(0.88, "rgba(255,214,170,0)");
    sheen.addColorStop(1, "rgba(255,214,170,0.5)");
    ctx.fillStyle = sheen;
    annulus(ctx, x, y, lip, outer);
    ctx.fill("evenodd");
  }
  // Lathe marks.
  ctx.lineWidth = 1;
  for (let index = 0; index < 7; index++) {
    ctx.strokeStyle = index % 2 ? "rgba(255,220,180,0.07)" : "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.arc(x, y, lip + (outer - lip) * (0.12 + index * 0.12), 0, TAU);
    ctx.stroke();
  }
  // Bolts.
  const bolt = width * 0.075;
  for (let index = 0; index < 24; index++) {
    const a = (index / 24) * TAU;
    const bx = x + Math.cos(a) * (radius + width * 0.58);
    const by = y + Math.sin(a) * (radius + width * 0.58);
    ctx.fillStyle = "#1a0e07";
    ctx.beginPath();
    ctx.arc(bx, by, bolt * 1.3, 0, TAU);
    ctx.fill();
    const head = ctx.createRadialGradient(bx - bolt * 0.35, by - bolt * 0.35, 0, bx, by, bolt);
    head.addColorStop(0, "#f0c79a");
    head.addColorStop(1, "#6b3f22");
    ctx.fillStyle = head;
    ctx.beginPath();
    ctx.arc(bx, by, bolt, 0, TAU);
    ctx.fill();
  }
  // The lip: a polished bevel catching the light.
  const bevel = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
  bevel.addColorStop(0, "#fff1dc");
  bevel.addColorStop(0.5, "#d99a62");
  bevel.addColorStop(1, "#6e3c20");
  ctx.fillStyle = bevel;
  annulus(ctx, x, y, radius, lip);
  ctx.fill("evenodd");
  // The glass edge: a sliver of chromatic fringe.
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(140,220,255,0.35)";
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, radius - 1.5), 0, TAU);
  ctx.stroke();
  // Behind the glass the page sits recessed in the hull's shadow, with a sheen
  // across the glass that fades as the window opens.
  const inner = ctx.createRadialGradient(x, y, Math.max(0, radius - width * 0.9), x, y, radius);
  inner.addColorStop(0, "rgba(8,4,2,0)");
  inner.addColorStop(1, "rgba(8,4,2,0.5)");
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
  ctx.clip();
  const glass = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
  glass.addColorStop(0.3, "rgba(255,255,255,0)");
  glass.addColorStop(0.42, `rgba(255,255,255,${0.12 * (1 - open)})`);
  glass.addColorStop(0.5, "rgba(255,255,255,0)");
  ctx.fillStyle = glass;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

/** The same Earth drawn flat, where WebGL is missing. */
function flatEarth(ctx: CanvasRenderingContext2D, view: Camera, w: number, h: number) {
  ctx.fillStyle = "#020409";
  ctx.fillRect(0, 0, w, h);
  const centre = project(view, [0, 0, 0], w, h);
  const top = project(view, [0, 1, 0], w, h);
  const radius = Math.hypot(top.x - centre.x, top.y - centre.y) * 1.08;
  const body = ctx.createRadialGradient(centre.x - radius * 0.3, centre.y - radius * 0.6, radius * 0.2, centre.x, centre.y, radius);
  body.addColorStop(0, "#2b3a50");
  body.addColorStop(0.75, "#101a2c");
  body.addColorStop(1, "#3c6db8");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(centre.x, centre.y, radius, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = "rgba(110,165,255,0.8)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalCompositeOperation = "source-over";
}

const UNIFORMS = ["resolution", "eye", "right", "up", "forward", "tanHalf", "sun", "spin", "exposure", "burn", "fire", "flame", "flow", "clock", "clouds", "surface", "noiseMap"];
const BAKE_UNIFORMS = ["resolution", "layer", "light", "noiseMap"];
/** Compiles the Earth shaders in the background, before the first shutter needs them. */
export const prepareReentry = () =>
  Promise.all([prepareShader("reentry", FRAGMENT, UNIFORMS), prepareShader("reentry-map", BAKE, BAKE_UNIFORMS)]).then(() => undefined);

const FINAL_PITCH = 0.49;
export function reentry(): Fx {
  const gpu = shader("reentry", FRAGMENT, UNIFORMS);
  const look: Look = { tint: "60,72,96", light: [0.3, 0.2], bloom: 0.45, haze: 0, dust: [], vignette: 0.65, grain: 0.18 };
  let shards: Shard[] = [];
  let embers: { dx: number; dy: number; seed: number; life: number; size: number }[] = [];
  let built = { w: 0, h: 0 };
  let debrisAt: Vec | null = null;
  let landingAt: Vec | null = null;

  return (ctx, frame) => {
    const { phase, p, dt, w, h, time } = frame;
    const diagonal = Math.hypot(w, h);
    const span = Math.min(w, h);
    // The stream of wreckage runs from upper left to lower right.
    const ux = 0.88;
    const uy = 0.47;
    if (built.w !== w || built.h !== h) {
      built = { w, h };
      shards = Array.from({ length: scaled(70) }, () => makeShard(diagonal, rand(-0.32, 0.32) * diagonal, rand(0.55, 2.6) * diagonal));
      embers = Array.from({ length: scaled(46) }, () => ({ dx: rand(-1, 1), dy: rand(-0.5, 0.5), seed: rand(0, 10), life: rand(0.8, 2), size: rand(0.6, 1.8) }));
      const final = camera(FINAL_PITCH, 0.05, w, h);
      debrisAt = surfaceAt(final, h > w ? 0.6 : 0.64, h > w ? 0.52 : 0.6, w, h);
      landingAt = surfaceAt(final, h > w ? 0.62 : 0.68, h > w ? 0.58 : 0.66, w, h);
    }

    const cover = phase === "cover" ? easeInOut(clamp01(p / 0.55)) : 1;
    // The fireball: the screen burns as the wreck tears past, then clears.
    const fire = phase === "cover" ? easeOut(clamp01((p - 0.06) / 0.22)) * (1 - easeIn(clamp01((p - 0.34) / 0.42))) : 0;
    // Falling out of the fire, the camera tips down and the Earth rises into frame;
    // it never quite holds still, like a camera on a shoulder.
    const rise = phase === "cover" ? easeOut(clamp01((p - 0.3) / 0.7)) : 1;
    const settle = phase === "reveal" ? easeInOut(p) : 0;
    const jolt = (Math.sin(time * 37) * 0.006 + Math.sin(time * 53) * 0.004) * fire;
    const pitch = lerp(1.0, FINAL_PITCH, rise) - settle * 0.02 + Math.sin(time * 0.9 + 1) * 0.004 + jolt;
    const yaw = 0.05 + time * 0.01 + Math.sin(time * 0.7) * 0.006 + Math.sin(time * 1.9) * 0.002 + jolt * 0.7;
    const view = camera(pitch, yaw, w, h);

    ctx.save();
    shake(ctx, fire * 3);
    // The Earth. The capsule's fire lights the cloud tops where it falls.
    const landing = landingAt && project(view, landingAt, w, h);
    const debris = debrisAt && project(view, debrisAt, w, h);
    const dive = phase === "reveal" ? clamp01(p / 0.55) : 0;
    const flare = phase === "reveal" ? Math.exp(-(((p - 0.56) / 0.07) ** 2)) : 0;
    const embersBurn = phase === "cover" ? clamp01((p - 0.55) / 0.3) : phase === "wait" ? 1 : 1 - clamp01(p / 0.4);
    const burnPoint = phase === "reveal" ? landingAt : debrisAt;
    const burnPower = phase === "reveal" ? easeIn(dive) * 1.4 + flare * 2.5 : embersBurn * 0.5;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = cover;
    if (gpu && bake(gpu, w > 700)) {
      const scale = Math.min(ctx.canvas.width / w, 1600 / w);
      const image = render(gpu, Math.max(2, Math.round(w * scale)), Math.max(2, Math.round(h * scale)), (gl, uniforms) => {
        gl.uniform3f(uniforms.eye, ...view.eye);
        gl.uniform3f(uniforms.right, ...view.right);
        gl.uniform3f(uniforms.up, ...view.up);
        gl.uniform3f(uniforms.forward, ...view.forward);
        gl.uniform1f(uniforms.tanHalf, view.tanHalf);
        gl.uniform3f(uniforms.sun, ...SUN);
        gl.uniform1f(uniforms.spin, SPIN + time * 0.02);
        gl.uniform1f(uniforms.exposure, lerp(0.5, 1, cover));
        gl.uniform4f(uniforms.burn, ...(burnPoint ?? [0, 0, 0]), burnPoint ? burnPower : 0);
        gl.uniform1f(uniforms.fire, fire);
        gl.uniform1f(uniforms.flame, clamp01(p / 0.75));
        gl.uniform2f(uniforms.flow, ux, -uy);
        gl.uniform1f(uniforms.clock, time);
      });
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, w, h);
    } else {
      flatEarth(ctx, view, w, h);
      if (fire > 0) {
        const fx = w * lerp(-0.2, 1.1, clamp01(p / 0.75));
        const fy = h * 0.2 + (fx / w) * h * 0.45;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = fire;
        const wash = ctx.createRadialGradient(fx, fy, 0, fx, fy, diagonal * 0.75);
        wash.addColorStop(0, "rgba(255,244,214,0.95)");
        wash.addColorStop(0.2, "rgba(255,176,80,0.8)");
        wash.addColorStop(0.55, "rgba(220,90,20,0.5)");
        wash.addColorStop(1, "rgba(90,24,6,0.25)");
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, w, h);
      }
    }

    // The last fragments burning out high in the atmosphere, falling as meteors.
    if (debris && embersBurn > 0) {
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      const spread = span * 0.09;
      for (const ember of embers) {
        const age = (time * 0.6 + ember.seed) % ember.life;
        const life = age / ember.life;
        const glow = Math.sin(life * Math.PI) * (0.6 + 0.4 * Math.sin(time * 23 + ember.seed * 9)) * embersBurn;
        if (glow <= 0.01) continue;
        const x = debris.x + ember.dx * spread * 1.4 + life * spread * 0.5;
        const y = debris.y + ember.dy * spread + life * spread * 0.28;
        const length = span * 0.014 * ember.size * (1 + life);
        const trail = ctx.createLinearGradient(x, y, x - ux * length, y - uy * length);
        trail.addColorStop(0, `rgba(255,214,160,${glow})`);
        trail.addColorStop(1, "rgba(255,110,40,0)");
        ctx.strokeStyle = trail;
        ctx.globalAlpha = 1;
        ctx.lineWidth = ember.size;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - ux * length, y - uy * length);
        ctx.stroke();
        dot(ctx, "255,170,80", x, y, ember.size * 9, glow * 0.6);
        dot(ctx, "255,244,224", x, y, ember.size * 2.6, glow);
      }
    }

    // The wreck tearing past the lens, and the sparks raked across the frame.
    if (phase === "cover") {
      const fade = 1 - clamp01((p - 0.62) / 0.3);
      for (const shard of shards) {
        shard.x += shard.speed * dt;
        shard.angle += shard.spin * dt;
        // From the stream's own frame (along it, across it) to the screen.
        const x = w / 2 + shard.x * ux - shard.y * uy;
        const y = h * 0.42 + shard.x * uy + shard.y * ux;
        const size = lerp(2, span * 0.06, shard.z ** 2);
        if (x < -size * 16 || y < -size * 16 || x > w + size * 6 || y > h + size * 6) continue;
        drawShard(ctx, x, y, size, shard, ux, uy, fade * cover, time);
      }
      if (fire > 0) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 1;
        ctx.lineCap = "round";
        for (let index = 0; index < 60; index++) {
          const lane = ((index * 37) % 60) / 60;
          const run = ((time * (1.4 + (index % 5) * 0.3) + index * 0.137) % 1.4) - 0.2;
          const sx = w * run + (lane - 0.5) * h * 0.9 * -uy;
          const sy = h * (lane * 1.2 - 0.1) + w * run * uy * 0.5;
          const length = diagonal * (0.04 + (index % 7) * 0.012);
          const spark = ctx.createLinearGradient(sx, sy, sx - ux * length, sy - uy * length);
          spark.addColorStop(0, `rgba(255,246,226,${fire * (0.5 + (index % 3) * 0.2)})`);
          spark.addColorStop(0.3, `rgba(255,170,80,${fire * 0.35})`);
          spark.addColorStop(1, "rgba(255,110,30,0)");
          ctx.strokeStyle = spark;
          ctx.lineWidth = 0.8 + (index % 3) * 0.6;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - ux * length, sy - uy * length);
          ctx.stroke();
        }
        streak(ctx, w * lerp(-0.2, 1.1, clamp01(p / 0.75)), h * 0.42, w * 0.6, "255,214,170", fire * 0.5);
      }
    }

    // The capsule: it streaks past, dives for the planet and is gone in a spark.
    let portX = landing?.x ?? w * 0.66;
    let portY = landing?.y ?? h * 0.62;
    if (phase === "reveal") {
      const startX = w * 0.24;
      const startY = h * 0.2;
      const travel = easeOut(dive);
      const x = lerp(startX, portX, travel);
      const y = lerp(startY, portY, travel);
      const size = span * 0.26 * (0.02 / 0.26) ** travel; // falling away from the lens
      const heading = Math.atan2(portY - startY, portX - startX);
      const alive = 1 - clamp01((p - 0.58) / 0.06);
      drawPlasma(ctx, x, y, size, heading + Math.PI, size * 3 + span * 0.5 * (1 - travel) + span * 0.12, alive * (0.5 + 0.5 * (1 - travel)), time);
      drawCapsule(ctx, x, y, size, heading, 0.6 + 0.4 * travel, alive, time);
      flareAt(ctx, portX, portY, w, h, span, flare);
    }
    ctx.restore();

    // A porthole opens from the spark, and through it the page.
    let after = 1;
    if (phase === "reveal" && p > 0.55) {
      const open = easeInOut(clamp01((p - 0.55) / 0.45));
      const farthest = Math.max(Math.hypot(portX, portY), Math.hypot(w - portX, portY), Math.hypot(portX, h - portY), Math.hypot(w - portX, h - portY));
      const rimWidth = Math.max(26, span * 0.11);
      const radius = (farthest + rimWidth * 1.7) * open;
      hole(ctx, portX, portY, radius, 1.5);
      porthole(ctx, portX, portY, radius, rimWidth * Math.min(1, open * 6), open);
      after = 1 - clamp01((p - 0.75) / 0.25);
    }
    if (!landing) [portX, portY] = [w * 0.66, h * 0.62];
    look.light = phase === "reveal" ? [clamp01(portX / w), clamp01(portY / h)] : [0.3, 0.2];
    look.blast = phase === "reveal" ? { x: portX, y: portY, force: 900 * flare } : undefined;
    look.wind = [0.06 * fire, 0.03 * fire];
    cinema(ctx, frame, look, cover * after);
    terminal(ctx, frame, "reentry", "255,200,150");
  };
}
