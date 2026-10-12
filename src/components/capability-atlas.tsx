"use client";

import {
  BookOpen,
  BrainCircuit,
  Dumbbell,
  Network,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  type RangeMode,
  ShootingRangeScene,
} from "@/components/shooting-range-scene";

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

export function CapabilityAtlas({ skills }: { skills: Skill[] }) {
  const [detailIndex, setDetailIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [aimedIndex, setAimedIndex] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [mode, setMode] = useState<RangeMode>("idle");
  const [aimingDownSights, setAimingDownSights] = useState(false);
  const [locked, setLocked] = useState(false);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef(open);
  const lockLostAtRef = useRef(0);

  const skillsByCapability: Record<CapabilityId, Skill[]> = {
    learning: [],
    adaptive: [],
    physical: [],
    social: [],
  };
  skills.forEach((skill) => {
    skillsByCapability[getCapabilityId(skill.category)].push(skill);
  });

  const selected = capabilities[detailIndex];
  const selectedSkills = skillsByCapability[selected.id];
  const aimed = aimedIndex === null ? null : capabilities[aimedIndex];

  function openTarget(index: number) {
    setDetailIndex(index);
    setOpen(true);
  }

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Losing the pointer lock while playing (Esc) is the pause signal. Opening a
  // record releases the lock on purpose, so that one does not pause.
  function handleLockChange(nextLocked: boolean) {
    setLocked(nextLocked);
    if (nextLocked) return;
    lockLostAtRef.current = performance.now();
    if (openRef.current) return;
    setMode((current) => (current === "playing" ? "paused" : current));
  }

  function exitRange() {
    setOpen(false);
    setMode("idle");
  }

  // Esc closes an open record first, otherwise pauses. With pointer lock the
  // browser consumes Esc itself and handleLockChange does the pausing.
  useEffect(() => {
    if (!open && mode !== "playing") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (open) {
        setOpen(false);
        return;
      }
      if (document.pointerLockElement) return;
      if (performance.now() - lockLostAtRef.current < 400) return;
      setMode("paused");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, mode]);

  useEffect(() => {
    if (mode === "paused") resumeRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (open) closeRef.current?.focus({ preventScroll: true });
  }, [open, detailIndex]);

  const rootClass = [
    "capability-range",
    `is-${mode}`,
    open ? "is-open" : "",
    aimingDownSights ? "is-ads" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClass}>
      <ShootingRangeScene
        targets={capabilities}
        mode={mode}
        activeIndex={open ? detailIndex : null}
        muted={muted}
        onAim={setAimedIndex}
        onAds={setAimingDownSights}
        onHit={openTarget}
        onLockChange={handleLockChange}
      />

      <div className="range-hud" aria-hidden>
        <div className="range-readout">
          <span>Target lock</span>
          <strong>{aimed?.number ?? "--"}</strong>
        </div>
        <div className={`range-crosshair${aimed ? " is-locked" : ""}`}>
          <i />
          <i />
          <i />
          <i />
          <b />
        </div>
        <div className={`range-aim-label${aimed ? " is-visible" : ""}`}>
          <span>{aimed?.chineseTitle}</span>
          <small>{aimed?.title}</small>
        </div>
        <p className="range-hint">
          <span className="range-hint-mouse">
            Move mouse to look · Click to fire · Right-click to aim · Esc to pause
          </span>
          <span className="range-hint-touch">Drag to look · Tap to fire</span>
        </p>
      </div>

      {mode === "playing" && !open && !locked && (
        <p className="range-relock" aria-hidden>
          Click to aim
        </p>
      )}

      {mode === "playing" && (
        <button
          type="button"
          className="range-pause-button"
          onClick={() => setMode("paused")}
          aria-label="Pause the range"
        >
          <Pause aria-hidden />
          <span className="hint-mouse">Esc</span>
          <span className="hint-touch">Pause</span>
        </button>
      )}

      {mode === "idle" && (
        <button
          type="button"
          className="range-start"
          onClick={() => setMode("playing")}
        >
          <span className="range-start-card">
            <small>Capability range / 03</small>
            <strong>Enter the range</strong>
            <span>
              Four targets, four dimensions.{" "}
              <span className="hint-mouse">
                Aim with your mouse and shoot a sign to open it.
              </span>
              <span className="hint-touch">
                Drag sideways to aim and tap to shoot a sign open.
              </span>
            </span>
            <em>
              <Play aria-hidden /> <span className="hint-mouse">Click to start</span>
              <span className="hint-touch">Tap to start</span>
            </em>
          </span>
        </button>
      )}

      {mode === "paused" && (
        <div className="range-pause" role="dialog" aria-modal="true" aria-label="Paused">
          <div className="range-pause-card">
            <small>Paused · 已暂停</small>
            <strong>Take a breath.</strong>
            <div className="range-pause-actions">
              <button
                type="button"
                className="range-pause-primary"
                ref={resumeRef}
                onClick={() => setMode("playing")}
              >
                Resume
              </button>
              <button type="button" onClick={exitRange}>
                Exit range
              </button>
            </div>
            <span className="hint-mouse">Resume locks the mouse back into the range.</span>
            <span className="hint-touch">Drag sideways to aim · Tap to fire</span>
          </div>
        </div>
      )}

      <div className="range-controls">
        <button
          type="button"
          className="range-sound"
          onClick={() => setMuted((current) => !current)}
          aria-label={muted ? "Unmute shots" : "Mute shots"}
          aria-pressed={muted}
        >
          {muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
        </button>
        <div className="range-shortcuts" role="group" aria-label="Open a capability directly">
          {capabilities.map((capability, index) => (
            <button
              type="button"
              onClick={() => openTarget(index)}
              aria-label={`Open ${capability.title}`}
              key={capability.id}
            >
              {capability.number}
            </button>
          ))}
        </div>
      </div>

      <div className="range-detail-backdrop" aria-hidden />
      <section
        className="range-detail"
        role="dialog"
        aria-modal={open}
        aria-label={`${selected.title} details`}
        inert={!open}
      >
        <div className="range-detail-head">
          <div>
            <selected.Icon aria-hidden />
            <span>Dimension / {selected.number}</span>
          </div>
          <button
            type="button"
            className="range-close"
            ref={closeRef}
            onClick={() => setOpen(false)}
            aria-label="Close capability details"
          >
            <X aria-hidden />
          </button>
        </div>
        <p className="range-detail-cn">{selected.chineseTitle}</p>
        <h3>{selected.title}</h3>
        <strong>{selected.statement}</strong>
        <p className="range-detail-description">{selected.description}</p>

        <div className="range-detail-fields">
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
            <div className="range-detail-empty">
              Evidence for this dimension is being prepared.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
