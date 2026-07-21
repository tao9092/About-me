import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ExternalLink,
  MapPin,
} from "lucide-react";
import { notFound } from "next/navigation";
import { getPublicContent, type EntityTable } from "@/lib/content";
import { sanitizeRichText } from "@/lib/sanitize";
import { Badge } from "@/components/ui";
import { CertificatePreview } from "@/components/certificate-preview";

const copy = {
  competitions: { label: "Competition", back: "/competitions" },
  projects: { label: "Project", back: "/projects" },
  certificates: { label: "Certificate", back: "/certificates" },
} as const;
type DetailTable = keyof typeof copy;
export async function PublicDetail({
  table,
  slug,
}: {
  table: DetailTable;
  slug: string;
}) {
  const row = await getPublicContent(table as EntityTable, slug);
  if (!row) notFound();
  const meta = copy[table];
  const date = String(
    row.competition_date ?? row.project_date ?? row.issued_at ?? "",
  );
  const links = [
    ["GitHub", row.github_url],
    ["Live demo", row.demo_url],
    ["Official website", row.official_url],
    ["Verify certificate", row.verification_url],
  ].filter(
    (item): item is [string, string] =>
      typeof item[1] === "string" && item[1].length > 0,
  );
  const content = String(row.content_en ?? "");
  return (
    <article className="public-detail">
      <Link className="detail-back" href={meta.back}>
        <ArrowLeft /> Back to {meta.label.toLowerCase()}s
      </Link>
      <header className="detail-hero">
        <div>
          <div className="detail-badges">
            <Badge>{meta.label}</Badge>
            {Boolean(row.is_demo) && <Badge tone="warning">Demo data</Badge>}
          </div>
          <h1>{String(row.title_en)}</h1>
          <p>{String(row.summary_en ?? "")}</p>
        </div>
        <div className="detail-index">
          <span>Published record</span>
          <strong>{String(row.sort_order ?? 0).padStart(2, "0")}</strong>
        </div>
      </header>
      <section className="detail-facts">
        {date && (
          <div>
            <CalendarDays />
            <span>Date</span>
            <strong>{date}</strong>
          </div>
        )}
        {Boolean(row.location) && (
          <div>
            <MapPin />
            <span>Location</span>
            <strong>{String(row.location)}</strong>
          </div>
        )}
        {Boolean(row.organizer ?? row.issuer) && (
          <div>
            <ExternalLink />
            <span>{table === "certificates" ? "Issuer" : "Organisation"}</span>
            <strong>{String(row.organizer ?? row.issuer)}</strong>
          </div>
        )}
        {Boolean(row.award ?? row.role) && (
          <div>
            <ArrowUpRight />
            <span>{table === "projects" ? "Role" : "Result"}</span>
            <strong>{String(row.award ?? row.role)}</strong>
          </div>
        )}
      </section>
      {Array.isArray(row.tech_stack) && row.tech_stack.length > 0 && (
        <section className="detail-stack">
          <p className="auros-kicker">Technology</p>
          <div>
            {row.tech_stack.map((item) => (
              <span key={String(item)}>{String(item)}</span>
            ))}
          </div>
        </section>
      )}
      {table === "certificates" && typeof row.certificate_image_url === "string" && (
        <CertificatePreview src={row.certificate_image_url} alt={String(row.title_en)} />
      )}
      {(content || links.length > 0) && <section className="detail-body detail-body-direct">
        <div>
          {content && <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }} />}
          {links.length > 0 && (
            <div className="detail-links">
              {links.map(([label, url]) => (
                <a
                  href={url}
                  key={label}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {label}
                  <ArrowUpRight />
                </a>
              ))}
            </div>
          )}
        </div>
      </section>}
    </article>
  );
}
