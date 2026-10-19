import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  ExternalLink,
  LockKeyhole,
  MapPin,
} from "lucide-react";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
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
  // A private project shows only that it exists; its write-up isn't public.
  const locked = row.visibility === "protected";
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
  const title = String(row.title_en);
  // On phones the headline is sized so its longest word fits the width, and
  // long titles come down a step so they don't run to many lines.
  const longest = Math.max(1, ...title.split(/[\s-]+/).map((word) => word.length));
  const titleVw = Math.min(17, 90 / (longest * 0.48), title.length > 40 ? 13 : title.length > 26 ? 15 : 17);
  return (
    <article className="public-detail">
      <Link className="detail-back" href={meta.back}>
        <ArrowLeft /> Back to {meta.label.toLowerCase()}s
      </Link>
      <header className="detail-hero">
        <div>
          <div className="detail-badges">
            <Badge>{meta.label}</Badge>
            {locked && <Badge tone="warning"><LockKeyhole size={13} /> Private</Badge>}
            {Boolean(row.is_demo) && <Badge tone="warning">Demo data</Badge>}
          </div>
          <h1 style={{ "--title-vw": titleVw.toFixed(2) } as CSSProperties}>{title}</h1>
          {!locked && <p>{String(row.summary_en ?? "")}</p>}
        </div>
        <div className="detail-index">
          <span>{locked ? "Private record" : "Published record"}</span>
          <strong>{String(row.sort_order ?? 0).padStart(2, "0")}</strong>
        </div>
      </header>
      {locked ? (
        <section className="detail-locked">
          <LockKeyhole />
          <h2>This project is private</h2>
          <p>Its details aren&apos;t shared publicly.</p>
          <Link className="text-link" href={meta.back}>
            <ArrowLeft /> Back to {meta.label.toLowerCase()}s
          </Link>
        </section>
      ) : <>
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
      </>}
    </article>
  );
}
