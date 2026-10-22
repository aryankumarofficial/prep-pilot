import {
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  FileSearch,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  MessageSquare,
  Plane,
  Settings,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { errorMessage } from "../api";
import { Button, ErrorNotice, formatDate } from "./ui";

const links = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/roadmap", label: "My roadmap", icon: Map },
  { to: "/assessments", label: "Assessments", icon: ClipboardCheck },
  { to: "/resume", label: "Resume & role", icon: FileSearch },
  { to: "/interviews", label: "Interview studio", icon: MessageSquare },
  { to: "/resources", label: "Resource library", icon: BookOpen },
];
export default function Shell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  const [error, setError] = useState("");
  const main = useRef<HTMLElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => {
      setMobile(media.matches);
      if (!media.matches) setOpen(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (open && mobile)
      sidebar.current?.querySelector<HTMLAnchorElement>("a")?.focus();
  }, [open, mobile]);
  useEffect(() => {
    setOpen(false);
    main.current?.focus();
  }, [location.pathname]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menu.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  const active = links.find((l) =>
    l.to === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(l.to),
  );
  return (
    <div className="workspace">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {open ? (
        <button
          className="nav-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      ) : null}
      <aside
        ref={sidebar}
        inert={mobile && !open}
        className={`sidebar ${open ? "open" : ""}`}
        id="navigation"
        onKeyDown={(event) => {
          if (!open || !mobile || event.key !== "Tab") return;
          const items = sidebar.current?.querySelectorAll<HTMLElement>(
            "a[href],button:not([disabled])",
          );
          if (!items?.length) return;
          const first = items[0],
            last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <NavLink to="/" className="brand">
          <span className="brand-symbol">
            <Plane size={24} />
          </span>
          <span>
            PrepPilot<span className="brand-ai">AI</span>
          </span>
        </NavLink>
        <p className="nav-label">YOUR WORKSPACE</p>
        <nav aria-label="Main navigation">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="study-note">
            <span className="tiny-dot" />A little, consistently.
            <p>
              {user?.daily_minutes} minutes a day can become a useful habit.
            </p>
          </div>
          <NavLink to="/settings" className="nav-item">
            <Settings size={18} />
            Study preferences
          </NavLink>
          <Button
            variant="ghost"
            onClick={() => {
              void logout().catch((e) => setError(errorMessage(e)));
            }}
          >
            <LogOut size={17} />
            Sign out
          </Button>
        </div>
      </aside>
      <div className="workspace-body" inert={mobile && open}>
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              ref={menu}
              className="icon-button menu-toggle"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="navigation"
              aria-label="Toggle navigation"
            >
              {open ? <X /> : <Menu />}
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{active?.label ?? "Study preferences"}</strong>
          </div>
          <div className="topbar-right">
            <span className="target-date">
              Target · {user ? formatDate(user.target_date) : ""}
            </span>
            <span className="avatar" aria-label={user?.full_name}>
              {user?.full_name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
          </div>
        </header>
        <main id="main" ref={main} tabIndex={-1} className="main-content">
          {error ? <ErrorNotice message={error} /> : null}
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Built around your next step.</span>
          <span>Starter assessments · Evidence, with context</span>
        </footer>
      </div>
    </div>
  );
}
