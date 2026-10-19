import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { Instrument_Serif } from "next/font/google";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { getPublicContent, listContent } from "@/lib/content";
import { readPlacement, topPercent } from "@/lib/placement";
import { sanitizeRichText } from "@/lib/sanitize";
import { angleFor, ScopeFace, ScopeLock, shotAt } from "@/components/scope-face";
import "./competitions-range.css";
import "./competition-record.css";

// A competition's own page in the Competitions field record's style: it opens
// with the iris widening from the centre (it closed onto this shot on the list);
// the title in serif beside the scope, where this shot is locked among the rest
// of the group; a ledger of the facts; the debrief; the engagements either side.

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--rec-serif" });

const date = (value: unknown) =>
  typeof value === "string" && value
    ? new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : null;
const three = (value: number) => String(value).padStart(3, "0");
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

export async function CompetitionRecord({ slug }: { slug: string }) {
  const [row, all] = await Promise.all([getPublicContent("competitions", slug), listContent("competitions", { limit: 200 })]);
  if (!row) notFound();
  const rows = [...all].sort((a, b) => String(b.competition_date ?? "").localeCompare(String(a.competition_date ?? "")));
  const index = rows.findIndex((item) => item.slug === slug);
  const place = readPlacement(row.placement);
  const title = String(row.title_en);
  const words = title.split(" ");
  const last = words.pop();
  const start = date(row.competition_date);
  const end = date(row.end_date);
  const when = start && end && end !== start ? `${start} – ${end}` : start;
  const facts = [
    ["Date", when],
    ["Location", text(row.location)],
    ["Organiser", text(row.organizer)],
    ["Format", text(row.competition_type)],
    ["Team", text(row.team_name)],
    ["Placement", text(row.placement)],
    ["Award", text(row.award)],
  ].filter((fact): fact is [string, string] => Boolean(fact[1]));
  const content = text(row.content_en);
  const contribution = text(row.contribution_en);
  const links = [
    ["Official website", row.official_url],
    ["Source on GitHub", row.github_url],
    ["Demo", row.demo_url],
  ].filter((link): link is [string, string] => typeof link[1] === "string" && link[1].length > 0);
  const group = rows
    .map((item) => ({ slug: String(item.slug), share: readPlacement(item.placement).share }))
    .filter((item) => item.share !== null);
  const self = place.share !== null ? shotAt(angleFor(slug), place.share) : null;
  const neighbours = index >= 0 && rows.length > 1
    ? ([["Newer", rows[(index - 1 + rows.length) % rows.length]], ["Older", rows[(index + 1) % rows.length]]] as const)
    : [];

  return (
    <article className={`rec rec-record ${serif.variable}`}>
      <div className="rec-iris is-opening" aria-hidden />
      <div className="rec-head-meta rec-record-meta">
        <Link href="/competitions">
          <ArrowLeft /> Field record
        </Link>
        <span>
          Engagement {index >= 0 ? `${String(index + 1).padStart(2, "0")} / ${String(rows.length).padStart(2, "0")}` : "—"}
        </span>
      </div>

      <header className="rec-record-hero">
        <div className="rec-record-copy">
          <p className="rec-record-kicker">{[text(row.competition_type), text(row.organizer)].filter(Boolean).join(" · ") || "Competition"}</p>
          <h1>
            {words.join(" ")} <em>{last}</em>
          </h1>
          {text(row.summary_en) && <p className="rec-record-summary">{text(row.summary_en)}</p>}
        </div>
        <figure className="rec-record-scope">
          <ScopeFace id="rec-record-lens">
            {group.map((item) => {
              const { x, y } = shotAt(angleFor(item.slug), item.share);
              return item.slug === slug ? null : <circle key={item.slug} cx={x} cy={y} r={5} className="rec-record-ghost" />;
            })}
            {self && (
              <>
                <ScopeLock {...self} />
                <g transform={`translate(${self.x} ${self.y})`} className={`rec-shot is-locked${place.share! <= 0.1 ? " is-top" : ""}`}>
                  <g className="rec-shot-body" style={{ "--d": "0.7s" } as CSSProperties}>
                    <circle r={15} className="rec-shot-halo" />
                    <circle r={6.5} className="rec-shot-hole" />
                  </g>
                </g>
              </>
            )}
          </ScopeFace>
          <figcaption>
            {place.rank !== null ? (
              <strong>
                #{three(place.rank)}
                {place.field !== null && <small> / {place.field}</small>}
              </strong>
            ) : (
              <strong>Unranked</strong>
            )}
            <em>{place.share !== null ? `Top ${topPercent(place.share)} of the field` : "Not ranked against a field"}</em>
          </figcaption>
        </figure>
      </header>

      {facts.length > 0 && (
        <dl className="rec-record-facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <section className="rec-record-body">
        <aside>
          <p>Debrief</p>
          {links.length > 0 && (
            <div className="rec-record-links">
              {links.map(([label, url]) => (
                <a href={url} key={label} target="_blank" rel="noopener noreferrer">
                  {label} <ArrowUpRight />
                </a>
              ))}
            </div>
          )}
        </aside>
        <div className="rec-record-rich">
          {content ? (
            <div dangerouslySetInnerHTML={{ __html: sanitizeRichText(/<[a-z]/i.test(content) ? content : `<p>${content}</p>`) }} />
          ) : (
            <p>{text(row.summary_en) ?? "No debrief written yet."}</p>
          )}
          {contribution && (
            <>
              <h2>My part</h2>
              <div dangerouslySetInnerHTML={{ __html: sanitizeRichText(/<[a-z]/i.test(contribution) ? contribution : `<p>${contribution}</p>`) }} />
            </>
          )}
        </div>
      </section>

      {neighbours.length > 0 && (
        <nav className="rec-record-next" aria-label="More competitions">
          {neighbours.map(([label, item]) => {
            const other = readPlacement(item.placement);
            return (
              <Link href={`/competitions/${String(item.slug)}`} key={label} className={label === "Older" ? "is-older" : undefined}>
                <span>
                  {label === "Newer" && <ArrowLeft />}
                  {label} · {date(item.competition_date) ?? "—"}
                  {label === "Older" && <ArrowRight />}
                </span>
                <strong>{String(item.title_en)}</strong>
                <em>
                  {other.rank !== null ? `#${three(other.rank)}` : "—"}
                  {other.field !== null && ` / ${other.field}`}
                  {other.share !== null && ` · Top ${topPercent(other.share)}`}
                </em>
              </Link>
            );
          })}
        </nav>
      )}
    </article>
  );
}
