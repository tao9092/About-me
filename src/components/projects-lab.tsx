import type { CSSProperties } from "react";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { listContent } from "@/lib/content";
import { CircuitArt } from "@/components/circuit-art";
import { LabCardLink } from "@/components/lab-card-link";
import { labFont } from "@/components/lab-font";
import { Motherboard } from "@/components/motherboard";
import { EmptyState } from "@/components/ui";
import { initials, inksFor, pad, TAPE } from "@/lib/project-board";
import "./projects-lab.css";

// The Projects page as a fabrication lab, after its transition's circuit board:
// graphite and live-signal mint, a technical face (Space Grotesk) over mono.
// The hero is a motherboard carrying every project's chip; below, a bento of
// cards, each topped with the project's own live board. Pointing at a card
// lights its chip on the motherboard; choosing one dives into its board.
// Private projects are powered down and taped off.

/** Card widths on a 12-column grid: rows of two (7 + 5, then 5 + 7) and of
 * three (4 + 4 + 4) in turn, and a last card left alone across the full width. */
function spans(count: number) {
  const out: number[] = [];
  for (let row = 0; out.length < count; row += 1) {
    const left = count - out.length;
    if (left === 1) out.push(12);
    else if (left === 2 || row % 2 === 0) out.push(...(Math.floor(row / 2) % 2 ? [5, 7] : [7, 5]));
    else out.push(4, 4, 4);
  }
  return out;
}

export async function ProjectsLab({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const q = (await searchParams)?.q;
  const rows = await listContent("projects", { q, limit: 200 });
  const all = q ? await listContent("projects", { limit: 200 }) : rows;
  const locked = rows.filter((row) => row.visibility === "protected").length;
  const latest = rows.map((row) => String(row.project_date ?? "")).filter(Boolean).sort().at(-1);
  const place = (slug: unknown) => Math.max(0, all.findIndex((row) => row.slug === slug));
  const inks = inksFor(all.map((row) => String(row.slug)));
  const inkFor = (slug: string) => inks.get(slug) ?? "141,255,240";
  const chips = all.map((row) => ({
    slug: String(row.slug),
    label: initials(String(row.title_en)),
    color: inkFor(String(row.slug)),
    locked: row.visibility === "protected",
  }));
  const widths = spans(rows.length);

  return (
    <div className={`lab ${labFont.variable}`}>
      <header className="lab-hero">
        <Motherboard chips={chips} />
        <div className="lab-hero-copy">
          <p className="lab-kicker">
            <span>02</span> {"// fabrication lab"}
            <i aria-hidden />
          </p>
          <h1 className="lab-title">Projects</h1>
          <p className="lab-lead">Selected products and experiments, from useful systems to bold prototypes. Every one has its own board.</p>
        </div>
        <dl className="lab-readout">
          <div>
            <dt>Boards</dt>
            <dd>{pad(rows.length)}</dd>
          </div>
          <div>
            <dt>Live</dt>
            <dd>{pad(rows.length - locked)}</dd>
          </div>
          <div>
            <dt>Private</dt>
            <dd>{pad(locked)}</dd>
          </div>
          <div>
            <dt>Latest build</dt>
            <dd>{latest ?? "—"}</dd>
          </div>
        </dl>
      </header>
      <form className="lab-search" role="search">
        <label htmlFor="q">
          <span aria-hidden>$</span> grep -i
        </label>
        <input id="q" name="q" defaultValue={q} placeholder="search projects…" autoComplete="off" />
        <button type="submit">Run ⏎</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState
          title={q ? "No search results" : "No published projects yet."}
          description={q ? "Try a broader keyword or clear the search." : "Published items will appear here when they are ready."}
          action={q ? "Clear search" : undefined}
          href="/projects"
        />
      ) : (
        <div className="lab-grid">
          {rows.map((row, index) => {
            const isLocked = row.visibility === "protected";
            const title = String(row.title_en);
            const stack = Array.isArray(row.tech_stack) ? row.tech_stack.map(String) : [];
            const number = place(row.slug) + 1;
            const color = inkFor(String(row.slug));
            return (
              <article
                className={`lab-card${isLocked ? " is-locked" : ""}${widths[index] === 12 ? " is-wide" : ""}`}
                data-board
                key={String(row.id)}
                style={{ "--ink": color, "--i": index, "--span": widths[index] } as CSSProperties}
              >
                <div className="lab-board">
                  <CircuitArt slug={String(row.slug)} label={initials(title)} color={color} locked={isLocked} />
                  <span className="lab-tag lab-tag-start">P/{pad(number)}</span>
                  <span className="lab-tag lab-tag-end">
                    <b aria-hidden /> {isLocked ? "No access" : "Live"}
                  </span>
                  {isLocked && (
                    <div className="lab-tapes" aria-hidden>
                      {["a", "b"].map((tape) => (
                        <div className={`lab-tape lab-tape-${tape}`} key={tape}>
                          <span>{TAPE.repeat(8)}</span>
                          <span>{TAPE.repeat(8)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="lab-info">
                  <div className="lab-meta">
                    <span>{pad(number)}</span>
                    {Boolean(row.project_date) && <span>{String(row.project_date)}</span>}
                    {isLocked ? (
                      <span className="lab-private">
                        <LockKeyhole /> Private
                      </span>
                    ) : (
                      Boolean(row.role) && <span>{String(row.role)}</span>
                    )}
                  </div>
                  <h2>{title}</h2>
                  {Boolean(row.summary_en) && <p>{String(row.summary_en)}</p>}
                  {stack.length > 0 && (
                    <ul className="lab-stack">
                      {stack.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <ArrowUpRight className="lab-arrow" aria-hidden />
                <LabCardLink slug={String(row.slug)} label={initials(title)} color={isLocked ? "255,210,31" : color}>
                  <span className="sr-only">
                    {isLocked ? "Private project: " : "View "}
                    {title}
                  </span>
                </LabCardLink>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
