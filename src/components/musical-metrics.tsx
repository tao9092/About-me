"use client";

import Link from "next/link";
import {
  Award,
  BriefcaseBusiness,
  FileCheck2,
  FolderCode,
  Trophy,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Metric = {
  label: string;
  value: number;
  href: string;
};

const icons = [Trophy, FileCheck2, FolderCode, Award, BriefcaseBusiness];
const STEP = 360 / icons.length;
const CARD_TONES = [
  [261.63, 392],
  [293.66, 440],
  [329.63, 493.88],
  [349.23, 523.25],
  [392, 587.33],
] as const;

function nearestEquivalent(current: number, target: number) {
  return target + Math.round((current - target) / 360) * 360;
}

export function MusicalMetrics({ metrics }: { metrics: Metric[] }) {
  const cards = useRef<Array<HTMLElement | null>>([]);
  const audioContext = useRef<AudioContext | null>(null);
  const playCardToneRef = useRef<(index: number, volume?: number) => void>(
    () => undefined,
  );
  const animationFrame = useRef<number | null>(null);
  const waveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotation = useRef(0);
  const velocity = useRef(0);
  const snapTarget = useRef<number | null>(null);
  const pointer = useRef({ id: -1, x: 0, startX: 0, time: 0 });
  const dragging = useRef(false);
  const moved = useRef(false);
  const hasInteracted = useRef(false);
  const selectedRef = useRef(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [waveIndex, setWaveIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const animate = () => {
      if (!dragging.current) {
        if (snapTarget.current !== null) {
          const delta = snapTarget.current - rotation.current;
          rotation.current += delta * (reducedMotion ? 1 : 0.12);

          if (Math.abs(delta) < 0.035) {
            rotation.current = snapTarget.current;
            snapTarget.current = null;
          }
        } else {
          rotation.current += velocity.current;
          velocity.current *= 0.965;
          if (Math.abs(velocity.current) < 0.06) {
            velocity.current = 0;
            snapTarget.current =
              Math.round(rotation.current / STEP) * STEP;
          }
        }
      }

      const visibleIndex =
        ((-Math.round(rotation.current / STEP)) % metrics.length +
          metrics.length) %
        metrics.length;
      if (visibleIndex !== selectedRef.current) {
        selectedRef.current = visibleIndex;
        setSelectedIndex(visibleIndex);
        setWaveIndex(visibleIndex);
        if (
          hasInteracted.current &&
          (dragging.current || Math.abs(velocity.current) > 0.06)
        ) {
          playCardToneRef.current(visibleIndex, 0.065);
        }
        if (waveTimer.current) clearTimeout(waveTimer.current);
        waveTimer.current = setTimeout(() => setWaveIndex(null), 720);
      }

      cards.current.forEach((card, index) => {
        if (!card) return;
        const rawPosition = index + rotation.current / STEP;
        const position =
          ((((rawPosition + metrics.length / 2) % metrics.length) +
            metrics.length) %
            metrics.length) -
          metrics.length / 2;
        const distance = Math.abs(position);
        const spread = window.innerWidth <= 650 ? 58 : 72;
        const depth = distance * 115;
        const drop = distance * 27;
        const tilt = -position * 24;
        const scale = 1 - Math.min(distance, 2) * 0.075;
        const blur = Math.min(distance * 1.15, 2.4);
        const brightness = 1 - Math.min(distance, 2) * 0.11;
        const saturation = 1 - Math.min(distance, 2) * 0.09;
        const opacity = 1 - Math.min(distance, 2.35) * 0.22;

        card.style.transform = `translateX(${position * spread}%) translateY(${drop}px) translateZ(${-depth}px) rotateY(${tilt}deg) scale(${scale})`;
        card.style.zIndex = String(10 - Math.round(distance * 2));
        card.style.filter = `blur(${blur}px) brightness(${brightness}) saturate(${saturation})`;
        card.style.opacity = String(Math.max(opacity, 0.38));
      });

      animationFrame.current = requestAnimationFrame(animate);
    };

    animationFrame.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
      if (waveTimer.current) clearTimeout(waveTimer.current);
    };
  }, [metrics.length]);

  function rotateTo(index: number) {
    velocity.current = 0;
    const baseTarget = -index * STEP;
    snapTarget.current = nearestEquivalent(rotation.current, baseTarget);
    selectedRef.current = index;
    setSelectedIndex(index);
  }

  function getAudioContext() {
    const AudioContextClass =
      window.AudioContext ??
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!AudioContextClass) return null;

    const context =
      audioContext.current ??
      (audioContext.current = new AudioContextClass());
    void context.resume();
    return context;
  }

  function playCardTone(index: number, volume = 0.11) {
    const context = getAudioContext();
    if (!context) return;
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    gain.connect(context.destination);

    CARD_TONES[index % CARD_TONES.length].forEach((frequency, toneIndex) => {
      const oscillator = context.createOscillator();
      oscillator.type = toneIndex === 0 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.detune.setValueAtTime(toneIndex * 3, now);
      oscillator.connect(gain);
      oscillator.start(now + toneIndex * 0.025);
      oscillator.stop(now + 0.34);
    });
  }
  useEffect(() => {
    playCardToneRef.current = playCardTone;
  });

  function addRipple(
    event: React.MouseEvent<HTMLAnchorElement>,
    index: number,
  ) {
    const card = cards.current[index];
    if (!card) return;
    const bounds = card.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    [0, 90, 180].forEach((delay, layer) => {
      const ripple = document.createElement("span");
      ripple.className = "card-click-ripple";
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      ripple.style.animationDelay = `${delay}ms`;
      ripple.style.setProperty("--ripple-scale", String(15 + layer * 4));
      ripple.style.setProperty("--ripple-layer", String(layer));
      card.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove(), {
        once: true,
      });
      window.setTimeout(() => ripple.remove(), 1400);
    });
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    hasInteracted.current = true;
    getAudioContext();
    dragging.current = true;
    setIsDragging(true);
    moved.current = false;
    snapTarget.current = null;
    pointer.current = {
      id: event.pointerId,
      x: event.clientX,
      startX: event.clientX,
      time: event.timeStamp,
    };
    velocity.current = 0;
  }

  function moveCarousel(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current || pointer.current.id !== event.pointerId) return;
    const deltaX = event.clientX - pointer.current.x;
    const deltaTime = Math.max(1, event.timeStamp - pointer.current.time);
    if (Math.abs(event.clientX - pointer.current.startX) > 4) {
      moved.current = true;
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
    rotation.current += deltaX * 0.58;
    const throwVelocity = Math.max(
      -20,
      Math.min(20, (deltaX / deltaTime) * 10),
    );
    velocity.current = velocity.current * 0.35 + throwVelocity * 0.65;
    pointer.current.x = event.clientX;
    pointer.current.time = event.timeStamp;
  }

  function stopDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (pointer.current.id !== event.pointerId) return;
    dragging.current = false;
    setIsDragging(false);
    pointer.current.id = -1;
    if (Math.abs(velocity.current) < 0.8) {
      velocity.current = 0;
      snapTarget.current = Math.round(rotation.current / STEP) * STEP;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setTimeout(() => {
      moved.current = false;
    }, 0);
  }

  return (
    <div className="metric-carousel-wrap">
      <p className="carousel-instruction">
        <span aria-hidden>↔</span> Drag or swipe · Select a card to focus
      </p>
      <div
        className={`metric-carousel-stage ${isDragging ? "is-dragging" : ""}`}
        role="region"
        aria-label="Achievement card carousel"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            rotateTo((selectedRef.current + 1) % metrics.length);
          }
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            rotateTo(
              (selectedRef.current - 1 + metrics.length) % metrics.length,
            );
          }
        }}
        onPointerDown={startDrag}
        onPointerMove={moveCarousel}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <div className="carousel-ambient" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <div className="metric-carousel">
          {metrics.map(({ label, value, href }, index) => {
            const Icon = icons[index];
            const isSelected = selectedIndex === index;
            const isPrevious =
              index ===
              (selectedIndex - 1 + metrics.length) % metrics.length;
            const isNext = index === (selectedIndex + 1) % metrics.length;
            return (
              <Link
                className={`carousel-card ${
                  isSelected ? "carousel-card-selected" : ""
                } ${isPrevious ? "carousel-card-previous" : ""} ${
                  isNext ? "carousel-card-next" : ""
                } ${waveIndex === index ? "signal-wave-active" : ""}`}
                href={href}
                key={label}
                ref={(element) => {
                  cards.current[index] = element;
                }}
                draggable={false}
                aria-label={`${label}, ${value}`}
                aria-current={isSelected ? "true" : undefined}
                onDragStart={(event) => event.preventDefault()}
                onClick={(event) => {
                  if (moved.current) {
                    event.preventDefault();
                    moved.current = false;
                    return;
                  }
                  playCardTone(index);
                  addRipple(event, index);
                }}
              >
                <div className="carousel-card-top">
                  <Icon />
                  <span>0{index + 1}</span>
                </div>
                <strong>{String(value).padStart(2, "0")}</strong>
                <div className="carousel-card-footer">
                  <p>{label}</p>
                  <span className="signal-wave" aria-hidden>
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <span className="central-scan" aria-hidden />
              </Link>
            );
          })}
        </div>
        <div className="carousel-floor" aria-hidden />
      </div>
      <div className="carousel-pagination" aria-label="Choose a card">
        {metrics.map(({ label }, index) => (
          <button
            type="button"
            className={selectedIndex === index ? "active" : ""}
            onClick={() => rotateTo(index)}
            aria-label={`Show ${label}`}
            aria-pressed={selectedIndex === index}
            key={label}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
