"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, X } from "lucide-react";
import { useState } from "react";
const links = [
  ["Projects", "/projects"],
  ["Competitions", "/competitions"],
  ["Certificates", "/certificates"],
  ["Experience", "/experience"],
  ["Index", "/explore"],
];
export function PublicNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  function theme() {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem(
      "theme",
      document.documentElement.classList.contains("dark") ? "dark" : "light",
    );
  }
  return (
    <nav className="public-nav auros-nav" aria-label="Primary">
      <div className="nav-inner">
        <Link href="/" className="auros-brand">
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
          {links.map(([label, href]) => (
            <Link
              key={href}
              className={path === href ? "active" : ""}
              href={href}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="nav-actions">
          <button onClick={theme} aria-label="Toggle color theme">
            <Moon />
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
