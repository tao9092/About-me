"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { ArrowUpRight, BadgeCheck } from "lucide-react";

// The certificates in orbit round a backlit Saturn: each rides the tilted ring
// plane, nearer and brighter at the front, passing behind the planet at the
// back. It turns slowly on its own, stops under the pointer, and can be dragged
// round with a little momentum. Choosing the front certificate (or a plate in
// the archive) sends a burst of sunlight out from it into its page, where the
// light settles (CertificateRecord); choosing another brings it round first.

export type Credential = { slug: string; title: string; issuer: string | null; date: string | null; image: string | null; verify: string | null };

const TAU = Math.PI * 2;
const DRIFT = 0.1; // radians a second, turning on its own
const BURST_MS = 640;
const day = (date: string | null) =>
  date ? new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";

/** Lights up from where a certificate was chosen, then opens its page. */
function useBurst() {
  const router = useRouter();
  const [burst, setBurst] = useState<{ x: number; y: number } | null>(null);
  function open(slug: string, from: DOMRect) {
    const href = `/certificates/${slug}`;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(href);
      return;
    }
    setBurst({ x: from.left + from.width / 2, y: from.top + from.height / 2 });
    router.prefetch(href);
    window.setTimeout(() => router.push(href), BURST_MS);
  }
  const flash = burst && <div className="sky-burst" style={{ "--x": `${burst.x}px`, "--y": `${burst.y}px` } as CSSProperties} aria-hidden />;
  return { open, flash, busy: Boolean(burst) };
}

function Face({ item }: { item: Credential }) {
  return item.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.image} alt="" draggable={false} loading="lazy" />
  ) : (
    <span className="sky-blank">{item.title}</span>
  );
}

