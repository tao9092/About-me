import { Instrument_Serif } from "next/font/google";
import { listContent } from "@/lib/content";
import { readPlacement, topPercent } from "@/lib/placement";
import { RangeBoard, type Shot } from "@/components/range-board";
import { angleFor } from "@/components/scope-face";
import "./competitions-range.css";

// The Competitions page as a field record, after its transition's rifle scope:
// warm black and bone, a serif display face over mono instrument labels, one
// signal-orange accent. Every competition is a shot on a scope's target, nearer
// the centre the higher it finished in its field, beside a log of them all.

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--rec-serif" });

const month = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleString("en", { month: "short", timeZone: "UTC" });

export async function CompetitionsRange() {
  const rows = await listContent("competitions", { limit: 200 });
  const shots: Shot[] = rows
    .map((row) => {
      const place = readPlacement(row.placement);
      const slug = String(row.slug);
      return {
        slug,
        title: String(row.title_en),
        date: String(row.competition_date ?? ""),
        end: row.end_date ? String(row.end_date) : null,
        organizer: row.organizer ? String(row.organizer) : null,
        location: row.location ? String(row.location) : null,
        team: row.team_name ? String(row.team_name) : null,
        award: row.award ? String(row.award) : null,
        ...place,
        angle: angleFor(slug),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const ranked = shots.filter((shot) => shot.share !== null);
  const shares = ranked.map((shot) => shot.share!).sort((a, b) => a - b);
  const best = ranked.reduce<Shot | null>((top, shot) => (!top || shot.share! < top.share! ? shot : top), null);
  const median = shares.length ? shares[Math.floor(shares.length / 2)] : null;
  const faced = ranked.reduce((sum, shot) => sum + (shot.field ?? 0), 0);
  const dates = shots.map((shot) => shot.date).filter(Boolean).sort();
  const span = dates.length ? `${month(dates[0])} – ${month(dates.at(-1)!)} ${dates.at(-1)!.slice(0, 4)}` : "—";
  const stats = [
    ["Engagements", String(shots.length).padStart(2, "0")],
    ["Teams faced", faced.toLocaleString("en")],
    ["Best finish", best ? `Top ${topPercent(best.share!)}` : "—"],
    ["Median finish", median !== null ? `Top ${topPercent(median)}` : "—"],
    ["Inside top 10%", String(shares.filter((share) => share <= 0.1).length).padStart(2, "0")],
  ];

  return (
    <div className={`rec ${serif.variable}`}>
      <header className="rec-head">
        <div className="rec-head-meta">
          <span>03 — Field record</span>
          <span>{span}</span>
        </div>
        <h1>
          Compe<em>titions</em>
        </h1>
        <p>
          Capture-the-flag and security challenges, each plotted as a shot on the scope: the closer to the centre, the higher the
          finish in its field.
        </p>
      </header>
      <dl className="rec-stats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <RangeBoard shots={shots} best={best?.slug ?? null} />
    </div>
  );
}
