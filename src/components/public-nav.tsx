"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useState } from "react";
import { type ShutterVariant, useRouteTransition } from "@/components/route-transition";
// Each destination opens with its own page transition.
const links: [label: string, href: string, shutter: ShutterVariant][] = [
  ["Home", "/", "vinyl"],
  ["Projects", "/projects", "code"],
  ["Competitions", "/competitions", "scope"],
  ["Certificates", "/certificates", "saturn"],
  ["Experience", "/experience", "train"],
  ["Index", "/explore", "blackhole"],
];
export function PublicNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const playShutter = useRouteTransition();
  // Plays the destination's transition in place of a plain client navigation.
  const navigate = (index: number) => (event: { preventDefault: () => void }) => {
    const [label, href, variant] = links[index];
    if (playShutter({ href, label, index, total: links.length, variant })) event.preventDefault();
  };

  function theme() {
    const nextDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextDark);
    document.documentElement.style.colorScheme = nextDark ? "dark" : "light";
    localStorage.setItem("theme", nextDark ? "dark" : "light");
    window.dispatchEvent(new CustomEvent("themechange", { detail: nextDark ? "dark" : "light" }));
  }
  return (
    <nav className="public-nav auros-nav" aria-label="Primary">
      <div className="nav-inner">
        <Link href="/" className="auros-brand" onNavigate={navigate(0)}>
          <span className="brand-mark">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <strong>
            ACHIEVEMENT
            <br />
            HUB
          </strong>
        </Link>
        <div className={open ? "nav-links open" : "nav-links"}>
          {links.map(([label, href], index) => (
            <Link
              key={href}
              className={path === href ? "active" : ""}
              href={href}
              onClick={() => setOpen(false)}
              onNavigate={navigate(index)}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="nav-actions">
          <button
            onClick={theme}
            aria-label="Toggle color theme"
            title="Toggle color theme"
          >
            <Sun className="theme-icon theme-icon-sun" />
            <Moon className="theme-icon theme-icon-moon" />
          </button>
          <Link className="nav-cta" href="/admin/login">
            Owner access
          </Link>
          <button
            className="menu"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label="Open menu"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </nav>
  );
}