export function OrbitCarousel({ items }: { items: Credential[] }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const motion = useRef({ spin: 0, velocity: DRIFT, target: null as number | null, dragging: false, hovering: false, moved: 0, startX: 0, startSpin: 0, lastX: 0, lastT: 0 });
  const [front, setFront] = useState(0);
  const { open, flash, busy } = useBurst();
  const n = items.length;

  // Each card's look round the ring is a fixed function of its angle, so it is
  // laid down once as a keyframed loop of a full turn. While the ring drifts at
  // its steady pace those loops play on the compositor and the page's thread
  // does nothing per frame; while it is dragged, slowed under the pointer or
  // brought round to a card, each frame sets the loops' time to the spin
  // instead. Which card is in front, and the stacking order, only change when
  // two cards pass at equal depth or one crosses the planet's plane, so those
  // moments are worked out ahead and the order is set only then.
  const wake = useRef<() => void>(() => {});

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const m = motion.current;
    if (reduce) m.velocity = 0;
    const cards = cardRefs.current.slice(0, n);
    const TURN = (TAU / DRIFT) * 1000; // ms for one turn at the drifting pace
    const angle = (i: number) => (i * TAU) / n;
    const wrap = (value: number, span: number) => ((value % span) + span) % span;
    let rx = 0;
    let ry = 0;
    const measure = () => {
      rx = Math.min(stage.clientWidth * 0.42, 560);
      ry = Math.min(stage.clientHeight * 0.17, 92);
    };
    const STEPS = 360; // a keyframe a degree: within a hundredth of a pixel of the true curve
    const keyframes = (): Keyframe[] =>
      Array.from({ length: STEPS + 1 }, (_, k) => {
        const theta = (k / STEPS) * TAU;
        const s = Math.sin(theta);
        const c = Math.cos(theta);
        const depth = (c + 1) / 2;
        return {
          offset: k / STEPS,
          transform: `translate(-50%,-50%) translate3d(${(s * rx).toFixed(2)}px,${(c * ry).toFixed(2)}px,0) scale(${(0.48 + 0.52 * depth).toFixed(4)}) rotateY(${(-s * 32).toFixed(2)}deg)`,
          opacity: (0.22 + 0.78 * depth).toFixed(4),
          filter: `brightness(${(0.4 + 0.6 * depth).toFixed(4)})`,
        };
      });
    measure();
    const frames = keyframes();
    const loops = cards.map((card) => card?.animate(frames, { duration: TURN, iterations: Infinity, easing: "linear", fill: "both" }) ?? null);
    loops.forEach((loop) => loop?.pause());
    const lead = loops.find((loop) => loop !== null) ?? null;

    let playing: { spin: number; time: number } | null = null;
    const spinNow = () => (playing && lead ? playing.spin + ((Number(lead.currentTime) - playing.time) / TURN) * TAU : m.spin);
    const setSpin = (spin: number) => {
      loops.forEach((loop, i) => {
        if (loop) loop.currentTime = (wrap(spin + angle(i), TAU) / TAU) * TURN;
      });
    };

    // Stacking: each card's depth key puts it in front of the planet (z-index
    // 150) on the near half of the ring and behind it on the far half, the
    // later card on top at an equal key. Only the order matters, so each card
    // gets its rank in it, which holds still while the keys themselves creep.
    const layout = (spin: number) => {
      const depths = cards.map((_, i) => Math.cos(spin + angle(i)));
      const keys = depths.map((c) => (c > 0 ? 200 + Math.round(c * 100) : Math.round(((c + 1) / 2) * 100)));
      const order = keys.map((_, i) => i).sort((a, b) => keys[a] - keys[b] || a - b);
      const best = depths.reduce((top, c, i) => (c > depths[top] ? i : top), 0);
      return { keys, order, best, id: `${order.map((i) => (keys[i] > 150 ? `+${i}` : i)).join()}|${best}` };
    };
    let shown = -1;
    const stack = (spin: number) => {
      const { keys, order, best } = layout(spin);
      let near = 0;
      let far = 0;
      for (const i of order) {
        const z = String(keys[i] > 150 ? 200 + near++ : far++);
        const card = cards[i];
        if (card && card.style.zIndex !== z) card.style.zIndex = z;
      }
      if (best !== shown) {
        shown = best;
        setFront(best);
      }
    };
    // How much further the ring turns before the stacking or the front card
    // next changes: stepped under a frame's drift at a time, then pinned by halving.
    const untilRestack = (spin: number) => {
      const STEP = 0.0015;
      const now = layout(spin).id;
      for (let ahead = STEP; ahead < TAU; ahead += STEP) {
        if (layout(spin + ahead).id === now) continue;
        let lo = ahead - STEP;
        let hi = ahead;
        while (hi - lo > 1e-6) {
          const mid = (lo + hi) / 2;
          if (layout(spin + mid).id === now) lo = mid;
          else hi = mid;
        }
        return hi;
      }
      return TAU;
    };

    let frame = 0;
    let timer = 0;
    let last = 0;
    let visible = true;
    const restackLater = () => {
      const spin = spinNow();
      stack(spin);
      timer = window.setTimeout(restackLater, (untilRestack(spin) / DRIFT) * 1000 + 1);
    };
    const drift = () => {
      if (!lead) return;
      setSpin(m.spin);
      playing = { spin: m.spin, time: Number(lead.currentTime) };
      loops.forEach((loop) => loop?.play());
      restackLater();
    };
    const hold = () => {
      if (playing) {
        m.spin = spinNow();
        loops.forEach((loop) => loop?.pause());
        playing = null;
        setSpin(m.spin);
      }
      window.clearTimeout(timer);
      timer = 0;
    };
    const tick = (now: number) => {
      frame = 0;
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      const rest = m.hovering || reduce ? 0 : DRIFT;
      if (m.target !== null) {
        const step = (m.target - m.spin) * Math.min(1, dt * 7);
        m.spin += step;
        if (Math.abs(m.target - m.spin) < 0.0005) {
          m.spin = m.target;
          m.target = null;
          m.velocity = 0;
        }
      } else if (!m.dragging) {
        m.velocity += (rest - m.velocity) * Math.min(1, dt * 1.6);
        m.spin += m.velocity * dt;
      }
      setSpin(m.spin);
      stack(m.spin);
      // Settled at its resting pace (what is left of the approach would move a
      // card by under a hundredth of a pixel): hand the drift to the
      // compositor, or stand still.
      if (m.target === null && !m.dragging && Math.abs(rest - m.velocity) < 1e-4) {
        m.velocity = rest;
        last = 0;
        if (rest > 0) drift();
        return;
      }
      if (visible) frame = requestAnimationFrame(tick);
    };
    wake.current = () => {
      hold();
      if (!visible || frame) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };
    setSpin(m.spin);
    stack(m.spin);
    wake.current();

    const sight = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake.current();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
        hold();
      }
    });
    sight.observe(stage);
    const resize = new ResizeObserver(() => {
      const at = spinNow();
      measure();
      const next = keyframes();
      loops.forEach((loop) => (loop?.effect as KeyframeEffect | null)?.setKeyframes(next));
      if (!playing) setSpin(at);
    });
    resize.observe(stage);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      sight.disconnect();
      resize.disconnect();
      loops.forEach((loop) => loop?.cancel());
      wake.current = () => {};
    };
  }, [n]);

  const down = (event: PointerEvent<HTMLDivElement>) => {
    wake.current();
    const m = motion.current;
    Object.assign(m, { dragging: true, moved: 0, startX: event.clientX, startSpin: m.spin, lastX: event.clientX, lastT: performance.now(), target: null });
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const m = motion.current;
    if (!m.dragging) return;
    const stage = stageRef.current!;
    const scale = Math.min(stage.clientWidth * 0.42, 560);
    m.moved = Math.max(m.moved, Math.abs(event.clientX - m.startX));
    if (m.moved > 6 && !stage.hasPointerCapture(event.pointerId)) stage.setPointerCapture(event.pointerId);
    m.spin = m.startSpin + ((event.clientX - m.startX) / scale) * 1.1;
    const now = performance.now();
    if (now > m.lastT) m.velocity = (((event.clientX - m.lastX) / scale) * 1.1) / ((now - m.lastT) / 1000);
    m.lastX = event.clientX;
    m.lastT = now;
  };
  const up = () => {
    const m = motion.current;
    m.dragging = false;
    m.velocity = Math.max(-3, Math.min(3, m.velocity));
    wake.current();
  };
  const choose = (event: MouseEvent<HTMLAnchorElement>, index: number) => {
    event.preventDefault();
    const m = motion.current;
    if (m.moved > 6 || busy) return;
    if (index === front) {
      open(items[index].slug, event.currentTarget.getBoundingClientRect());
      return;
    }
    wake.current();
    // Round to the front by the shorter way.
    const goal = -(index * TAU) / n;
    const turns = Math.round((m.spin - goal) / TAU);
    m.target = goal + turns * TAU;
  };
  const current = items[front];

  return (
    <section className="sky-orbit" aria-label="Certificates in orbit">
      <div
        className="sky-stage"
        ref={stageRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerEnter={() => {
          motion.current.hovering = true;
          wake.current();
        }}
        onPointerLeave={() => {
          motion.current.hovering = false;
          up();
        }}
      >
        <div className="sky-planet" aria-hidden>
          <i className="sky-corona" />
          <i className="sky-ring" />
          <i className="sky-body" />
          <i className="sky-glint" />
        </div>
        {items.map((item, index) => (
          <a
            key={item.slug}
            href={`/certificates/${item.slug}`}
            ref={(element) => {
              cardRefs.current[index] = element;
            }}
            className={`sky-card${index === front ? " is-front" : ""}`}
            onClick={(event) => choose(event, index)}
            aria-label={index === front ? `Open ${item.title}` : `Bring ${item.title} to the front`}
            draggable={false}
          >
            <Face item={item} />
          </a>
        ))}
      </div>
      {current && (
        <div className="sky-caption" aria-live="polite">
          <span>
            {String(front + 1).padStart(2, "0")} / {String(n).padStart(2, "0")} · {day(current.date)}
          </span>
          <strong>{current.title}</strong>
          <em>{current.issuer ?? "—"}</em>
          <div>
            <Link href={`/certificates/${current.slug}`}>
              View certificate <ArrowUpRight />
            </Link>
            {current.verify && (
              <a href={current.verify} target="_blank" rel="noopener noreferrer">
                <BadgeCheck /> Verify
              </a>
            )}
          </div>
        </div>
      )}
      {flash}
    </section>
  );
}

