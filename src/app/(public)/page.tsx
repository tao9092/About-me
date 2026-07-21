import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Award,
  BriefcaseBusiness,
  FileCheck2,
  FolderCode,
  Trophy,
} from "lucide-react";
import { listContent, publicStats, siteProfile } from "@/lib/content";
import {
  AurosHeroMotion,
  LineRise,
  Reveal,
} from "@/components/editorial-motion";
import { ParticleSphere } from "@/components/particle-sphere";

export default async function Home() {
  const [profile, stats, projects, competitions, certificates, skills] =
    await Promise.all([
      siteProfile(),
      publicStats(),
      listContent("projects", { limit: 3 }),
      listContent("competitions", { limit: 3 }),
      listContent("certificates", { limit: 3 }),
      listContent("skills", { limit: 8 }),
    ]);
  const metrics = [
    ["Competitions", stats.competitions, Trophy],
    ["Certificates", stats.certificates, FileCheck2],
    ["Projects", stats.projects, FolderCode],
    ["Awards", stats.awards, Award],
    ["Experiences", stats.experiences, BriefcaseBusiness],
  ] as const;
  return (
    <div className="auros-home">
      <section className="auros-hero">
        <div className="auros-grid" aria-hidden />
        <div className="scan-line" aria-hidden />
        <div className="hero-status">
          <span>
            <i /> Portfolio online
          </span>
          <span>MY / {new Date().getFullYear()}</span>
        </div>
        <div className="auros-hero-copy">
          <p className="auros-kicker">Personal Achievement Hub</p>
          <h1>
            <LineRise>{profile?.name_en}</LineRise>
            <LineRise delay={0.1}>{profile?.headline_en}</LineRise>
          </h1>
          <LineRise delay={0.22}>
            <p className="auros-lead">{profile?.bio_en}</p>
          </LineRise>
          <LineRise delay={0.32}>
            <div className="auros-actions">
              <Link href="/projects" className="aurora-button">
                Explore my work <ArrowUpRight />
              </Link>
              <Link href="/resume" className="ghost-button">
                View résumé
              </Link>
            </div>
          </LineRise>
        </div>
        <AurosHeroMotion>
          <div className="hero-orb-stage">
            <ParticleSphere density="high" />
            <div className="orb-ring ring-one" />
            <div className="orb-ring ring-two" />
            <div className="orb-label label-a">
              <span>01</span> Projects
            </div>
            <div className="orb-label label-b">
              <span>02</span> Credentials
            </div>
            <div className="orb-label label-c">
              <span>03</span> Experience
            </div>
          </div>
        </AurosHeroMotion>
        <a href="#signal" className="scroll-signal">
          <span>Scroll to signal</span>
          <ArrowDown />
        </a>
      </section>

      <section className="signal-section" id="signal">
        <Reveal>
          <div className="auros-section-head">
            <p className="auros-kicker">Signal / 01</p>
            <h2>
              Proof, organised.
              <br />
              Progress, visible.
            </h2>
            <p>
              Every number is calculated from published records — a live
              snapshot rather than a manually written claim.
            </p>
          </div>
        </Reveal>
        <div className="metrics-grid">
          {metrics.map(([label, value, Icon], index) => (
            <Reveal key={label} delay={index * 0.06}>
              <article>
                <div>
                  <Icon />
                  <span>0{index + 1}</span>
                </div>
                <strong>{String(value).padStart(2, "0")}</strong>
                <p>{label}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="systems-section">
        <Reveal>
          <div className="auros-section-head horizontal">
            <div>
              <p className="auros-kicker">Selected systems / 02</p>
              <h2>
                Built to
                <br />
                move ideas.
              </h2>
            </div>
            <Link href="/projects">
              All projects <ArrowUpRight />
            </Link>
          </div>
        </Reveal>
        <div className="auros-project-grid">
          {projects.map((item, index) => (
            <Reveal key={String(item.id)} delay={index * 0.1}>
              <Link
                href={`/projects/${String(item.slug)}`}
                className="auros-project-card"
              >
                <div className="project-orb-canvas">
                  <ParticleSphere density={index === 0 ? "medium" : "low"} label={`${String(item.title_en)} particle visual`} />
                  <span>SYS / 0{index + 1}</span>
                </div>
                <div className="auros-project-info">
                  <p>
                    {Array.isArray(item.tech_stack)
                      ? item.tech_stack.map(String).join(" · ")
                      : "Selected project"}
                  </p>
                  <h3>{String(item.title_en)}</h3>
                  <span>{String(item.summary_en ?? "")}</span>
                  <ArrowUpRight />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="evidence-section">
        <Reveal>
          <div className="auros-section-head">
            <p className="auros-kicker">Validated learning / 03</p>
            <h2>
              Where curiosity
              <br />
              meets evidence.
            </h2>
          </div>
        </Reveal>
        <div className="auros-evidence-grid">
          <div>
            <div className="evidence-title">
              <span>Competitions</span>
              <Link href="/competitions">View index</Link>
            </div>
            {competitions.map((item, index) => (
              <Reveal key={String(item.id)} delay={index * 0.06}>
                <Link
                  className="auros-evidence-row"
                  href={`/competitions/${String(item.slug)}`}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{String(item.title_en)}</strong>
                    <small>
                      {String(item.organizer ?? item.award ?? "Competition")}
                    </small>
                  </div>
                  <em>{String(item.competition_date ?? "").slice(0, 4)}</em>
                  <ArrowUpRight />
                </Link>
              </Reveal>
            ))}
          </div>
          <div>
            <div className="evidence-title">
              <span>Certificates</span>
              <Link href="/certificates">View index</Link>
            </div>
            {certificates.map((item, index) => (
              <Reveal key={String(item.id)} delay={index * 0.06}>
                <Link
                  className="auros-evidence-row"
                  href={`/certificates/${String(item.slug)}`}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{String(item.title_en)}</strong>
                    <small>{String(item.issuer ?? "Certificate")}</small>
                  </div>
                  <em>{String(item.issued_at ?? "").slice(0, 4)}</em>
                  <ArrowUpRight />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="capabilities-section">
        <Reveal>
          <div className="auros-section-head horizontal">
            <div>
              <p className="auros-kicker">Capabilities / 04</p>
              <h2>
                Adaptable by
                <br />
                design.
              </h2>
            </div>
            <p>
              Tools are temporary. The system for learning, building and
              communicating is the durable skill.
            </p>
          </div>
        </Reveal>
        <div className="capability-cloud">
          {skills.map((skill, index) => (
            <Reveal key={String(skill.id)} delay={index * 0.035}>
              <Link href="/skills">
                <span>0{index + 1}</span>
                {String(skill.title_en)}
                <i>{String(skill.proficiency ?? "Practised")}</i>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="auros-contact">
        <Reveal>
          <p className="auros-kicker">Open channel / 05</p>
          <h2>
            Have a challenge
            <br />
            worth solving?
          </h2>
          <div>
            <a
              className="aurora-button"
              href={`mailto:${process.env.ADMIN_EMAIL ?? "hello@example.com"}`}
            >
              Start a conversation <ArrowUpRight />
            </a>
            <p>
              Available for collaborations, competitions, learning opportunities
              and ambitious ideas.
            </p>
          </div>
        </Reveal>
        <div className="contact-orb" aria-hidden>
          <ParticleSphere density="medium" label="" />
        </div>
      </section>
    </div>
  );
}
