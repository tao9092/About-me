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

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const m = motion.current;
    if (reduce) m.velocity = 0;
    let frame = 0;
    let last = 0;
    let visible = true;
    let shown = -1;
    const place = () => {
      const rx = Math.min(stage.clientWidth * 0.42, 560);
      const ry = Math.min(stage.clientHeight * 0.17, 92);
      let best = 0;
      let bestCos = -2;
      for (let i = 0; i < n; i += 1) {
        const card = cardRefs.current[i];
        if (!card) continue;
        const theta = m.spin + (i * TAU) / n;
        const s = Math.sin(theta);
        const c = Math.cos(theta);
        const depth = (c + 1) / 2;
        card.style.transform = `translate(-50%,-50%) translate3d(${(s * rx).toFixed(1)}px,${(c * ry).toFixed(1)}px,0) scale(${(0.48 + 0.52 * depth).toFixed(3)}) rotateY(${(-s * 32).toFixed(1)}deg)`;
        card.style.zIndex = String(c > 0 ? 200 + Math.round(c * 100) : Math.round(depth * 100));
        card.style.opacity = (0.22 + 0.78 * depth).toFixed(3);
        card.style.filter = `brightness(${(0.4 + 0.6 * depth).toFixed(3)})`;
        if (c > bestCos) [bestCos, best] = [c, i];
      }
      if (best !== shown) {
        shown = best;
        setFront(best);
      }
    };
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      if (m.target !== null) {
        const step = (m.target - m.spin) * Math.min(1, dt * 7);
        m.spin += step;
        if (Math.abs(m.target - m.spin) < 0.0005) {
          m.spin = m.target;
          m.target = null;
          m.velocity = 0;
        }
      } else if (!m.dragging) {
        const rest = m.hovering || reduce ? 0 : DRIFT;
        m.velocity += (rest - m.velocity) * Math.min(1, dt * 1.6);
        m.spin += m.velocity * dt;
      }
      place();
      frame = visible ? requestAnimationFrame(tick) : 0;
    };
    place();
    frame = requestAnimationFrame(tick);
    const sight = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    });
    sight.observe(stage);
    const resize = new ResizeObserver(place);
    resize.observe(stage);
    return () => {
      cancelAnimationFrame(frame);
      sight.disconnect();
      resize.disconnect();
    };
  }, [n]);

  const down = (event: PointerEvent<HTMLDivElement>) => {
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
  };
  const choose = (event: MouseEvent<HTMLAnchorElement>, index: number) => {
    event.preventDefault();
    const m = motion.current;
    if (m.moved > 6 || busy) return;
    if (index === front) {
      open(items[index].slug, event.currentTarget.getBoundingClientRect());
      return;
    }
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
        onPointerEnter={() => (motion.current.hovering = true)}
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
