import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Download } from "lucide-react";
import { getPublicContent, listContent, publicFileUrls } from "@/lib/content";
import { CertificateViewer } from "@/components/certificate-viewer";
import "./certificates-orbit.css";
import "./certificate-record.css";

// A certificate's own page, the archive of light's viewing room: the sunlight
// that burst from it on the list settles as the page opens; the certificate
// hangs large in a lit frame beside its facts, a way to verify it and the
// certificates either side.

const day = (value: unknown) =>
  typeof value === "string" && value
    ? new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    : null;
const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

export async function CertificateRecord({ slug }: { slug: string }) {
  const [row, all, competitions] = await Promise.all([
    getPublicContent("certificates", slug),
    listContent("certificates", { limit: 100 }),
    listContent("competitions", { limit: 200 }),
  ]);
  if (!row) notFound();
  const rows = [...all].sort((a, b) => String(b.issued_at ?? "").localeCompare(String(a.issued_at ?? "")));
  const index = rows.findIndex((item) => item.slug === slug);
  const title = String(row.title_en);
  const image = typeof row.certificate_image_url === "string" ? row.certificate_image_url : null;
  const pdf = row.allow_download && typeof row.pdf_file_id === "string" ? (await publicFileUrls([row.pdf_file_id])).get(row.pdf_file_id) : undefined;
  const related = competitions.find((item) => item.id === row.related_competition_id);
  const facts = [
    ["Issued by", text(row.issuer)],
    ["Issued", day(row.issued_at)],
    ["Credential ID", text(row.certificate_id)],
  ].filter((fact): fact is [string, string] => Boolean(fact[1]));
  const neighbours = index >= 0 && rows.length > 1
    ? ([["Newer", rows[(index - 1 + rows.length) % rows.length]], ["Older", rows[(index + 1) % rows.length]]] as const)
    : [];

  return (
    <article className="sky cert">
      <div className="sky-dawn" aria-hidden />
      <div className="sky-meta cert-meta">
        <Link href="/certificates">
          <ArrowLeft /> Archive of light
        </Link>
        <span>
          Credential {index >= 0 ? `${String(index + 1).padStart(2, "0")} / ${String(rows.length).padStart(2, "0")}` : "—"}
        </span>
      </div>
      <div className="cert-room">
        <div className="cert-stage">{image ? <CertificateViewer src={image} alt={title} /> : <div className="cert-frame is-empty">{title}</div>}</div>
        <div className="cert-copy">
          <p className="cert-kicker">{text(row.issuer) ?? "Certificate"}</p>
          <h1>{title}</h1>
          {text(row.summary_en) && <p className="cert-summary">{text(row.summary_en)}</p>}
          {facts.length > 0 && (
            <dl className="cert-facts">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="cert-actions">
            {text(row.verification_url) && (
              <a href={text(row.verification_url)!} target="_blank" rel="noopener noreferrer" className="is-primary">
                <BadgeCheck /> Verify credential
              </a>
            )}
            {pdf && (
              <a href={pdf} target="_blank" rel="noopener noreferrer">
                <Download /> PDF
              </a>
            )}
            {related && (
              <Link href={`/competitions/${String(related.slug)}`}>
                {String(related.title_en)} <ArrowUpRight />
              </Link>
            )}
          </div>
        </div>
      </div>
      {neighbours.length > 0 && (
        <nav className="cert-next" aria-label="More certificates">
          {neighbours.map(([label, item]) => (
            <Link href={`/certificates/${String(item.slug)}`} key={label} className={label === "Older" ? "is-older" : undefined}>
              <span>
                {label === "Newer" && <ArrowLeft />}
                {label} · {day(item.issued_at) ?? "—"}
                {label === "Older" && <ArrowRight />}
              </span>
              <strong>{String(item.title_en)}</strong>
              <em>{text(item.issuer) ?? ""}</em>
            </Link>
          ))}
        </nav>
      )}
    </article>
  );
}
