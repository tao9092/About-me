import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, LockKeyhole } from "lucide-react";
import { getPublicContent, listContent } from "@/lib/content";
import { sanitizeRichText } from "@/lib/sanitize";
import { CircuitArt } from "@/components/circuit-art";
import { BootFade } from "@/components/lab-card-link";
import { labFont } from "@/components/lab-font";
import { initials, inksFor, pad, TAPE } from "@/lib/project-board";
import "./projects-lab.css";
import "./project-detail.css";

// A project's own page, carrying on from its card on the Projects list: the same
// board, now filling the top of the page and still live, with the title over it;
// a datasheet strip of its facts; the write-up beside a sticky panel of its
// stack and links; then the previous and next projects. A private project's
// board is powered down and crossed with tape, and its title sits on a notice
// over the crossing, in place of the write-up.
export async function ProjectDetail({ slug }: { slug: string }) {
  const [row, rows] = await Promise.all([getPublicContent("projects", slug), listContent("projects", { limit: 200 })]);
  if (!row) notFound();
  const index = Math.max(0, rows.findIndex((item) => item.slug === slug));
  const inks = inksFor([...rows.map((item) => String(item.slug)), slug]);
  const inkFor = (key: string) => inks.get(key) ?? "141,255,240";
  const ink = inkFor(slug);
  const locked = row.visibility === "protected";
  const title = String(row.title_en);
  const stack = Array.isArray(row.tech_stack) ? row.tech_stack.map(String) : [];
  const content = locked ? "" : String(row.content_en ?? "");
  const links = [
    ["Source on GitHub", row.github_url],
    ["Live demo", row.demo_url],
  ].filter((item): item is [string, string] => typeof item[1] === "string" && item[1].length > 0);
  const previous = rows.length > 1 ? rows[(index - 1 + rows.length) % rows.length] : null;
  const next = rows.length > 1 ? rows[(index + 1) % rows.length] : null;
  const facts = [
    ["Board", `P/${pad(index + 1)}`],
    ["Status", locked ? "Private" : "Live"],
    ["Built", String(row.project_date ?? "—")],
    ["Role", locked ? "Classified" : String(row.role ?? "—")],
    ["Stack", `${pad(stack.length)} parts`],
  ];

  return (
    <article className={`pd ${labFont.variable}${locked ? " is-locked" : ""}`} style={{ "--ink": locked ? "255,210,31" : ink } as CSSProperties}>
      <BootFade />
      <header className="pd-hero">
        <div className="pd-board" data-board>
          <CircuitArt slug={slug} label={initials(title)} color={ink} locked={locked} chip={locked ? { x: 0.5, y: 0.5, max: 200 } : { x: 0.72, y: 0.4, max: 230 }} />
          {locked && (
            <div className="lab-tapes pd-tapes" aria-hidden>
              {["a", "b"].map((tape) => (
                <div className={`lab-tape lab-tape-${tape}`} key={tape}>
                  <span>{TAPE.repeat(12)}</span>
                  <span>{TAPE.repeat(12)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="pd-hero-top">
          <Link className="pd-back" href="/projects">
            <ArrowLeft /> All projects
          </Link>
          <span className="pd-chip">
            <b aria-hidden /> P/{pad(index + 1)} · {locked ? "No access" : "Live"}
          </span>
        </div>
        {locked ? (
          <div className="pd-locked-note">
            <LockKeyhole />
            <p className="pd-kicker">{"// private build"}</p>
            <h1>{title}</h1>
            <p>This project is private. Its details aren&apos;t shared publicly.</p>
            {stack.length > 0 && (
              <ul className="pd-stack">
                {stack.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            <Link className="pd-button" href="/projects">
              <ArrowLeft /> Back to projects
            </Link>
          </div>
        ) : (
          <div className="pd-hero-copy">
            <p className="pd-kicker">{"// project"}</p>
            <h1>{title}</h1>
            {Boolean(row.summary_en) && <p className="pd-summary">{String(row.summary_en)}</p>}
          </div>
        )}
      </header>

      <dl className="pd-facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {!locked && (
        <section className="pd-body">
          <aside className="pd-panel">
            <p className="pd-label">Stack</p>
            <ul className="pd-stack">
              {stack.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {links.length > 0 && (
              <>
                <p className="pd-label">Links</p>
                <div className="pd-links">
                  {links.map(([label, url]) => (
                    <a href={url} key={label} target="_blank" rel="noopener noreferrer">
                      {label}
                      <ArrowUpRight />
                    </a>
                  ))}
                </div>
              </>
            )}
          </aside>
          <div className="pd-content">
            {content ? (
              <div className="pd-rich" dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }} />
            ) : (
              <p className="pd-lead">{String(row.summary_en ?? "")}</p>
            )}
          </div>
        </section>
      )}

      {previous && next && (
        <nav className="pd-next" aria-label="More projects">
          {[
            ["Previous", previous, rows.indexOf(previous)],
            ["Next", next, rows.indexOf(next)],
          ].map(([label, item, at]) => {
            const project = item as Record<string, unknown>;
            const position = at as number;
            const isPrivate = project.visibility === "protected";
            return (
              <Link
                href={`/projects/${String(project.slug)}`}
                key={label as string}
                className={label === "Next" ? "is-next" : undefined}
                style={{ "--ink": isPrivate ? "255,210,31" : inkFor(String(project.slug)) } as CSSProperties}
              >
                <span>
                  {label === "Previous" && <ArrowLeft />}
                  {label as string} · P/{pad(position + 1)}
                  {isPrivate && " · Private"}
                  {label === "Next" && <ArrowRight />}
                </span>
                <strong>{String(project.title_en)}</strong>
              </Link>
            );
          })}
        </nav>
      )}
    </article>
  );
}
