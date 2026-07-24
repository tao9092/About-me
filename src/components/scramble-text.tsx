"use client";

import { useEffect, useRef, useState } from "react";

const glyphs = "01<>/{}[]#*+?=:_";

export function ScrambleText({
  text,
  delay = 0,
  className,
}: {
  text: string;
  delay?: number;
  className?: string;
}) {
  const element = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(() =>
    [...text].map((character) => (character === " " ? " " : "·")).join(""),
  );

  useEffect(() => {
    const node = element.current;
    if (!node) return;

    let frame = 0;
    let timeout = 0;
    let startedAt = 0;
    let lastShuffle = 0;
    const characters = [...text];
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const reveal = (time: number) => {
      if (!startedAt) startedAt = time;
      const elapsed = time - startedAt;
      const revealed = Math.min(
        characters.length,
        Math.floor(elapsed / 75),
      );

      if (time - lastShuffle > 48 || revealed === characters.length) {
        setDisplay(
          characters
            .map((character, index) => {
              if (character === " ") return " ";
              if (index < revealed) return character;
              return glyphs[(index * 7 + Math.floor(time / 48)) % glyphs.length];
            })
            .join(""),
        );
        lastShuffle = time;
      }

      if (revealed < characters.length) {
        frame = requestAnimationFrame(reveal);
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        if (reducedMotion) {
          setDisplay(text);
          return;
        }
        timeout = window.setTimeout(() => {
          frame = requestAnimationFrame(reveal);
        }, delay);
      },
      { threshold: 0.25 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [delay, text]);

  return (
    <span ref={element} className={className} aria-label={text}>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}
