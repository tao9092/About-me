"use client";

import { useEffect } from "react";

// Looping CSS animations keep ticking while their element is off screen, and any
// the browser declines to run on the compositor (it declines the ones it judges
// not visible) make it repaint and re-layer the whole page on every frame, which
// a phone pays for in dropped frames. Each endless, time-driven loop is paused
// while its element is well off screen and resumed as it comes back, so nothing
// that can be seen changes. Scroll-driven animations are left alone.
const isLoop = (animation: Animation): animation is CSSAnimation =>
  animation instanceof CSSAnimation &&
  animation.timeline === document.timeline &&
  animation.effect?.getTiming().iterations === Infinity;

export function OffscreenLoops() {
  useEffect(() => {
    const loops = new Map<Element, Set<CSSAnimation>>();
    const offscreen = new WeakSet<Element>();
    const paused = new WeakSet<Animation>(); // only the ones paused here are resumed

    const hold = (animation: CSSAnimation) => {
      if (animation.playState !== "running") return;
      animation.pause();
      paused.add(animation);
    };
    const resume = (animation: CSSAnimation) => {
      if (!paused.has(animation)) return;
      paused.delete(animation);
      animation.play();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const hidden = !entry.isIntersecting;
          if (hidden) offscreen.add(entry.target);
          else offscreen.delete(entry.target);
          loops.get(entry.target)?.forEach(hidden ? hold : resume);
        }
      },
      { rootMargin: "200px" },
    );

    const track = (animation: Animation) => {
      if (!isLoop(animation)) return;
      const target = (animation.effect as KeyframeEffect | null)?.target;
      if (!target) return;
      let set = loops.get(target);
      if (!set) {
        set = new Set();
        loops.set(target, set);
        observer.observe(target);
      }
      set.add(animation);
      if (offscreen.has(target)) hold(animation);
    };
    const untrack = (target: Element) => {
      const set = loops.get(target);
      if (!set) return;
      for (const animation of set) if (animation.playState === "idle") set.delete(animation);
      if (set.size) return;
      loops.delete(target);
      observer.unobserve(target);
    };

    const onStart = (event: AnimationEvent) => {
      if (!(event.target instanceof Element)) return;
      event.target
        .getAnimations({ subtree: Boolean(event.pseudoElement) })
        .filter((animation) => (animation as CSSAnimation).animationName === event.animationName)
        .forEach(track);
    };
    const onCancel = (event: AnimationEvent) => {
      if (event.target instanceof Element) untrack(event.target);
    };

    document.getAnimations().forEach(track);
    document.addEventListener("animationstart", onStart, true);
    document.addEventListener("animationcancel", onCancel, true);
    return () => {
      document.removeEventListener("animationstart", onStart, true);
      document.removeEventListener("animationcancel", onCancel, true);
      observer.disconnect();
      for (const set of loops.values()) set.forEach(resume);
    };
  }, []);

  return null;
}
