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

function nearestEquivalent(current: number, target: number) {
  return target + Math.round((current - target) / 360) * 360;
}

export function MusicalMetrics({ metrics }: { metrics: Metric[] }) {
  const cards = useRef<Array<HTMLElement | null>>([]);
  const animationFrame = useRef<number | null>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotation = useRef(0);
  const velocity = useRef(0);
  const snapTarget = useRef<number | null>(null);
  const pointer = useRef({ id: -1, x: 0, startX: 0 });
  const dragging = useRef(false);
  const moved = useRef(false);
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
          velocity.current *= 0.93;
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
      if (snapTimer.current) clearTimeout(snapTimer.current);
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

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    dragging.current = true;
    setIsDragging(true);
    moved.current = false;
    snapTarget.current = null;
    if (snapTimer.current) clearTimeout(snapTimer.current);
    pointer.current = {
      id: event.pointerId,
      x: event.clientX,
      startX: event.clientX,
    };
    velocity.current = 0;
  }

  function moveCarousel(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current || pointer.current.id !== event.pointerId) return;
    const deltaX = event.clientX - pointer.current.x;
    if (Math.abs(event.clientX - pointer.current.startX) > 6) {
      moved.current = true;
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
    rotation.current += deltaX * 0.34;
    velocity.current = deltaX * 0.055;
    pointer.current.x = event.clientX;
  }

  function stopDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (pointer.current.id !== event.pointerId) return;
    dragging.current = false;
    setIsDragging(false);
    pointer.current.id = -1;
    snapTimer.current = setTimeout(() => {
      velocity.current = 0;
      const target = Math.round(rotation.current / STEP) * STEP;
      snapTarget.current = target;
    }, 360);
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
