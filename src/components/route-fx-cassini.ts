// ── Certificates: Saturn eclipsing the sun, ray-traced on the GPU after the
// Cassini probe's famous view. The night side faces us, ringed by sunlight
// scattered through the atmosphere; the rings glow where they are thin enough
// for sunlight to pass and go dark where they are dense; the globe shadows the
// rings and the rings shadow the globe. On the way out the sun breaks from
// behind the limb and floods the screen ──────────────────────────────────────
// Units are Saturn's equatorial radius; the rings lie in the y = 0 plane.
import {
  cinema,
  clamp01,
  dot,
  easeIn,
  easeInOut,
  easeOut,
  type Fx,
  glint,
  type Look,
  lerp,
  motes,
  streak,
  terminal,
} from "@/components/route-fx-kit";
import { render, shader } from "@/components/route-fx-gl";

const FRAGMENT = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform vec3 eye;
uniform vec3 right;
uniform vec3 up;
uniform vec3 forward;
uniform float tanHalf;
uniform vec3 sun;
uniform float spin;
uniform float glow;

const float OBLATE = 0.902;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float sum = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += noise(p) * amplitude;
    p = p * 2.07 + 13.1;
    amplitude *= 0.5;
  }
  return sum;
}
// Optical depth of the rings at a radius. Ringlets finer than a pixel's footprint
// are averaged away instead of being left to shimmer.
float ringDepth(float r, float footprint) {
  float d = smoothstep(1.24, 1.27, r) * (1.0 - smoothstep(1.50, 1.53, r)) * (0.09 + 0.05 * sin(r * 41.0)); // C ring
  d += smoothstep(1.52, 1.56, r) * (1.0 - smoothstep(1.92, 1.95, r)) * (1.4 + 0.4 * sin(r * 23.0)); // B ring
  d += smoothstep(1.95, 1.97, r) * (1.0 - smoothstep(2.01, 2.03, r)) * 0.04; // Cassini division
  d += smoothstep(2.03, 2.05, r) * (1.0 - smoothstep(2.25, 2.27, r)) * (0.45 + 0.1 * sin(r * 60.0)); // A ring
  d *= 1.0 - (smoothstep(2.204, 2.209, r) - smoothstep(2.215, 2.22, r)); // Encke gap
  d += smoothstep(2.317, 2.322, r) * (1.0 - smoothstep(2.326, 2.331, r)) * 0.3; // F ring
  float detail = clamp(1.0 - footprint * 140.0, 0.0, 1.0);
  float ringlets = noise(vec2(r * 300.0, 1.7)) * 0.6 + noise(vec2(r * 90.0, 5.3)) * 0.4;
  d *= mix(1.0, 0.45 + 1.1 * ringlets, detail);
  d += smoothstep(2.9, 3.8, r) * (1.0 - smoothstep(4.6, 8.0, r)) * 0.008; // the faint, wide E ring
  return d;
}
vec3 ringTint(float r) {
  vec3 color = mix(vec3(0.66, 0.55, 0.42), vec3(1.0, 0.9, 0.72), smoothstep(1.48, 1.6, r));
  return mix(color, vec3(0.88, 0.8, 0.68), smoothstep(2.0, 2.12, r));
}
// Distance along a ray to the oblate globe, or -1 if it misses.
float globe(vec3 origin, vec3 direction) {
  vec3 o = vec3(origin.x, origin.y / OBLATE, origin.z);
  vec3 d = vec3(direction.x, direction.y / OBLATE, direction.z);
  float a = dot(d, d);
  float b = dot(o, d);
  float c = dot(o, o) - 1.0;
  float disc = b * b - a * c;
  if (disc < 0.0) return -1.0;
  float t = (-b - sqrt(disc)) / a;
  return t > 0.0 ? t : -1.0;
}
vec3 sky(vec3 dir) {
  vec3 p = dir * 110.0;
  vec3 cell = floor(p);
  float star = step(0.994, hash3(cell)) * smoothstep(0.32, 0.0, length(fract(p) - 0.5)) * (0.5 + 2.0 * hash3(cell + 4.1));
  float s = max(0.0, dot(dir, sun));
  vec3 glare = vec3(1.0, 0.9, 0.76) * (pow(s, 24000.0) * 60.0 + pow(s, 900.0) * 1.6 + pow(s, 60.0) * 0.18 + pow(s, 6.0) * 0.03);
  return vec3(star) * vec3(0.95, 0.95, 1.0) + glare;
}
vec3 planet(vec3 p, vec3 dir) {
  vec3 n = normalize(vec3(p.x, p.y / (OBLATE * OBLATE), p.z));
  float c = cos(spin);
  float s = sin(spin);
  vec3 q = vec3(c * n.x - s * n.z, n.y, s * n.x + c * n.z); // turning with the planet
  float latitude = asin(clamp(n.y, -1.0, 1.0));
  float longitude = atan(q.z, q.x);
  // Zones and belts, wavy at their edges, streaked along the wind.
  float band = latitude + (fbm(vec2(longitude * 3.0, latitude * 9.0)) - 0.5) * 0.09;
  vec3 albedo = mix(vec3(0.8, 0.58, 0.3), vec3(1.0, 0.9, 0.66), 0.5 + 0.5 * sin(band * 21.0 + 0.6));
  albedo *= 0.88 + 0.24 * fbm(vec2(longitude * 9.0, band * 90.0));
  albedo = mix(albedo, vec3(0.58, 0.63, 0.66), smoothstep(1.12, 1.32, band)); // the north polar cap
  // White storms riding the bands, and the polar hexagon.
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    vec2 at = vec2(longitude - (0.7 + fk * 2.3), (latitude - (0.55 - fk * 0.42)) * 2.2);
    at.x = mod(at.x + 3.1416, 6.2832) - 3.1416;
    albedo = mix(albedo, vec3(1.0, 0.97, 0.9), smoothstep(0.16, 0.0, length(at * vec2(cos(latitude), 1.0))) * 0.8);
  }
  float sector = mod(longitude + 3.1416, 1.0472) - 0.5236;
  albedo = mix(albedo, vec3(0.42, 0.52, 0.58), smoothstep(0.014, 0.0, abs((1.5708 - latitude) - 0.2 / cos(sector))) * step(0.0, latitude));
  // Sunlight with a soft terminator, dimmed where the rings shadow the globe.
  float light = dot(n, sun);
  float day = max(0.0, light * 0.92 + 0.08) * smoothstep(-0.1, 0.1, light);
  float shadow = 1.0;
  if (abs(sun.y) > 0.001) {
    float t = -p.y / sun.y;
    if (t > 0.0) shadow = exp(-ringDepth(length((p + sun * t).xz), 0.01) * 0.5 / abs(sun.y));
  }
  float facing = max(0.0, dot(n, -dir));
  float behind = pow(max(0.0, dot(dir, sun)), 8.0);
  // The atmosphere lights up round the limb when the sun is behind it.
  float rim = pow(1.0 - facing, 6.0) * (0.1 + 4.0 * behind) + pow(1.0 - facing, 3.0) * 0.12 * behind;
  return albedo * (day * shadow * vec3(1.0, 0.95, 0.86) * (0.35 + 0.65 * sqrt(facing)) + 0.012) + vec3(1.0, 0.78, 0.5) * rim;
}
vec3 ring(vec3 hit, vec3 dir, float depth) {
  float lit = globe(hit, sun) > 0.0 ? 0.03 : 1.0; // in the globe's shadow
  float tau = depth / max(abs(dir.y), 0.02);
  vec3 tint = ringTint(length(hit.xz));
  float side = sun.y * sign(eye.y); // above zero: the sunlit face is towards us
  vec3 sunlit = tint * (1.0 - exp(-tau)) * (0.2 + 0.8 * pow(abs(sun.y), 0.35)) * 1.5;
  // Lit from behind: thin rings glow with forward-scattered light, the dense B ring blocks it.
  vec3 backlit = tint * tau * exp(-tau) * (0.4 + 6.0 * pow(max(0.0, dot(dir, sun)), 6.0)) * 1.6;
  return (sunlit * smoothstep(0.0, 0.06, side) + backlit * smoothstep(0.0, 0.06, -side)) * lit;
}
const vec3 TITAN = vec3(-4.4, 0.35, 1.6);
vec3 moon(vec3 dir, vec3 color) {
  vec3 o = eye - TITAN;
  float b = dot(o, dir);
  float disc = b * b - dot(o, o) + 0.0049;
  if (disc < 0.0) return color;
  vec3 n = normalize(o + dir * (-b - sqrt(disc)));
  float light = max(0.0, dot(n, sun));
  float haze = pow(1.0 - max(0.0, dot(n, -dir)), 3.0) * pow(max(0.0, dot(dir, sun)), 4.0);
  return vec3(0.9, 0.62, 0.32) * (light + 0.01) + vec3(1.0, 0.7, 0.4) * haze * 2.0;
}
void main() {
  vec2 uv = gl_FragCoord.xy / resolution * 2.0 - 1.0;
  uv.x *= resolution.x / resolution.y;
  vec3 dir = normalize(forward + (uv.x * right + uv.y * up) * tanHalf);
  vec3 color = moon(dir, sky(dir));
  float hitGlobe = globe(eye, dir);
  if (hitGlobe > 0.0) color = planet(eye + dir * hitGlobe, dir);
  if (abs(dir.y) > 0.0001) {
    float hitRing = -eye.y / dir.y;
    if (hitRing > 0.0 && (hitGlobe < 0.0 || hitRing < hitGlobe)) {
      vec3 hit = eye + dir * hitRing;
      float footprint = hitRing * 2.0 * tanHalf / resolution.y / max(abs(dir.y), 0.05);
      float depth = ringDepth(length(hit.xz), footprint);
      if (depth > 0.0) {
        float cover = 1.0 - exp(-depth / max(abs(dir.y), 0.02));
        color = color * (1.0 - cover) + ring(hit, dir, depth);
      }
    }
  }
  color = vec3(1.0) - exp(-color * glow * 1.25); // a filmic shoulder for the glare
  gl_FragColor = vec4(pow(color, vec3(0.95)), 1.0);
}`;

type Vec = [number, number, number];
const unit = (v: Vec): Vec => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const along = (a: Vec, s: number, b: Vec, t: number): Vec => [a[0] * s + b[0] * t, a[1] * s + b[1] * t, a[2] * s + b[2] * t];

/** The ray-traced Saturn, or the given flat version where WebGL is missing. */
export function cassini(flat: () => Fx): Fx {
  const gpu = shader("cassini", FRAGMENT, ["resolution", "time", "eye", "right", "up", "forward", "tanHalf", "sun", "spin", "glow"]);
  if (!gpu) return flat();
  const look: Look = { tint: "236,214,186", light: [0.4, 0.35], bloom: 0.6, haze: 0.03, dust: motes(50), vignette: 0.55 };
  let waited = 0;

  return (ctx, frame) => {
    const { phase, p, dt, w, h, time } = frame;
    const cover = phase === "cover" ? easeInOut(p) : 1;
    if (phase === "wait") waited += dt;
    // The camera closes in from deep space and hangs off the rings, slowly drifting.
    const distance = phase === "cover" ? lerp(15, 5.4, easeOut(p)) : phase === "reveal" ? lerp(5.4, 4.9, easeInOut(p)) : 5.4;
    const azimuth = 0.42 + time * 0.015;
    const elevation = 0.3;
    const eye: Vec = [distance * Math.sin(azimuth) * Math.cos(elevation), distance * Math.sin(elevation), distance * Math.cos(azimuth) * Math.cos(elevation)];
    const forward = unit([-eye[0], -0.08 - eye[1], -eye[2]]);
    const level = unit(cross(forward, [0, 1, 0]));
    const roll = -0.13; // a slight Dutch angle
    const right = along(level, Math.cos(roll), cross(level, forward), Math.sin(roll));
    const up = cross(right, forward);
    const tanHalf = Math.tan((h > w ? 1.0 : 0.62) / 2);
    // The sun sits just behind the upper-left limb, creeping towards it, and on
    // the way out breaks clear of it.
    const reach =
      phase === "cover" ? 0.66 : phase === "wait" ? Math.min(0.9, 0.66 + waited * 0.14) : lerp(0.9, 5.5, easeInOut(clamp01(p / 0.6)));
    const angle = Math.asin(1 / distance) * reach;
    const away = unit(along(right, -0.62, up, 0.78));
    const sun = unit(along(forward, Math.cos(angle), away, Math.sin(angle)));
    const spin = time * 0.25;

    // Trace at near full resolution: the ring divisions need the pixels.
    const scale = Math.min(ctx.canvas.width / w, 1700 / w);
    const image = render(gpu, Math.max(2, Math.round(w * scale)), Math.max(2, Math.round(h * scale)), (gl, uniforms) => {
      gl.uniform1f(uniforms.time, time);
      gl.uniform3f(uniforms.eye, ...eye);
      gl.uniform3f(uniforms.right, ...right);
      gl.uniform3f(uniforms.up, ...up);
      gl.uniform3f(uniforms.forward, ...forward);
      gl.uniform1f(uniforms.tanHalf, tanHalf);
      gl.uniform3f(uniforms.sun, ...sun);
      gl.uniform1f(uniforms.spin, spin);
      gl.uniform1f(uniforms.glow, lerp(0.4, 1, cover));
    });
    // On the way out the light floods the screen and the scene is gone by the time it fades.
    const fade = phase === "reveal" ? 1 - clamp01((p - 0.56) / 0.12) : 1;
    const flood = phase === "reveal" ? easeIn(clamp01((p - 0.36) / 0.26)) * (1 - clamp01((p - 0.62) / 0.38)) ** 1.6 : 0;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = cover * fade;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, w, h);

    // Where the sun is on screen, and how far it has cleared the limb.
    const depth = sun[0] * forward[0] + sun[1] * forward[1] + sun[2] * forward[2];
    const sunX = w / 2 + ((sun[0] * right[0] + sun[1] * right[1] + sun[2] * right[2]) / depth / tanHalf) * (h / 2);
    const sunY = h / 2 - ((sun[0] * up[0] + sun[1] * up[1] + sun[2] * up[2]) / depth / tanHalf) * (h / 2);
    const exposure = clamp01((reach - 0.98) / 0.16) * (phase === "reveal" ? 1 - clamp01((p - 0.55) / 0.2) : 1);
    if (exposure > 0) {
      ctx.globalCompositeOperation = "lighter";
      const size = Math.min(w, h);
      dot(ctx, "255,214,160", sunX, sunY, size * 0.9, exposure * 0.5);
      dot(ctx, "255,252,244", sunX, sunY, size * (0.06 + 0.12 * exposure), exposure);
      glint(ctx, sunX, sunY, size * (0.2 + 0.5 * exposure), "255,238,214", exposure * 0.9, 0.2 + time * 0.1);
      streak(ctx, sunX, sunY, w * 0.6 * exposure, "255,214,170", exposure * 0.85);
    }
    if (flood > 0) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = flood;
      const light = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.hypot(w, h));
      light.addColorStop(0, "rgba(255,255,255,1)");
      light.addColorStop(0.3, "rgba(255,240,216,1)");
      light.addColorStop(1, "rgba(255,206,160,0.9)");
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, w, h);
    }
    look.light = [clamp01(sunX / w), clamp01(sunY / h)];
    look.blast = phase === "reveal" ? { x: sunX, y: sunY, force: 700 * easeInOut(clamp01(p / 0.45)) } : undefined;
    cinema(ctx, frame, look, cover * fade);
    terminal(ctx, frame, "saturn", "255,200,140");
  };
}
