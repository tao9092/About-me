"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// The Experience page's moving parts: split-flap letters that riffle into place
// as the board comes up, a station clock, and the line, along which a train
// rides with the scroll, lighting each stop it passes.

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·-/";

/** Text on a split-flap board: each letter flips through others before settling. */
export function FlapText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const letters = [...text.toUpperCase()];
    const settle = letters.map((_, index) => 380 + index * 28 + Math.random() * 160);
    const begin = performance.now() + delay;
    let id = 0;
    const flip = () => {
      const now = performance.now() - begin;
      if (now < 0) {
        id = window.setTimeout(flip, 40);
        return;
      }
      let done = true;
      const next = letters
        .map((letter, index) => {
          if (letter === " " || now >= settle[index]) return letter;
          done = false;
          return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        })
        .join("");
      setShown(next);
      if (!done) id = window.setTimeout(flip, 45);
    };
    id = window.setTimeout(flip, 0);
    return () => window.clearTimeout(id);
  }, [text, delay]);
  return (
    <span className="xp-flap" aria-label={text}>
      {/* Grouped by word, so a line breaks between words, not inside one. */}
      {shown.split(" ").map((word, w) => (
        <span className="xp-flap-word" key={w} aria-hidden>
          {[...word].map((letter, index) => (
            <span key={index}>{letter}</span>
          ))}
        </span>
      ))}
    </span>
  );
}

/** The station clock, in Malaysia's time; blank until the page is in the browser. */
export function StationClock() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const format = () =>
      new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kuala_Lumpur" });
    const tick = () => setTime(format());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return <span className="xp-clock">{time ?? "--:--:--"}</span>;
}

/** The line: a train rides down the track as the page scrolls, lighting the stops it reaches. */
export function Line({ children }: { children: ReactNode }) {
  const line = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = line.current;
    if (!element) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const box = element.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.55 - box.top) / box.height));
      element.style.setProperty("--ride", progress.toFixed(4));
      const reach = box.top + progress * box.height;
      element.querySelectorAll<HTMLElement>("[data-stop]").forEach((stop) => {
        stop.classList.toggle("is-reached", stop.getBoundingClientRect().top + 40 <= reach);
      });
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", request, { passive: true });
    addEventListener("resize", request);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener("scroll", request);
      removeEventListener("resize", request);
    };
  }, []);
  return (
    <div className="xp-line" ref={line}>
      <div className="xp-track" aria-hidden>
        <i className="xp-train" />
      </div>
      {children}
    </div>
  );
}
