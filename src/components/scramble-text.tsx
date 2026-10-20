"use client";

import { useEffect, useRef, useState } from "react";

const glyphs = "01<>/{}[]#*+?=:_";

// Every scramble on a page waits on one shared observer rather than one each: the
// home page alone has over a hundred, and the browser checks every observer on
// every frame. Each text is dropped from it as soon as it first comes into view.
const waiting = new Map<Element, () => void>();
let sharedObserver: IntersectionObserver | null = null;
function whenSeen(node: Element, callback: () => void) {
  sharedObserver ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const seen = waiting.get(entry.target);
        stopWaiting(entry.target);
        seen?.();
      }
    },
    { threshold: 0.25 },
  );
  waiting.set(node, callback);
  sharedObserver.observe(node);
}
function stopWaiting(node: Element) {
  if (!waiting.delete(node)) return;
  sharedObserver?.unobserve(node);
}

export function ScrambleText({
  text,
  delay = 0,
  speed = 75,
  className,
}: {
  text: string;
  delay?: number;
  /** Milliseconds per revealed character. */
  speed?: number;
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
        Math.floor(elapsed / speed),
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

    whenSeen(node, () => {
      if (reducedMotion) {
        setDisplay(text);
        return;
      }
      timeout = window.setTimeout(() => {
        frame = requestAnimationFrame(reveal);
      }, delay);
    });

    return () => {
      stopWaiting(node);
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, [delay, speed, text]);

  return (
    <span ref={element} className={className} aria-label={text}>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}
