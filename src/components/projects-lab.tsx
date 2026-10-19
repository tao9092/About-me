import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { listContent } from "@/lib/content";
import { CircuitArt } from "@/components/circuit-art";
import { EmptyState } from "@/components/ui";
import { initials, inkFor, pad, TAPE } from "@/lib/project-board";
import "./projects-lab.css";

// The Projects page as a fabrication lab, after its transition's circuit board:
// a terminal readout and search, and a board per project, live with signals;
// private projects are powered down and taped off.

export async function ProjectsLab({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const q = (await searchParams)?.q;
  const rows = await listContent("projects", { q });
  const locked = rows.filter((row) => row.visibility === "protected").length;
  const latest = rows.map((row) => String(row.project_date ?? "")).filter(Boolean).sort().at(-1);
  return (
    <div className="lab">
      <header className="lab-head">
        <p className="lab-kicker">
          <span>02</span> {"// fabrication lab"}
          <i aria-hidden />
        </p>
        <h1 className="lab-title">Projects</h1>
        <p className="lab-lead">Selected products and experiments, from useful systems to bold prototypes.</p>
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
            return (
              <article
                className={`lab-card${isLocked ? " is-locked" : ""}`}
                data-board
                key={String(row.id)}
                style={{ "--ink": inkFor(index), "--i": index } as CSSProperties}
              >
                <div className="lab-board">
                  <CircuitArt slug={String(row.slug)} label={initials(title)} color={inkFor(index)} locked={isLocked} />
                  <span className="lab-tag lab-tag-start">P/{pad(index + 1)}</span>
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
                    <span>{pad(index + 1)}</span>
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
                <Link className="stretched-link" href={`/projects/${String(row.slug)}`}>
                  <span className="sr-only">
                    {isLocked ? "Private project: " : "View "}
                    {title}
                  </span>
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
