import { Big_Shoulders } from "next/font/google";
import { listContent } from "@/lib/content";
import { sanitizeRichText } from "@/lib/sanitize";
import { FlapText, Line, StationClock } from "@/components/express-board";
import "./experience-line.css";

// The Experience page as a night railway timetable, after its transition's
// night express: midnight and amber, transit lettering. A split-flap departure
// board lists every role as a service; below runs the line, a stop for each,
// with a train riding down it as the page scrolls.

const signage = Big_Shoulders({ subsets: ["latin"], weight: ["300", "500", "700", "800"], variable: "--xp-sign" });

const CLASS: Record<string, string> = { work: "Work", internship: "Internship", club: "Society", volunteer: "Volunteer", event: "Event" };
const month = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
/** "1 yr 3 mo" from a start to an end (or to today). */
function span(start: string, end: string | null) {
  const from = new Date(`${start}T00:00:00Z`);
  const to = end ? new Date(`${end}T00:00:00Z`) : new Date();
  const months = Math.max(1, (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth() + (end ? 1 : 0));
  const years = Math.floor(months / 12);
  return [years && `${years} yr`, months % 12 && `${months % 12} mo`].filter(Boolean).join(" ");
}

export async function ExperienceLine() {
  const rows = (await listContent("experiences", { limit: 100 })).sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
  const current = rows.filter((row) => row.is_current).length;
  const first = rows.map((row) => String(row.start_date)).sort()[0];

  return (
    <div className={`xp ${signage.variable}`}>
      <header className="xp-head">
        <p className="xp-kicker">
          <span>05</span> Night express · a year in every window
        </p>
        <h1>Experience</h1>
      </header>

      <section className="xp-board" aria-label="Departures">
        <div className="xp-board-top">
          <strong>Departures</strong>
          <span>
            {String(rows.length).padStart(2, "0")} services · {current} running
          </span>
          <StationClock />
        </div>
        <div className="xp-board-row xp-board-labels" aria-hidden>
          <span>Since</span>
          <span>Service</span>
          <span>Destination</span>
          <span>Class</span>
          <span>Status</span>
        </div>
        {rows.length === 0 && <p className="xp-board-empty">No services today.</p>}
        {rows.map((row, index) => (
          <a className="xp-board-row" href={`#${String(row.slug)}`} key={String(row.id)}>
            <span>
              <FlapText text={month(String(row.start_date))} delay={index * 140} />
            </span>
            <span>
              <FlapText text={String(row.position)} delay={index * 140 + 60} />
            </span>
            <span>
              <FlapText text={String(row.organization)} delay={index * 140 + 120} />
            </span>
            <span>
              <FlapText text={CLASS[String(row.experience_type)] ?? "Service"} delay={index * 140 + 180} />
            </span>
            <span className={row.is_current ? "is-live" : undefined}>
              <FlapText text={row.is_current ? "On board" : "Arrived"} delay={index * 140 + 240} />
            </span>
          </a>
        ))}
      </section>

      <div className="xp-line-head">
        <h2>The line</h2>
        <span>{first ? `From ${month(first)} to now` : ""}</span>
      </div>
      <Line>
        {rows.map((row) => {
          const start = String(row.start_date);
          const end = row.end_date ? String(row.end_date) : null;
          const skills = Array.isArray(row.skills) ? row.skills.map(String) : [];
          const content = typeof row.content_en === "string" ? row.content_en.trim() : "";
          return (
            <article className="xp-stop" id={String(row.slug)} data-stop key={String(row.id)}>
              <div className="xp-stop-when">
                <strong>{start.slice(0, 4)}</strong>
                <span>
                  {month(start)} — {row.is_current ? "now" : end ? month(end) : "—"}
                </span>
                <em>{span(start, row.is_current ? null : end)}</em>
              </div>
              <div className="xp-stop-body">
                <p className="xp-stop-class">
                  {CLASS[String(row.experience_type)] ?? "Service"}
                  {Boolean(row.is_current) && <b>On board</b>}
                </p>
                <h3>{String(row.position)}</h3>
                <p className="xp-stop-org">{String(row.organization)}</p>
                {Boolean(row.summary_en) && <p className="xp-stop-summary">{String(row.summary_en)}</p>}
                {skills.length > 0 && (
                  <ol className="xp-stop-skills" aria-label="Skills">
                    {skills.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ol>
                )}
                {content && (
                  <details className="xp-stop-log">
                    <summary>Read the log</summary>
                    <div dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }} />
                  </details>
                )}
                {Boolean(row.related_url) && (
                  <a className="xp-stop-link" href={String(row.related_url)} target="_blank" rel="noopener noreferrer">
                    Visit ↗
                  </a>
                )}
              </div>
            </article>
          );
        })}
        <div className="xp-terminus" data-stop>
          <span>Next stop</span>
          <strong>To be announced</strong>
        </div>
      </Line>
    </div>
  );
}
