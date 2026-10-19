import type { ReactNode } from "react";

// The rifle scope's target, shared by the Competitions list and a competition's
// own page so the two match: the lens, a slowly turning bezel, rings at shares
// of the field, and the crosshair with its mil-dots, in a 1000 × 1000 view.
// A shot's distance out is the square root of its share of the field, which
// opens up the crowd of high finishes near the centre.

export const C = 500;
export const R = 410;
export const RINGS = [0.05, 0.1, 0.25, 0.5, 1];
// Rounded, so the server's and the browser's trigonometry agree when a page hydrates.
export const round = (value: number) => Math.round(value * 100) / 100;
export const polar = (degrees: number, radius: number) => {
  const theta = (degrees * Math.PI) / 180;
  return { x: round(C + Math.cos(theta) * radius), y: round(C + Math.sin(theta) * radius) };
};
export const out = (share: number) => R * Math.sqrt(Math.min(1, Math.max(0.01, share)));
export const shotAt = (angle: number, share: number | null) => polar(angle, out(share ?? 1));

/** A stable angle for a shot, from its slug, so the group looks the same every visit. */
export function angleFor(slug: string) {
  let hash = 2166136261;
  for (let index = 0; index < slug.length; index += 1) hash = Math.imul(hash ^ slug.charCodeAt(index), 16777619);
  return ((hash >>> 0) % 3600) / 10;
}

/** The target, with whatever is drawn on it (shots, a lock) passed as children. */
export function ScopeFace({ id, children }: { id: string; children?: ReactNode }) {
  return (
    <svg viewBox="0 0 1000 1000" role="presentation" className="rec-face">
      <defs>
        <radialGradient id={id} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--rec-lens-in)" />
          <stop offset="78%" stopColor="var(--rec-lens-out)" />
          <stop offset="100%" stopColor="var(--rec-bg)" />
        </radialGradient>
      </defs>
      <circle cx={C} cy={C} r={R + 40} fill={`url(#${id})`} />
      {/* The outer bezel turns slowly: a tick every 5°, a long one every 30°. */}
      <g className="rec-bezel">
        {Array.from({ length: 72 }, (_, k) => {
          const long = k % 6 === 0;
          const [from, to] = [polar(k * 5, R + 46), polar(k * 5, R + (long ? 76 : 60))];
          return <line key={k} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={long ? "is-long" : undefined} />;
        })}
      </g>
      {RINGS.map((ring) => (
        <g key={ring}>
          <circle cx={C} cy={C} r={out(ring)} className={ring === 1 ? "rec-ring is-edge" : "rec-ring"} />
          <text x={round(C + out(ring) * 0.7071 + 8)} y={round(C - out(ring) * 0.7071 - 8)} className="rec-ring-label">
            {Math.round(ring * 100)}%
          </text>
        </g>
      ))}
      {/* Crosshair: heavy posts from the edge, a fine cross with mil-dots in the middle. */}
      <g className="rec-cross">
        <line x1={C - R} y1={C} x2={C - R * 0.62} y2={C} className="is-post" />
        <line x1={C + R * 0.62} y1={C} x2={C + R} y2={C} className="is-post" />
        <line x1={C} y1={C + R * 0.62} x2={C} y2={C + R} className="is-post" />
        <line x1={C} y1={C - R} x2={C} y2={C - R * 0.62} className="is-post" />
        <line x1={C - R * 0.62} y1={C} x2={C + R * 0.62} y2={C} />
        <line x1={C} y1={C - R * 0.62} x2={C} y2={C + R * 0.62} />
        {[-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].map((k) => (
          <g key={k}>
            <circle cx={C + k * R * 0.1} cy={C} r={3.2} />
            <circle cx={C} cy={C + k * R * 0.1} r={3.2} />
          </g>
        ))}
      </g>
      {children}
      <circle cx={C} cy={C} r={7} className="rec-centre" />
    </svg>
  );
}

/** The lock on a shot: lines through it and a square that snaps in around it. */
export function ScopeLock({ x, y }: { x: number; y: number }) {
  return (
    <g className="rec-lock">
      <line x1={x} y1={0} x2={x} y2={1000} />
      <line x1={0} y1={y} x2={1000} y2={y} />
      <rect x={x - 26} y={y - 26} width={52} height={52} />
    </g>
  );
}
