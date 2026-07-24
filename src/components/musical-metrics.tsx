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
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    const partials = [
      { ratio: 1, volume: 0.38, decay: 1.35, type: "triangle" },
      { ratio: 2, volume: 0.16, decay: 0.82, type: "sine" },
      { ratio: 3, volume: 0.075, decay: 0.52, type: "sine" },
      { ratio: 4, volume: 0.035, decay: 0.34, type: "sine" },
    ] as const;

    master.gain.setValueAtTime(1.28, now);
    compressor.threshold.setValueAtTime(-12, now);
    compressor.knee.setValueAtTime(12, now);
    compressor.ratio.setValueAtTime(4, now);
    compressor.attack.setValueAtTime(0.003, now);
    compressor.release.setValueAtTime(0.18, now);
    master.connect(compressor).connect(context.destination);

    partials.forEach(({ ratio, volume, decay, type }) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(notes[index].frequency * ratio, now);
      oscillator.detune.setValueAtTime(ratio === 1 ? -2 : ratio, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(volume * 0.34, now + 0.09);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      oscillator.connect(gain).connect(master);
      oscillator.start(now);
      oscillator.stop(now + decay + 0.03);
    });

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
