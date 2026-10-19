"use client";

import { useState, useSyncExternalStore } from "react";
import { ambienceUnlocked, playOpening, setSoundEnabled, soundEnabled, subscribeSound } from "@/components/route-sfx";

const subscribeNothing = () => () => {};

/** Holds the home hero's opening (fixes.css pauses it while the gate waits) until
 * the visitor enters, since browsers play sound only after a tap: the opening
 * and its score then start together. Coming back to the page once sound is
 * allowed, it opens at once. Skipped, like the opening, for reduced motion. */
export function IntroGate() {
  const [entered, setEntered] = useState(false);
  // Already allowed (the visitor came back here from another page): no need to wait.
  const unlocked = useSyncExternalStore(subscribeNothing, ambienceUnlocked, () => false);
  const sound = useSyncExternalStore(subscribeSound, soundEnabled, () => true);
  const waiting = !entered && !unlocked;

  function enter(withSound: boolean) {
    if (!withSound) setSoundEnabled(false);
    playOpening();
    setEntered(true);
  }

  return (
    <div className="intro-gate" data-waiting={waiting || undefined} aria-hidden={!waiting}>
      <p>Personal Achievement Hub</p>
      <button type="button" className="intro-gate-enter" onClick={() => enter(true)} tabIndex={waiting ? 0 : -1} autoFocus>
        <span>Enter</span>
      </button>
      {sound && (
        <button type="button" className="intro-gate-quiet" onClick={() => enter(false)} tabIndex={waiting ? 0 : -1}>
          Enter without sound
        </button>
      )}
    </div>
  );
}