/** The archive: every certificate as a framed plate, a glare following the pointer across it. */
export function CertificatePlates({ items }: { items: Credential[] }) {
  const { open, flash, busy } = useBurst();
  const glare = (event: PointerEvent<HTMLAnchorElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--gx", `${(((event.clientX - box.left) / box.width) * 100).toFixed(1)}%`);
    event.currentTarget.style.setProperty("--gy", `${(((event.clientY - box.top) / box.height) * 100).toFixed(1)}%`);
  };
  return (
    <>
      <ol className="sky-plates">
        {items.map((item, index) => (
          <li key={item.slug} style={{ "--i": index } as CSSProperties}>
            <a
              href={`/certificates/${item.slug}`}
              onPointerMove={glare}
              onClick={(event) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
                event.preventDefault();
                if (!busy) open(item.slug, event.currentTarget.querySelector(".sky-plate-frame")!.getBoundingClientRect());
              }}
            >
              <span className="sky-plate-frame">
                <Face item={item} />
              </span>
              <span className="sky-plate-meta">
                <span>{item.issuer ?? "—"}</span>
                <strong>{item.title}</strong>
                <em>
                  {day(item.date)}
                  {item.verify && " · Verifiable"}
                </em>
              </span>
            </a>
          </li>
        ))}
      </ol>
      {flash}
    </>
  );
}
