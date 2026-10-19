"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type MouseEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { topPercent } from "@/lib/placement";
import { ScopeFace, ScopeLock, shotAt } from "@/components/scope-face";

// The scope and the log, locked together: pointing at a shot on the target
// picks out its line in the log, and pointing at a line puts the crosshair on
// its shot. Filters thin the log and dim the shots they leave out. Choosing one
// fires: an iris closes onto its shot, crosshairs converging, before its page
// opens (it opens again from the centre there, CompetitionRecord).

export type Shot = {
  slug: string;
  title: string;
  date: string;
  end: string | null;
  organizer: string | null;
  location: string | null;
  team: string | null;
  award: string | null;
  rank: number | null;
  field: number | null;
  share: number | null;
  note: string | null;
  angle: number;
};

const FILTERS = [
  ["all", "All"],
  ["top10", "Top 10%"],
  ["top25", "Top 25%"],
  ["onsite", "On site"],
] as const;
type Filter = (typeof FILTERS)[number][0];
const keeps: Record<Filter, (shot: Shot) => boolean> = {
  all: () => true,
  top10: (shot) => shot.share !== null && shot.share <= 0.1,
  top25: (shot) => shot.share !== null && shot.share <= 0.25,
  onsite: (shot) => Boolean(shot.location) && !/online/i.test(shot.location!),
};

const day = (date: string) =>
  date ? new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }) : "—";
const three = (value: number) => String(value).padStart(3, "0");
const at = (shot: Shot) => shotAt(shot.angle, shot.share);
const IRIS_MS = 680;

export function RangeBoard({ shots, best }: { shots: Shot[]; best: string | null }) {
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [firing, setFiring] = useState<{ x: number; y: number } | null>(null);
  const kept = shots.filter(keeps[filter]);
  const locked = shots.find((shot) => shot.slug === (active ?? best)) ?? null;
  const plotted = shots.filter((shot) => shot.share !== null);

  /** Closes the iris on the shot (or on the click, for one off the target), then opens its page. */
  function fire(event: MouseEvent<Element>, slug: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const href = `/competitions/${slug}`;
    if (firing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(href);
      return;
    }
    const hole = document.querySelector(`[data-shot="${slug}"] .rec-shot-hole`)?.getBoundingClientRect();
    const onScreen = hole && hole.top > 0 && hole.bottom < window.innerHeight;
    const own = event.currentTarget.getBoundingClientRect();
    setActive(slug);
    setFiring(
      onScreen
        ? { x: hole.left + hole.width / 2, y: hole.top + hole.height / 2 }
        : { x: event.clientX || own.left + own.width / 2, y: event.clientY || own.top + own.height / 2 },
    );
    router.prefetch(href);
    window.setTimeout(() => router.push(href), IRIS_MS);
  }

  return (
    <div className="rec-board" onMouseLeave={() => !firing && setActive(null)}>
      <figure className="rec-scope" aria-label="Every ranked competition as a shot on a target; nearer the centre is a higher finish">
        <ScopeFace id="rec-lens">
          {locked && locked.share !== null && <ScopeLock key={locked.slug} {...at(locked)} />}
          {plotted.map((shot, index) => {
            const { x, y } = at(shot);
            const dim = !keeps[filter](shot);
            const classes = ["rec-shot", shot.share! <= 0.1 ? "is-top" : "", shot.slug === locked?.slug ? "is-locked" : "", dim ? "is-dim" : ""];
            return (
              <Link
                href={`/competitions/${shot.slug}`}
                key={shot.slug}
                data-shot={shot.slug}
                onClick={(event) => fire(event, shot.slug)}
                className={classes.filter(Boolean).join(" ")}
                style={{ "--d": `${0.4 + index * 0.05}s` } as CSSProperties}
                onMouseEnter={() => !firing && setActive(shot.slug)}
                onFocus={() => setActive(shot.slug)}
                aria-label={`${shot.title}: ${shot.rank} of ${shot.field}`}
              >
                <g transform={`translate(${x} ${y})`}>
                  <g className="rec-shot-body">
                    <circle r={15} className="rec-shot-halo" />
                    <circle r={6.5} className="rec-shot-hole" />
                  </g>
                </g>
              </Link>
            );
          })}
        </ScopeFace>
        <figcaption className="rec-readout" aria-live="polite">
          {locked ? (
            <>
              <span>{active ? "Locked" : "Best finish"}</span>
              <strong>{locked.title}</strong>
              <em>
                {locked.rank !== null ? `#${three(locked.rank)}` : "Unranked"}
                {locked.field !== null && ` / ${locked.field}`}
                {locked.share !== null && ` · Top ${topPercent(locked.share)}`}
              </em>
            </>
          ) : (
            <span>No ranked engagements yet</span>
          )}
        </figcaption>
      </figure>

      <section className="rec-log" aria-label="Engagement log">
        <div className="rec-filters" role="tablist">
          {FILTERS.map(([key, label]) => (
            <button
              type="button"
              role="tab"
              aria-selected={filter === key}
              key={key}
              onClick={() => setFilter(key)}
              className={filter === key ? "is-on" : undefined}
            >
              {label}
              <sup>{shots.filter(keeps[key]).length}</sup>
            </button>
          ))}
        </div>
        <ol>
          {kept.map((shot) => (
            <li key={shot.slug} className={shot.slug === locked?.slug && active ? "is-locked" : undefined}>
              <Link
                href={`/competitions/${shot.slug}`}
                onMouseEnter={() => !firing && setActive(shot.slug)}
                onFocus={() => setActive(shot.slug)}
                onClick={(event) => fire(event, shot.slug)}
              >
                <span className="rec-log-date">{day(shot.date)}</span>
                <span className="rec-log-name">
                  <strong>{shot.title}</strong>
                  <small>
                    {[shot.organizer, shot.location, shot.note ?? shot.award].filter(Boolean).join(" · ") || "—"}
                  </small>
                </span>
                <span className="rec-log-rank">
                  {shot.rank !== null ? <b>{three(shot.rank)}</b> : <b>—</b>}
                  {shot.field !== null && <i>/{shot.field}</i>}
                </span>
                <span className="rec-log-meter" aria-hidden>
                  {shot.share !== null && <i style={{ left: `${Math.min(100, shot.share * 100)}%` }} />}
                </span>
                <span className="rec-log-top">{shot.share !== null ? `Top ${topPercent(shot.share)}` : "—"}</span>
                <ArrowUpRight aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
        {kept.length === 0 && <p className="rec-empty">Nothing here yet.</p>}
      </section>
      {firing && (
        <div className="rec-iris is-closing" style={{ "--x": `${firing.x}px`, "--y": `${firing.y}px` } as CSSProperties} aria-hidden>
          <i />
          <i />
        </div>
      )}
    </div>
  );
}
