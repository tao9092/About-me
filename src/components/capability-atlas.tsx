"use client";

import {
  BookOpen,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Network,
} from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import { MechanicalClockScene } from "@/components/mechanical-clock-scene";

type CapabilityId = "learning" | "adaptive" | "physical" | "social";

type Skill = {
  title: string;
  category: string;
  proficiency: string;
  summary: string;
};

type Capability = {
  id: CapabilityId;
  number: string;
  title: string;
  chineseTitle: string;
  statement: string;
  description: string;
  Icon: typeof BookOpen;
};

const capabilities: Capability[] = [
  {
    id: "learning",
    number: "01",
    title: "Learning capacity",
    chineseTitle: "学习力",
    statement: "Absorb · Connect · Apply",
    description:
      "Turning curiosity into useful knowledge across creative and technical fields.",
    Icon: BookOpen,
  },
  {
    id: "adaptive",
    number: "02",
    title: "Adaptive thinking",
    chineseTitle: "灵活思考能力",
    statement: "Reframe · Decide · Adapt",
    description:
      "Recognising patterns and changing approach as the problem and context evolve.",
    Icon: BrainCircuit,
  },
  {
    id: "physical",
    number: "03",
    title: "Physical capacity",
    chineseTitle: "身体能力",
    statement: "Discipline · Motion · Resilience",
    description:
      "Building coordination, resilience and consistency through active practice.",
    Icon: Dumbbell,
  },
  {
    id: "social",
    number: "04",
    title: "Social contribution",
    chineseTitle: "社会贡献度",
    statement: "Share · Support · Contribute",
    description:
      "Helping people and systems move forward through collaboration and shared knowledge.",
    Icon: Network,
  },
];

function getCapabilityId(categoryValue: string): CapabilityId {
  const category = categoryValue.toLowerCase();
  if (category === "physical" || category.includes("sport")) return "physical";
  if (
    category === "social" ||
    category.includes("communication") ||
    category.includes("leadership") ||
    category.includes("community")
  ) {
    return "social";
  }
  if (
    category === "adaptive" ||
    category.includes("design") ||
    category.includes("strategy") ||
    category.includes("problem")
  ) {
    return "adaptive";
  }
  return "learning";
}

function normaliseIndex(value: number) {
  return ((value % capabilities.length) + capabilities.length) %
    capabilities.length;
}

