import { listContent, publicFileUrls } from "@/lib/content";
import { CertificatePlates, OrbitCarousel, type Credential } from "@/components/orbit-carousel";
import "./certificates-orbit.css";

// The Certificates page as an archive of light, after its transition's Saturn
// eclipse: deep space, a thin wide title, the sun's gold at the edges. Saturn
// sits backlit in the middle with the certificates orbiting it on the ring
// plane; below, every one as a framed plate.

const ORBIT = 10; // certificates in orbit at most; more would crowd the ring

export async function CertificatesOrbit() {
  const rows = await listContent("certificates", { limit: 100 });
  const images = await publicFileUrls(rows.map((row) => row.image_file_id).filter((id): id is string => typeof id === "string"));
  const items: Credential[] = rows.map((row) => ({
    slug: String(row.slug),
    title: String(row.title_en),
    issuer: row.issuer ? String(row.issuer) : null,
    date: row.issued_at ? String(row.issued_at) : null,
    image: typeof row.image_file_id === "string" ? (images.get(row.image_file_id) ?? null) : null,
    verify: row.verification_url ? String(row.verification_url) : null,
  }));
  const issuers = new Set(items.map((item) => item.issuer).filter(Boolean)).size;
  const years = [...new Set(items.map((item) => item.date?.slice(0, 4)).filter(Boolean))].sort().join(" – ");

  return (
    <div className="sky">
      <header className="sky-head">
        <div className="sky-meta">
          <span>04 — Archive of light</span>
          <span>
            {String(items.length).padStart(2, "0")} credentials · {issuers} issuers{years && ` · ${years}`}
          </span>
        </div>
        <h1>Certificates</h1>
        <p>Training, recognition and the occasional proof of having stayed up all night, held in orbit. Drag to turn it.</p>
      </header>
      {items.length > 0 && <OrbitCarousel items={[...items].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, ORBIT)} />}
      <section className="sky-index" aria-label="All certificates">
        <div className="sky-index-head">
          <h2>The archive</h2>
          <span>Every credential, newest first</span>
        </div>
        <CertificatePlates items={[...items].sort((a, b) => String(b.date).localeCompare(String(a.date)))} />
      </section>
    </div>
  );
}
