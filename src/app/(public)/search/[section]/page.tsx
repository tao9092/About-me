import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectionPage } from "@/components/collection-page";
import { ProjectsLab } from "@/components/projects-lab";
import type { EntityTable } from "@/lib/content";

// A search on a list page (/projects?q=…) is rewritten here (next.config.ts), so
// the list pages themselves stay static: only a search renders per request.
const sections: Record<string, EntityTable> = {
  projects: "projects",
  awards: "awards",
  education: "education",
  links: "links",
  skills: "skills",
  "upcoming-competitions": "upcoming_competitions",
};

export const metadata: Metadata = { robots: { index: false, follow: true } };

export default async function Page({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ q?: string | string[] }> }) {
  const table = sections[(await params).section];
  if (!table) notFound();
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw) || undefined;
  return table === "projects" ? <ProjectsLab q={q} /> : <CollectionPage table={table} q={q} />;
}