export function CapabilityAtlas({ skills }: { skills: Skill[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const dialRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ angle: number; rotation: number } | null>(null);

  const skillsByCapability: Record<CapabilityId, Skill[]> = {
    learning: [],
    adaptive: [],
    physical: [],
    social: [],
  };
  skills.forEach((skill) => {
    skillsByCapability[getCapabilityId(skill.category)].push(skill);
  });

  const selected = capabilities[selectedIndex];
  const selectedSkills = skillsByCapability[selected.id];

  function pointAngle(clientX: number, clientY: number) {
    const rect = dialRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return (
      (Math.atan2(
        clientY - (rect.top + rect.height / 2),
        clientX - (rect.left + rect.width / 2),
      ) *
        180) /
      Math.PI
    );
  }

  function select(index: number) {
    const nextIndex = normaliseIndex(index);
    setSelectedIndex(nextIndex);
    setRotation(-nextIndex * 90);
    setRevealed(false);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = {
      angle: pointAngle(event.clientX, event.clientY),
      rotation,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const nextRotation =
      dragRef.current.rotation +
      pointAngle(event.clientX, event.clientY) -
      dragRef.current.angle;
    setRotation(nextRotation);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const nextIndex = normaliseIndex(-Math.round(rotation / 90));
    setSelectedIndex(nextIndex);
    setRotation(-nextIndex * 90);
    setRevealed(false);
  }

  return (
    <div className={`capability-instrument${revealed ? " is-revealed" : ""}`}>
      <MechanicalClockScene />
      <div className="capability-watch-stage">
        <div className="capability-index-readout" aria-live="polite">
          <span>Selected dimension</span>
          <strong>{selected.number}</strong>
        </div>

        <div
          className="capability-watch"
          ref={dialRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          <div className="watch-crown watch-crown-top" />
          <div className="watch-crown watch-crown-bottom" />
          <div className="watch-bezel">
            <span className="bezel-screw screw-a" />
            <span className="bezel-screw screw-b" />
            <span className="bezel-screw screw-c" />
            <span className="bezel-screw screw-d" />
            <div
              className="watch-dial"
              style={{ "--dial-rotation": `${rotation}deg` } as CSSProperties}
            >
              {Array.from({ length: 48 }, (_, index) => (
                <i
                  className={index % 12 === 0 ? "major" : ""}
                  style={{ "--tick": index } as CSSProperties}
                  key={index}
                />
              ))}

              {capabilities.map((capability, index) => (
                <button
                  type="button"
                  className={`watch-dimension${selectedIndex === index ? " active" : ""}`}
                  style={
                    {
                      "--dimension-angle": `${index * 90}deg`,
                      "--label-counter": `${-index * 90 - rotation}deg`,
                    } as CSSProperties
                  }
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => select(index)}
                  aria-label={`Select ${capability.title}`}
                  key={capability.id}
                >
                  <span>{capability.number}</span>
                </button>
              ))}

              <div className="watch-calibration-arc arc-left" aria-hidden>
                <span>CAL</span>
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="watch-calibration-arc arc-right" aria-hidden>
                <span>SYNC</span>
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>

              <div className="watch-subdial subdial-left" aria-hidden>
                <span>LOAD</span>
                <i />
                <b>72</b>
              </div>
              <div className="watch-subdial subdial-right" aria-hidden>
                <span>FLOW</span>
                <i />
                <b>∞</b>
              </div>

              <div className="watch-date-window" aria-hidden>
                <span>DIM</span>
                <strong>{selected.number}</strong>
              </div>
              <div className="watch-microcopy watch-microcopy-top" aria-hidden>
                FOUR DIMENSION / CALIBRATED
              </div>
              <div className="watch-microcopy watch-microcopy-bottom" aria-hidden>
                ADAPTIVE SYSTEM · 04 AXIS
              </div>
              <div className="watch-gear gear-one" aria-hidden><i /></div>
              <div className="watch-gear gear-two" aria-hidden><i /></div>
            </div>

            <div className="watch-selection-needle" aria-hidden>
              <span />
            </div>
            <div className="watch-hands" aria-hidden>
              <i className="watch-hour-hand" />
              <i className="watch-minute-hand" />
              <i className="watch-second-hand" />
              <b />
            </div>

            <div className="watch-center">
              <span>FICT / ME</span>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setRevealed((current) => !current)}
                aria-label={revealed ? "Hide capability details" : "Show capability details"}
              >
                <selected.Icon aria-hidden />
                <small>{revealed ? "Close" : "Enter"}</small>
              </button>
              <em>{selected.chineseTitle}</em>
            </div>
          </div>
        </div>

        <div className="capability-watch-controls">
          <button type="button" onClick={() => select(selectedIndex - 1)} aria-label="Previous dimension">
            <ChevronLeft aria-hidden />
          </button>
          <span>Drag to rotate · Press centre to open</span>
          <button type="button" onClick={() => select(selectedIndex + 1)} aria-label="Next dimension">
            <ChevronRight aria-hidden />
          </button>
        </div>
      </div>

      <section className="capability-watch-detail" aria-hidden={!revealed}>
        <div className="watch-detail-head">
          <span>Dimension / {selected.number}</span>
          <selected.Icon aria-hidden />
        </div>
        <p>{selected.chineseTitle}</p>
        <h3>{selected.title}</h3>
        <strong>{selected.statement}</strong>
        <p className="watch-detail-description">{selected.description}</p>

        <div className="watch-detail-fields">
          <div>
            <span>Current fields</span>
            <span>{String(selectedSkills.length).padStart(2, "0")}</span>
          </div>
          {selectedSkills.length > 0 ? (
            selectedSkills.map((skill, index) => (
              <article key={`${selected.id}-${skill.title}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{skill.title}</strong>
                  <p>{skill.summary || "Evidence and details in progress."}</p>
                </div>
                <small>{skill.proficiency || "Exploring"}</small>
              </article>
            ))
          ) : (
            <div className="watch-detail-empty">
              Evidence for this dimension is being prepared.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
