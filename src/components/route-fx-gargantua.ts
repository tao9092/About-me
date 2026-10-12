// ── Index: a black hole ray-traced on the GPU. Light from the accretion disk
// and the stars bends round the hole, so the far side of the disk arches over
// and under the shadow and the side turning towards us blazes brighter. The
// site's sections orbit it; on the way out the camera falls in and the page
// opens up on the far side ─────────────────────────────────────────────────
// Units are Schwarzschild radii: the horizon is at r = 1, the photon sphere at
// 1.5, the disk runs from the innermost stable orbit at 3 out to 13.
import {
  burst,
  cinema,
  clamp01,
  dot,
  drawSparks,
  easeIn,
  easeInOut,
  easeOut,
  type Fx,
  hole,
  type Look,
  lerp,
  MONO,
  motes,
  ring,
  type Spark,
  TAU,
  terminal,
} from "@/components/route-fx-kit";
import { render, shader } from "@/components/route-fx-gl";

// Photons follow x'' = -1.5 h² x / r⁵ (h = |x × v|), the Schwarzschild orbit
// equation written as a force in flat space; each ray is stepped until it falls
// in, escapes to the stars, or has crossed the disk too many times to see through.
const FRAGMENT = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform vec3 eye;
uniform vec3 right;
uniform vec3 up;
uniform vec3 forward;
uniform float tanHalf;
uniform float glow;
uniform float fall;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
vec3 sky(vec3 dir) {
  // Stars in cells of 3D direction space: round, and no seam where an angle wraps.
  vec3 p = dir * 90.0;
  vec3 cell = floor(p);
  float star = step(0.993, hash3(cell)) * smoothstep(0.35, 0.0, length(fract(p) - 0.5)) * (0.6 + 2.4 * hash3(cell + 3.7));
  vec2 uv = dir.xy * 3.0 + dir.z * 1.7;
  float haze = noise(uv * 1.6) * noise(uv * 3.4 + 3.0);
  vec3 color = vec3(star) * vec3(1.0, 0.94, 0.88) + vec3(0.09, 0.05, 0.11) * haze * haze;
  // Falling in, the sky ahead is squeezed and blueshifted.
  return color * (1.0 + fall * 3.0) * mix(vec3(1.0), vec3(0.6, 0.85, 1.6), fall);
}
vec3 disk(float r, vec3 hit, float doppler) {
  float t = clamp((r - 3.0) / 10.0, 0.0, 1.0);
  float angle = atan(hit.z, hit.x) - time * 9.0 * pow(r, -1.5); // inner orbits run faster
  float streaks = noise(vec2(r * 2.6, angle * 5.0)) * 0.55 + noise(vec2(r * 8.0, angle * 17.0)) * 0.45;
  float density = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.7, 1.0, t)) * (0.2 + 1.05 * streaks * streaks * 1.6);
  vec3 color = mix(vec3(1.0, 0.96, 0.88), vec3(1.0, 0.6, 0.26), smoothstep(0.0, 0.35, t));
  color = mix(color, vec3(0.7, 0.2, 0.08), smoothstep(0.35, 1.0, t));
  color *= pow(1.0 - t, 1.5) * 2.6 + 0.2;
  // Relativistic beaming: the side coming towards us is far brighter, and bluer.
  color *= doppler * doppler * doppler;
  color = mix(color, color * vec3(0.82, 0.92, 1.25), clamp(doppler - 1.0, 0.0, 1.0));
  return color * density;
}
void main() {
  vec2 uv = gl_FragCoord.xy / resolution * 2.0 - 1.0;
  uv.x *= resolution.x / resolution.y;
  vec3 velocity = normalize(forward + (uv.x * right + uv.y * up) * tanHalf);
  vec3 position = eye;
  vec3 spin = cross(position, velocity);
  float h2 = dot(spin, spin);
  vec3 color = vec3(0.0);
  float cover = 0.0;
  bool swallowed = false;
  for (int i = 0; i < 170; i++) {
    float r2 = dot(position, position);
    float r = sqrt(r2);
    if (r < 1.0) { swallowed = true; break; }
    if (r > 70.0 && dot(position, velocity) > 0.0) break;
    float stride = clamp(0.07 * r, 0.015, 1.4);
    velocity += -1.5 * h2 * position / (r2 * r2 * r) * stride;
    vec3 next = position + velocity * stride;
    if (position.y * next.y < 0.0) {
      vec3 hit = mix(position, next, position.y / (position.y - next.y));
      float radius = length(hit.xz);
      if (radius > 2.9 && radius < 13.5) {
        vec3 orbit = normalize(vec3(-hit.z, 0.0, hit.x)) * sqrt(0.5 / radius);
        float beta2 = dot(orbit, orbit);
        float doppler = sqrt(1.0 - beta2) / (1.0 - dot(orbit, -normalize(velocity)));
        vec3 light = disk(radius, hit, doppler) * glow * 0.55;
        float opacity = clamp(dot(light, vec3(0.33)) * 1.6, 0.0, 0.92);
        color += (1.0 - cover) * light;
        cover += (1.0 - cover) * opacity;
        if (cover > 0.96) break;
      }
    }
    position = next;
  }
  if (!swallowed) color += (1.0 - cover) * sky(normalize(velocity));
  color = vec3(1.0) - exp(-color * 1.35); // a filmic shoulder for the hot disk
  gl_FragColor = vec4(pow(color, vec3(0.95)), 1.0);
}`;

type Vec = [number, number, number];
const unit = (v: Vec): Vec => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const SECTIONS = ["Projects", "Competitions", "Certificates", "Experience", "Index"];
const SHADOW = 2.6; // apparent radius of the shadow, seen from afar

/** The ray-traced black hole, or the given flat version where WebGL is missing. */
export function gargantua(flat: () => Fx): Fx {
  const gpu = shader("gargantua", FRAGMENT, ["resolution", "time", "eye", "right", "up", "forward", "tanHalf", "glow", "fall"]);
  if (!gpu) return flat();
  const look: Look = { tint: "255,178,110", light: [0.5, 0.48], bloom: 0.7, haze: 0.05, dust: motes(30), vignette: 0.6 };
  const orbit = SECTIONS.map((label, index) => ({ label, angle: (index / SECTIONS.length) * TAU }));
  let azimuth = -0.7;
  let sparks: Spark[] = [];

  return (ctx, frame) => {
    const { phase, p, dt, w, h, time } = frame;
    const cover = phase === "cover" ? easeInOut(p) : 1;
    // Approach from afar, hold in a slow orbit, then fall in.
    const fall = phase === "reveal" ? easeIn(clamp01(p / 0.75)) : 0;
    const distance = phase === "cover" ? lerp(70, 27, easeOut(p)) : 27 * (1.04 / 27) ** fall;
    azimuth += dt * (phase === "cover" ? 0.9 * (1 - p) + 0.05 : 0.05 + fall * 0.9);
    const incline = 0.1 + 0.015 * Math.sin(time * 0.3) + fall * 0.12;
    const eye: Vec = [distance * Math.cos(azimuth) * Math.cos(incline), distance * Math.sin(incline), distance * Math.sin(azimuth) * Math.cos(incline)];
    const forward = unit([-eye[0], -eye[1], -eye[2]]);
    const right = unit(cross(forward, [0, 1, 0]));
    const up = cross(right, forward);
    const tanHalf = Math.tan((h > w ? 0.95 : 0.62) / 2);

    // Trace at reduced resolution; the lens bloom and grain hide the upscale.
    const dpr = ctx.canvas.width / w;
    const scale = Math.min(0.62 * dpr, 1100 / w);
    const [width, height] = [Math.max(2, Math.round(w * scale)), Math.max(2, Math.round(h * scale))];
    const image = render(gpu, width, height, (gl, uniforms) => {
      gl.uniform1f(uniforms.time, time);
      gl.uniform3f(uniforms.eye, ...eye);
      gl.uniform3f(uniforms.right, ...right);
      gl.uniform3f(uniforms.up, ...up);
      gl.uniform3f(uniforms.forward, ...forward);
      gl.uniform1f(uniforms.tanHalf, tanHalf);
      gl.uniform1f(uniforms.glow, lerp(0.35, 1, cover));
      gl.uniform1f(uniforms.fall, fall);
    });
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = cover;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, w, h);

    // The sections orbit beyond the disk, hidden while they pass behind the shadow.
    const toScreen = (point: Vec) => {
      const d: Vec = [point[0] - eye[0], point[1] - eye[1], point[2] - eye[2]];
      const depth = d[0] * forward[0] + d[1] * forward[1] + d[2] * forward[2];
      if (depth < 0.5) return null;
      const x = (d[0] * right[0] + d[1] * right[1] + d[2] * right[2]) / depth / tanHalf;
      const y = (d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / depth / tanHalf;
      return { x: w / 2 + (x * h) / 2, y: h / 2 - (y * h) / 2, depth };
    };
    const shadowOnScreen = ((SHADOW / distance) / tanHalf) * (h / 2);
    const labels = (phase === "reveal" ? 1 - clamp01(p / 0.25) : phase === "wait" ? 1 : clamp01((p - 0.35) / 0.4)) * cover;
    if (labels > 0) {
      ctx.font = `600 11px ${MONO}`;
      ctx.textAlign = "center";
      for (const body of orbit) {
        body.angle += dt * 0.22;
        const at = toScreen([Math.cos(body.angle) * 17, 0.6, Math.sin(body.angle) * 17]);
        if (!at) continue;
        const behind = at.depth > distance && Math.hypot(at.x - w / 2, at.y - h / 2) < shadowOnScreen * 1.15;
        if (behind) continue;
        const near = clamp01(1.4 - at.depth / distance);
        ctx.globalCompositeOperation = "lighter";
        dot(ctx, "255,214,160", at.x, at.y, 14 + 10 * near, labels);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = labels * (0.55 + 0.4 * near);
        ctx.fillStyle = "#ffe2bd";
        ctx.fillText(body.label.toUpperCase(), at.x, at.y - 14);
      }
      ctx.textAlign = "start";
    }

    // Through to the far side: the shadow fills the frame, then opens onto the page.
    if (phase === "reveal" && p > 0.68) {
      const open = easeIn(clamp01((p - 0.68) / 0.32));
      const reach = (Math.hypot(w, h) / 2 + 60) * open;
      if (!sparks.length) sparks = burst(220, w / 2, h / 2, 200, 1400, ["190,220,255", "255,255,255", "255,214,170"], 1);
      hole(ctx, w / 2, h / 2, reach, Math.max(20, reach * 0.25));
      ring(ctx, w / 2, h / 2, reach * 1.02, "190,225,255", 1 - open * 0.7, 3);
      ring(ctx, w / 2, h / 2, reach * 0.8, "255,226,190", (1 - open) * 0.6, 1.6);
      drawSparks(ctx, sparks, dt, 0.93);
    }
    look.blast = phase === "reveal" ? { x: w / 2, y: h / 2, force: 1200 * fall } : undefined;
    cinema(ctx, frame, look, phase === "reveal" ? 1 - clamp01((p - 0.7) / 0.3) : cover);
    terminal(ctx, frame, "blackhole", "255,194,122");
  };
}
