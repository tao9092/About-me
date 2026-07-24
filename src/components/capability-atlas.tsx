"use client";

import {
  BookOpen,
  BrainCircuit,
  Dumbbell,
  Network,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CapabilityId = "learning" | "adaptive" | "physical" | "social";

type Capability = {
  id: CapabilityId;
  number: string;
  title: string;
  titleZh: string;
  description: string;
  fields: string[];
  status: string;
  Icon: typeof BookOpen;
};

const capabilities: Capability[] = [
  {
    id: "learning",
    number: "01",
    title: "Learning capacity",
    titleZh: "学力",
    description:
      "Learning across different systems, from creative practice to technical knowledge.",
    fields: ["Music", "Technology", "Independent learning"],
    status: "Continuously expanding",
    Icon: BookOpen,
  },
  {
    id: "adaptive",
    number: "02",
    title: "Adaptive thinking",
    titleZh: "灵活思考能力",
    description:
      "Changing approach, recognising patterns and making decisions when the problem shifts.",
    fields: ["Chess", "Problem solving", "Competitions"],
    status: "Practised through building",
    Icon: BrainCircuit,
  },
  {
    id: "physical",
    number: "03",
    title: "Physical capacity",
    titleZh: "身体能力",
    description:
      "Developing discipline, coordination and resilience through active practice.",
    fields: ["Sports", "Training", "Discipline"],
    status: "Active personal practice",
    Icon: Dumbbell,
  },
  {
    id: "social",
    number: "04",
    title: "Social contribution",
    titleZh: "社会贡献度",
    description:
      "Contributing through collaboration, shared work and knowledge that helps others.",
    fields: ["Teamwork", "Knowledge sharing", "Community"],
    status: "Evidence in progress",
    Icon: Network,
  },
];

export function CapabilityAtlas({
  skills,
}: {
  skills: Array<{
    title: string;
    category: string;
    proficiency: string;
    summary: string;
  }>;
}) {
  const atlas = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<CapabilityId>("learning");
  const [expanded, setExpanded] = useState(false);
  const active =
    capabilities.find((capability) => capability.id === selected) ??
    capabilities[0];

  const skillsByCapability: Record<CapabilityId, typeof skills> = {
    learning: [],
    adaptive: [],
    physical: [],
    social: [],
  };
  skills.forEach((skill) => {
    const category = skill.category.toLowerCase();
    const capability: CapabilityId =
      category === "physical" || category.includes("sport")
        ? "physical"
        : category === "social" ||
            category.includes("communication") ||
            category.includes("leadership") ||
            category.includes("community")
          ? "social"
          : category === "adaptive" ||
              category.includes("design") ||
              category.includes("strategy") ||
              category.includes("problem")
            ? "adaptive"
            : "learning";
    skillsByCapability[capability].push(skill);
  });

  const activeFields = skillsByCapability[selected];

  useEffect(() => {
    if (!expanded) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!atlas.current?.contains(event.target as Node)) setExpanded(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [expanded]);

  function selectCapability(
    id: CapabilityId,
    source: HTMLButtonElement,
  ) {
    const start = source.getBoundingClientRect();
    setSelected(id);
    setExpanded(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = atlas.current?.querySelector<HTMLElement>(
          `[data-capability="${id}"]`,
        );
        if (!target) return;
        const end = target.getBoundingClientRect();
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        if (reducedMotion) return;
        target.animate(
          [
            {
              transform: `translate(${start.left - end.left}px, ${
                start.top - end.top
              }px) scale(${start.width / Math.max(end.width, 1)})`,
              transformOrigin: "top left",
            },
            { transform: "none", transformOrigin: "top left" },
          ],
          { duration: 620, easing: "cubic-bezier(.16,1,.3,1)" },
        );
      });
    });
  }

  return (
    <div
      className={`capability-atlas ${expanded ? "is-expanded" : ""}`}
      ref={atlas}
    >
      <div className="capability-bento">
        {capabilities.map(({ id, number, title, titleZh, description, fields, status, Icon }) => {
          const managedFields = skillsByCapability[id].map((skill) => skill.title);
          const visibleFields =
            managedFields.length > 0 ? managedFields.slice(0, 4) : fields;
          return (
          <button
            type="button"
            className={`capability-panel capability-${id} ${
              selected === id ? "active" : ""
            }`}
            onClick={(event) => selectCapability(id, event.currentTarget)}
            aria-pressed={selected === id}
            aria-controls="capability-detail"
            data-capability={id}
            key={id}
          >
            <div className="capability-panel-top">
              <span>{number}</span>
              <Icon aria-hidden />
            </div>
            <div>
              <small>{titleZh}</small>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
            <div className="capability-fields">
              {visibleFields.map((field) => (
                <span key={field}>{field}</span>
              ))}
            </div>
            <div className="capability-panel-status">
              <span>
                <i />
                {status}
              </span>
              <strong>View details →</strong>
            </div>
          </button>
          );
        })}
      </div>

      <section
        className={`capability-detail detail-${active.id}`}
        id="capability-detail"
        aria-live="polite"
      >
        <div className="capability-detail-copy">
          <p>
            Selected capability / <span>{active.number}</span>
          </p>
          <h3>{active.title}</h3>
          <strong>{active.titleZh}</strong>
          <blockquote>{active.description}</blockquote>
        </div>
        <div className="capability-evidence">
          <div className="capability-evidence-head">
            <span>Explored fields</span>
            <small>{String(activeFields.length).padStart(2, "0")} entries</small>
          </div>
          {activeFields.length > 0 ? (
            activeFields.map((item) => (
              <article key={`${selected}-${item.title}`}>
                <small>{item.proficiency || "Exploring"}</small>
                <strong>{item.title}</strong>
                {item.summary && <p>{item.summary}</p>}
              </article>
            ))
          ) : (
            <div className="capability-evidence-empty">
              <span>No published fields yet</span>
              <p>
                Add content to this capability from Admin → Capabilities.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
