"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  AtSign,
  Award,
  BookOpen,
  Briefcase,
  FileStack,
  FolderOpen,
  GraduationCap,
  Home,
  Link2,
  ListTree,
  Medal,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Tags,
  Trophy,
  UserCircle,
} from "lucide-react";
import { useState } from "react";
const groups = [
  [
    "Workspace",
    [
      ["Dashboard", "/admin", Home],
      ["File Library", "/admin/file-library", FolderOpen],
    ],
  ],
  [
    "Content",
    [
      ["Competitions", "/admin/competitions", Trophy],
      ["Upcoming", "/admin/upcoming-competitions", Medal],
      ["Certificates", "/admin/certificates", Award],
      ["Education", "/admin/education", GraduationCap],
      ["Projects", "/admin/projects", FileStack],
      ["Experience", "/admin/experiences", Briefcase],
      ["Awards", "/admin/awards", Award],
      ["Capabilities", "/admin/skills", BookOpen],
      ["Links", "/admin/links", Link2],
      ["Resume", "/admin/resume", UserCircle],
    ],
  ],
  [
    "Organize",
    [
      ["Categories", "/admin/categories", ListTree],
      ["Tags", "/admin/tags", Tags],
      ["Archive", "/admin/archive", Archive],
    ],
  ],
  [
    "System",
    [
      ["Site Settings", "/admin/site-settings", Settings],
      ["Account", "/admin/account", AtSign],
    ],
  ],
] as const;
export function AdminNav() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside className={collapsed ? "admin-sidebar collapsed" : "admin-sidebar"}>
      <div className="admin-brand">
        <span>AH</span>
        <strong>Achievement Hub</strong>
      </div>
      <div className="side-scroll">
        {groups.map(([name, links]) => (
          <div className="side-group" key={name}>
            <p>{name}</p>
            {links.map(([label, raw, Icon]) => {
              const href = String(raw);
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={path === href ? "active" : ""}
                >
                  <Icon />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <button
        className="collapse-button"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        <span>{collapsed ? "Expand" : "Collapse sidebar"}</span>
      </button>
    </aside>
  );
}
