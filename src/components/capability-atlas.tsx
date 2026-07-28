"use client";

import {
  BookOpen,
  BrainCircuit,
  Dumbbell,
  Network,
} from "lucide-react";
import { useState } from "react";

type CapabilityId = "learning" | "adaptive" | "physical" | "social";

type Capability = {
  id: CapabilityId;
  number: string;
  title: string;
  description: string;
  Icon: typeof BookOpen;
};

const capabilities: Capability[] = [
  {
    id: "learning",
    number: "01",
    title: "Learning capacity",
    description:
      "Learning across different systems, from creative practice to technical knowledge.",
    Icon: BookOpen,
  },
  {
    id: "adaptive",
    number: "02",
    title: "Adaptive thinking",
    description:
      "Changing approach, recognising patterns and making decisions when the problem shifts.",
    Icon: BrainCircuit,
  },
  {
    id: "physical",
    number: "03",
    title: "Physical capacity",
    description:
      "Developing discipline, coordination and resilience through active practice.",
    Icon: Dumbbell,
  },
  {
    id: "social",
    number: "04",
    title: "Social contribution",
    description:
      "Contributing through collaboration, shared work and knowledge that helps others.",
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
  const [selected, setSelected] = useState<CapabilityId>("learning");

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

  const active =
    capabilities.find((capability) => capability.id === selected) ??
    capabilities[0];
  const activeFields = skillsByCapability[selected];

  return (
    <div className="capability-master-detail">
      <div
        className="capability-tabs"
        role="tablist"
        aria-label="Capability categories"
      >
        {capabilities.map(({ id, number, title, Icon }) => (
          <button
            type="button"
            className={selected === id ? "active" : ""}
            onClick={() => setSelected(id)}
            role="tab"
            aria-selected={selected === id}
            aria-controls="capability-table-panel"
            key={id}
          >
            <span>{number}</span>
            <Icon aria-hidden />
            <strong>{title}</strong>
            <small>
              {String(skillsByCapability[id].length).padStart(2, "0")}
            </small>
          </button>
        ))}
      </div>

      <section
        className={`capability-table-panel detail-${active.id}`}
        id="capability-table-panel"
        role="tabpanel"
        aria-live="polite"
        key={active.id}
      >
        <div className="capability-table-heading">
          <div>
            <p>Selected capability / {active.number}</p>
            <h3>{active.title}</h3>
          </div>
          <p>{active.description}</p>
        </div>

        <div className="capability-table">
          <div className="capability-table-columns" aria-hidden>
            <span>Capability</span>
            <span>Proficiency</span>
            <span>Summary</span>
            <span />
          </div>
          {activeFields.length > 0 ? (
            activeFields.map((item) => (
              <article
                className="capability-table-row"
                key={`${selected}-${item.title}`}
              >
                <strong>{item.title}</strong>
                <span>{item.proficiency || "Exploring"}</span>
                <p>{item.summary || "Evidence and details in progress."}</p>
                <i aria-hidden>↗</i>
              </article>
            ))
          ) : (
            <div className="capability-table-empty">
              <span>No published fields yet</span>
              <p>Add content from Admin → Capabilities.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
