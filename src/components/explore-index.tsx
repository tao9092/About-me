import { Syne } from "next/font/google";
import { listContent, type EntityTable } from "@/lib/content";
import { HorizonIndex, type Section } from "@/components/horizon-index";
import "./explore-index.css";

// The Index page as an event horizon, after its transition's black hole: a
// dreamlike violet dark, a wide display face, and the black hole itself above
// a catalogue of everything in the hub, every record in every collection,
// searchable, each one a way in.

const display = Syne({ subsets: ["latin"], weight: ["400", "500", "700", "800"], variable: "--hz-display" });

type Spec = { table: EntityTable; title: string; collection: string; date: string; href: (row: Record<string, unknown>) => string; external?: boolean };
const SECTIONS: Spec[] = [
  { table: "projects", title: "Projects", collection: "/projects", date: "project_date", href: (row) => `/projects/${row.slug}` },
  { table: "competitions", title: "Competitions", collection: "/competitions", date: "competition_date", href: (row) => `/competitions/${row.slug}` },
  { table: "certificates", title: "Certificates", collection: "/certificates", date: "issued_at", href: (row) => `/certificates/${row.slug}` },
  { table: "experiences", title: "Experience", collection: "/experience", date: "start_date", href: (row) => `/experience#${row.slug}` },
  { table: "upcoming_competitions", title: "Upcoming", collection: "/upcoming-competitions", date: "competition_date", href: () => "/upcoming-competitions" },
  { table: "education", title: "Education", collection: "/education", date: "start_year", href: () => "/education" },
  { table: "awards", title: "Awards", collection: "/awards", date: "award_date", href: () => "/awards" },
  { table: "skills", title: "Skills", collection: "/skills", date: "", href: () => "/skills" },
  { table: "links", title: "Links", collection: "/links", date: "", href: (row) => String(row.url ?? "/links"), external: true },
];

/** A line of context for a record: who, where or what it was. */
function detail(row: Record<string, unknown>) {
  const parts = [row.organizer, row.issuer, row.organization, row.school, row.role, row.position, row.placement, row.skill_category, row.summary_en];
  const first = parts.find((part) => typeof part === "string" && part.trim());
  return typeof first === "string" ? first.trim().slice(0, 90) : "";
}

export async function ExploreIndex() {
  const lists = await Promise.all(SECTIONS.map((spec) => listContent(spec.table, { limit: 200 }).catch(() => [])));
  const sections: Section[] = SECTIONS.map((spec, index) => ({
    title: spec.title,
    href: spec.collection,
    entries: lists[index]
      .map((row) => ({
        id: String(row.id),
        title: String(row.title_en),
        detail: detail(row),
        date: spec.date && (typeof row[spec.date] === "string" || typeof row[spec.date] === "number") ? String(row[spec.date]) : "",
        href: spec.href(row),
        external: Boolean(spec.external),
        locked: row.visibility === "protected",
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
  }));
  const total = sections.reduce((sum, section) => sum + section.entries.length, 0);

  return (
    <div className={`hz ${display.variable}`}>
      <header className="hz-hero">
        <div className="hz-meta">
          <span>06 — Event horizon</span>
          <span>
            {total} records · {sections.filter((section) => section.entries.length).length} of {sections.length} collections
          </span>
        </div>
        <div className="hz-hole" aria-hidden>
          <i className="hz-disk-back" />
          <i className="hz-glow" />
          <i className="hz-shadow" />
          <i className="hz-ring" />
          <i className="hz-disk-front" />
        </div>
        <h1>Index</h1>
        <p>Everything in the hub, drawn toward one point. Search it, or let something pull you in.</p>
      </header>
      <HorizonIndex sections={sections} />
    </div>
  );
}
