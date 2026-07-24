"use client";

import Link from "next/link";
import {
  ArrowUpRight,
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

const notes = [
  { name: "Do", frequency: 261.63 },
  { name: "Re", frequency: 293.66 },
  { name: "Mi", frequency: 329.63 },
  { name: "Fa", frequency: 349.23 },
  { name: "Sol", frequency: 392 },
] as const;

const icons = [Trophy, FileCheck2, FolderCode, Award, BriefcaseBusiness];

export function MusicalMetrics({ metrics }: { metrics: Metric[] }) {
  const audioContext = useRef<AudioContext | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeNote, setActiveNote] = useState<number | null>(null);

  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      void audioContext.current?.close();
    },
    [],
  );

  function playNote(index: number) {
    const AudioContextClass =
      window.AudioContext ??
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContextClass) return;

    const context =
      audioContext.current ??
      (audioContext.current = new AudioContextClass());

    if (context.state === "suspended") void context.resume();

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const overtone = context.createOscillator();
    const gain = context.createGain();
    const overtoneGain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(notes[index].frequency, now);
    overtone.type = "triangle";
    overtone.frequency.setValueAtTime(notes[index].frequency * 2, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
    overtoneGain.gain.setValueAtTime(0.035, now);
    overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    oscillator.connect(gain).connect(context.destination);
    overtone.connect(overtoneGain).connect(context.destination);
    oscillator.start(now);
    overtone.start(now);
    oscillator.stop(now + 0.65);
    overtone.stop(now + 0.45);

    setActiveNote(index);
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setActiveNote(null), 650);
  }

  return (
    <div className="metrics-grid musical-metrics" aria-label="Musical achievement nodes">
      {metrics.map(({ label, value, href }, index) => {
        const Icon = icons[index];
        const isActive = activeNote === index;

        return (
          <article
            className={isActive ? "metric-note-active" : undefined}
            key={label}
            onPointerEnter={() => playNote(index)}
          >
            <Link
              href={href}
              className="metric-card"
              aria-label={`View ${label}. Musical note ${notes[index].name}`}
              onClick={() => playNote(index)}
              onFocus={() => playNote(index)}
            >
              <div className="metric-card-top">
                <Icon />
                <span>0{index + 1}</span>
              </div>
              <div className="metric-note" aria-hidden="true">
                <span className="metric-note-name">{notes[index].name}</span>
                <span className="metric-wave">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </div>
              <strong>{String(value).padStart(2, "0")}</strong>
              <p>{label}</p>
              <ArrowUpRight className="metric-card-arrow" aria-hidden />
            </Link>
          </article>
        );
      })}
    </div>
  );
}
