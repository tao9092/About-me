"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type MouseEvent, type ReactNode } from "react";
import { focusProject } from "@/components/motherboard";

// A project card's link: pointing at it lights the project's chip on the
// motherboard above; choosing it dives into the board. The card's board grows
// to fill the screen and boots, a scan line passing and its label coming up,
// then the project's page opens under it (whose top is the same board) and
// the boot screen fades away (BootFade).

const ZOOM_MS = 720;

export function LabCardLink({ slug, label, color, children }: { slug: string; label: string; color: string; children: ReactNode }) {
  const router = useRouter();
  const href = `/projects/${slug}`;

  const dive = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (document.querySelector(".lab-zoom")) {
      event.preventDefault();
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    event.preventDefault();
    const board = event.currentTarget.closest("[data-board]")?.querySelector(".lab-board")?.getBoundingClientRect();
    const zoom = document.createElement("div");
    zoom.className = "lab-zoom";
    zoom.setAttribute("aria-hidden", "true");
    zoom.style.setProperty("--ink", color);
    if (board) Object.assign(zoom.style, { top: `${board.top}px`, left: `${board.left}px`, width: `${board.width}px`, height: `${board.height}px` });
    const name = document.createElement("strong");
    name.textContent = label;
    const line = document.createElement("span");
    line.textContent = "Booting…";
    zoom.append(name, line);
    document.body.append(zoom);
    requestAnimationFrame(() => requestAnimationFrame(() => zoom.classList.add("is-open")));
    router.prefetch(href);
    window.setTimeout(() => {
      // Behind the boot screen: back to the top, so the page opens at its hero.
      window.scrollTo({ top: 0, behavior: "instant" });
      router.push(href, { scroll: false });
    }, ZOOM_MS);
    // Should the page never take it away, it goes on its own.
    window.setTimeout(() => leave(zoom), 6000);
  };

  return (
    <Link
      className="stretched-link"
      href={href}
      onClick={dive}
      onMouseEnter={() => focusProject(slug)}
      onMouseLeave={() => focusProject(null)}
      onFocus={() => focusProject(slug)}
      onBlur={() => focusProject(null)}
    >
      {children}
    </Link>
  );
}

function leave(zoom: Element | null) {
  if (!zoom || zoom.classList.contains("is-leaving")) return;
  zoom.classList.add("is-leaving");
  window.setTimeout(() => zoom.remove(), 700);
}

/** On a project's page: fades the boot screen left by the dive from its card. */
export function BootFade() {
  useEffect(() => {
    const id = window.setTimeout(() => leave(document.querySelector(".lab-zoom")), 120);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
