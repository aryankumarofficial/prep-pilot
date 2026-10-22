import {
  ArrowRight,
  Check,
  LoaderCircle,
  Orbit,
  TriangleAlert,
} from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

export function Button({
  children,
  variant = "primary",
  busy = false,
  className = "",
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled || busy}
      className={`button ${variant} ${className}`}
    >
      {busy ? (
        <LoaderCircle className="spin" size={16} aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}
export function PageHeader({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children ? <p className="lead">{children}</p> : null}
      </div>
      {action}
    </div>
  );
}
export function Loading({
  text = "Loading your workspace…",
}: {
  text?: string;
}) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={24} />
      <span>{text}</span>
    </div>
  );
}
export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="notice error" role="alert">
      <TriangleAlert size={19} aria-hidden="true" />
      <span>{message}</span>
      {retry ? (
        <Button variant="ghost" onClick={retry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice">
      <Orbit size={18} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
export function Empty({
  title,
  children,
  to,
  label,
}: {
  title: string;
  children: ReactNode;
  to?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <div className="icon-tile">
        <Orbit size={25} />
      </div>
      <h2>{title}</h2>
      <p>{children}</p>
      {to ? (
        <Link to={to} className="button primary">
          {label}
          <ArrowRight size={17} />
        </Link>
      ) : null}
    </div>
  );
}
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function Progress({
  value,
  label,
}: {
  value: number | null;
  label: string;
}) {
  return (
    <div
      className="meter"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value === null ? "Not assessed" : `${value}%`}
    >
      <span style={{ width: `${value ?? 0}%` }} />
    </div>
  );
}
export function Status({ completed }: { completed: boolean }) {
  return (
    <span className={`status-dot ${completed ? "done" : ""}`}>
      {completed ? <Check size={12} /> : null}
    </span>
  );
}
export function formatDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) {
  return new Intl.DateTimeFormat("en-IN", options).format(
    new Date(value.length === 10 ? `${value}T12:00:00` : value),
  );
}
