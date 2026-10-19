"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState, type CSSProperties, type MouseEvent } from "react";
import { ArrowUpRight, LockKeyhole, Search } from "lucide-react";

// The catalogue under the black hole: every record, grouped by collection and
// searchable as you type. Choosing one falls in: a dark disc ringed with light
// spreads out from it, like crossing the horizon, before its page opens.

export type Entry = { id: string; title: string; detail: string; date: string; href: string; external: boolean; locked: boolean };
export type Section = { title: string; href: string; entries: Entry[] };

const FALL_MS = 620;
const year = (date: string) => (date ? date.slice(0, 7).replace("-", " · ") : "");

export function HorizonIndex({ sections }: { sections: Section[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim().toLowerCase());
  const [fall, setFall] = useState<{ x: number; y: number } | null>(null);
  const matches = (entry: Entry) => !deferred || `${entry.title} ${entry.detail}`.toLowerCase().includes(deferred);
  const found = sections.reduce((sum, section) => sum + section.entries.filter(matches).length, 0);

  const enter = (event: MouseEvent<HTMLAnchorElement>, entry: Entry) => {
    if (entry.external || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (fall) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(entry.href);
      return;
    }
    setFall({ x: event.clientX || window.innerWidth / 2, y: event.clientY || window.innerHeight / 2 });
    router.prefetch(entry.href);
    window.setTimeout(() => router.push(entry.href), FALL_MS);
  };

  return (
    <section className="hz-catalogue" aria-label="Everything in the hub">
      <label className="hz-search">
        <Search aria-hidden />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search everything…" aria-label="Search everything" />
        <span>{deferred ? `${found} found` : `${found} records`}</span>
      </label>
      <div className="hz-sections">
        {sections.map((section) => {
          const shown = section.entries.filter(matches);
          if (deferred && shown.length === 0) return null;
          return (
            <section className={`hz-section${section.entries.length === 0 ? " is-empty" : ""}`} key={section.title}>
              <header>
                <Link href={section.href}>
                  <h2>{section.title}</h2>
                  <ArrowUpRight aria-hidden />
                </Link>
                <span>{String(section.entries.length).padStart(2, "0")}</span>
              </header>
              {section.entries.length === 0 ? (
                <p className="hz-empty">Nothing has crossed in yet.</p>
              ) : (
                <ol>
                  {shown.map((entry, index) => {
                    return (
                      <li key={entry.id} style={{ "--i": Math.min(index, 30) } as CSSProperties}>
                        <a
                          href={entry.href}
                          onClick={(event) => enter(event, entry)}
                          {...(entry.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        >
                          <span className="hz-entry-title">
                            {entry.locked && <LockKeyhole aria-label="Private" />}
                            {entry.title}
                          </span>
                          <span className="hz-entry-detail">{entry.detail}</span>
                          <span className="hz-entry-date">{year(entry.date)}</span>
                        </a>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          );
        })}
        {deferred && found === 0 && <p className="hz-none">Nothing out there matches “{query}”.</p>}
      </div>
      {fall && <div className="hz-fall" style={{ "--x": `${fall.x}px`, "--y": `${fall.y}px` } as CSSProperties} aria-hidden />}
    </section>
  );
}
