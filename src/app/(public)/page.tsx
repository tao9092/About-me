import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Award,
  Trophy,
} from "lucide-react";
import { listContent, publicStats, siteProfile } from "@/lib/content";
import {
  AurosHeroMotion,
  LineRise,
  Reveal,
} from "@/components/editorial-motion";
import { ParticleSphere } from "@/components/particle-sphere";
import { MusicalMetrics } from "@/components/musical-metrics";
import { ScrambleText } from "@/components/scramble-text";
import { CapabilityAtlas } from "@/components/capability-atlas";
import { SignalCosmos } from "@/components/signal-cosmos";

export default async function Home() {
  const [profile, stats, competitions, projects, skills] =
    await Promise.all([
      siteProfile(),
      publicStats(),
      listContent("competitions", { limit: 100 }),
      listContent("projects", { limit: 100 }),
      listContent("skills", { limit: 40 }),
    ]);
  const metrics = [
    { label: "Competitions", value: stats.competitions, href: "/competitions" },
    { label: "Certificates", value: stats.certificates, href: "/certificates" },
    { label: "Projects", value: stats.projects, href: "/projects" },
    { label: "Awards", value: stats.awards, href: "/awards" },
    { label: "Experiences", value: stats.experiences, href: "/experience" },
  ];
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
          <h1 className="auros-name">
            <LineRise>Tao</LineRise>
          </h1>
          <p className="auros-headline">
            <LineRise delay={0.1}>{profile?.headline_en}</LineRise>
          </p>
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
        <SignalCosmos />
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
        <Reveal>
          <MusicalMetrics metrics={metrics} />
        </Reveal>
      </section>

      <section className="evidence-section">
        <Reveal>
          <div className="auros-section-head">
            <p className="auros-kicker">Validated learning / 02</p>
            <h2>
              Where curiosity
              <br />
              meets evidence.
            </h2>
          </div>
        </Reveal>
        <div className="evidence-control-board">
          <section className="evidence-console competition-console">
            <header>
              <div>
                <span className="console-status">
                  <i /> Verified records
                </span>
                <h3>Competitions</h3>
              </div>
              <strong>{String(competitions.length).padStart(2, "0")}</strong>
              <Link href="/competitions">View index</Link>
            </header>
            <div
              className="evidence-console-scroll"
              tabIndex={0}
              aria-label="All competition records"
            >
              {competitions.map((item, index) => (
                <Link
                  className="evidence-dossier competition-dossier"
                  href={`/competitions/${String(item.slug)}`}
                  key={String(item.id)}
                >
                  <div className="dossier-topline">
                    <span>
                      COMP /{" "}
                      <ScrambleText
                        text={String(index + 1).padStart(2, "0")}
                        delay={index * 90}
                      />
                    </span>
                    <em>
                      <ScrambleText
                        text={String(item.competition_date ?? "").slice(0, 4)}
                        delay={260 + index * 90}
                      />
                    </em>
                  </div>
                  <h4>
                    <ScrambleText
                      text={String(item.title_en)}
                      delay={70 + index * 90}
                    />
                  </h4>
                  <p className="dossier-meta">
                    <ScrambleText
                      text={String(item.organizer ?? "Competition")}
                      delay={140 + index * 90}
                    />
                  </p>
                  <div
                    className="competition-result"
                    aria-label="Competition result"
                  >
                    {Boolean(item.placement) && (
                      <span className="rank-badge">
                        <Trophy aria-hidden />
                        <span className="result-label">Result /</span>
                        <ScrambleText
                          text={String(item.placement)}
                          delay={200 + index * 90}
                          className="result-value"
                        />
                      </span>
                    )}
                    {Boolean(item.award) && (
                      <span className="award-badge">
                        <Award aria-hidden />
                        <span className="result-label">Award /</span>
                        <ScrambleText
                          text={String(item.award)}
                          delay={230 + index * 90}
                          className="result-value"
                        />
                      </span>
                    )}
                  </div>
                  <div className="dossier-action">
                    <span>Open verified record</span>
                    <ArrowUpRight />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="evidence-console project-console">
            <header>
              <div>
                <span className="console-status">
                  <i /> Built records
                </span>
                <h3>Projects</h3>
              </div>
              <strong>{String(projects.length).padStart(2, "0")}</strong>
              <Link href="/projects">View index</Link>
            </header>
            <div
              className="evidence-console-scroll"
              tabIndex={0}
              aria-label="All project records"
            >
              {projects.map((item, index) => (
                <Link
                  className="evidence-dossier project-dossier"
                  href={`/projects/${String(item.slug)}`}
                  key={String(item.id)}
                >
                  <div className="dossier-topline">
                    <span>
                      BUILD /{" "}
                      <ScrambleText
                        text={String(index + 1).padStart(2, "0")}
                        delay={index * 90}
                      />
                    </span>
                    <em>
                      <ScrambleText
                        text={String(
                          item.project_date ?? item.updated_at ?? "",
                        ).slice(0, 4)}
                        delay={230 + index * 90}
                      />
                    </em>
                  </div>
                  <h4>
                    <ScrambleText
                      text={String(item.title_en)}
                      delay={70 + index * 90}
                    />
                  </h4>
                  <p className="dossier-meta">
                    <ScrambleText
                      text={
                        Array.isArray(item.tech_stack) &&
                        item.tech_stack.length > 0
                          ? item.tech_stack.map(String).join(" · ")
                          : String(item.summary_en ?? "Selected project")
                      }
                      delay={150 + index * 90}
                    />
                  </p>
                  <div className="project-state">
                    <span>Build status</span>
                    <strong>Published</strong>
                  </div>
                  <div className="dossier-action">
                    <span>Open project record</span>
                    <ArrowUpRight />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="capabilities-section">
        <Reveal>
          <div className="auros-section-head horizontal">
            <div>
              <p className="auros-kicker">Capabilities / 03</p>
              <h2>
                Shaped across
                <br />
                every field.
              </h2>
            </div>
            <p>
              What I explore shapes how I learn, think, move and contribute
              to the people and systems around me.
            </p>
          </div>
        </Reveal>
        <CapabilityAtlas
          skills={skills.map((skill) => ({
            title: String(skill.title_en),
            category: String(skill.skill_category ?? "General"),
            proficiency: String(skill.proficiency ?? "Practised"),
            summary: String(skill.summary_en ?? ""),
          }))}
        />
      </section>

      <section className="auros-contact">
        <Reveal>
          <p className="auros-kicker">Open channel / 04</p>
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
