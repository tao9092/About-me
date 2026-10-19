"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, KeyRound, Menu, Moon, Sun, Volume2, VolumeX, X } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { type ShutterVariant, shutterKicker, useRouteTransition } from "@/components/route-transition";
import { setSoundEnabled, soundEnabled, subscribeSound } from "@/components/route-sfx";
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
  const [openPath, setOpenPath] = useState(path);
  const navRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const playShutter = useRouteTransition();
  // The transitions' sound, on unless the visitor turned it off (on in server HTML).
  const sound = useSyncExternalStore(subscribeSound, soundEnabled, () => true);
  // Plays the destination's transition in place of a plain client navigation.
  const navigate = (index: number) => (event: { preventDefault: () => void }) => {
    const [label, href, variant] = links[index];
    if (playShutter({ href, label, index, total: links.length, variant })) event.preventDefault();
  };
  // A route change from anywhere else (back, a link on the page) closes the menu.
  if (openPath !== path) {
    setOpenPath(path);
    setOpen(false);
  }

  // While the phone menu is open the page stays put underneath, Esc closes it,
  // and keyboard focus stays within the bar and the menu.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      menuButtonRef.current?.focus();
    };
    const onFocus = (event: FocusEvent) => {
      const node = event.target as Node;
      if (navRef.current?.contains(node) || sheetRef.current?.contains(node)) return;
      sheetRef.current?.querySelector("a")?.focus();
    };
    const wide = window.matchMedia("(min-width: 901px)");
    const onWide = () => wide.matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    wide.addEventListener("change", onWide);
    return () => {
      root.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  function theme() {
    const nextDark = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", nextDark);
    document.documentElement.style.colorScheme = nextDark ? "dark" : "light";
    localStorage.setItem("theme", nextDark ? "dark" : "light");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", nextDark ? "#012624" : "#f7fafb");
    window.dispatchEvent(new CustomEvent("themechange", { detail: nextDark ? "dark" : "light" }));
  }
  return (
    <>
      <nav ref={navRef} className={open ? "public-nav auros-nav menu-open" : "public-nav auros-nav"} aria-label="Primary">
        <div className="nav-inner">
          <Link href="/" className="auros-brand" onClick={() => setOpen(false)} onNavigate={navigate(0)}>
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
          <div className="nav-links">
            {links.map(([label, href], index) => (
              <Link key={href} className={path === href ? "active" : ""} href={href} onNavigate={navigate(index)}>
                {label}
              </Link>
            ))}
          </div>
          <div className="nav-actions">
            <button
              onClick={() => setSoundEnabled(!sound)}
              aria-label={sound ? "Mute sound" : "Turn on sound"}
              title={sound ? "Mute sound" : "Turn on sound"}
            >
              {sound ? <Volume2 /> : <VolumeX />}
            </button>
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
              ref={menuButtonRef}
              className="menu"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? "Close menu" : "Open menu"}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </nav>
      {/* The phone and tablet menu: a sheet under the bar listing every
          destination with the scene its transition plays. It sits outside the
          nav, whose backdrop blur would otherwise trap a fixed child. */}
      <div
        id="site-menu"
        ref={sheetRef}
        className={open ? "site-menu is-open" : "site-menu"}
        inert={!open}
      >
        <nav className="site-menu-links" aria-label="Site menu">
          <p className="site-menu-kicker">
            <span>Menu</span>
            <span>{String(links.length).padStart(2, "0")} destinations</span>
          </p>
          {links.map(([label, href, variant], index) => (
            <Link
              key={href}
              href={href}
              className={`site-menu-link v-${variant}${path === href ? " active" : ""}`}
              aria-current={path === href ? "page" : undefined}
              style={{ "--i": index } as CSSProperties}
              onClick={() => setOpen(false)}
              onNavigate={navigate(index)}
            >
              <span className="site-menu-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="site-menu-label">
                <strong>{label}</strong>
                <small>{path === href ? "You are here" : shutterKicker(variant)}</small>
              </span>
              <ArrowUpRight aria-hidden />
            </Link>
          ))}
        </nav>
        <div className="site-menu-foot" style={{ "--i": links.length } as CSSProperties}>
          <Link className="aurora-button" href="/admin/login" onClick={() => setOpen(false)}>
            <KeyRound aria-hidden /> Owner access
          </Link>
          <p>Personal Achievement Hub · a living record</p>
        </div>
      </div>
    </>
  );
}
