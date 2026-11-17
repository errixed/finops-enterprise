import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode
} from "react";
import Link from "next/link";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost";

type BadgeTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export function Icon({
  name,
  size = 20,
  className = ""
}: IconProps) {
  return (
    <span
      className={`material-symbols-rounded ${className}`}
      style={{ fontSize: size }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "default" | "sm";
  icon?: string;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "default",
  icon,
  children,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "finops-ui-btn",
        `finops-ui-btn-${variant}`,
        size === "sm" ? "finops-ui-btn-sm" : "",
        className
      ].filter(Boolean).join(" ")}
      {...props}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

interface ButtonLinkProps {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "default" | "sm";
  icon?: string;
  className?: string;
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "default",
  icon,
  className = ""
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={[
        "finops-ui-btn",
        `finops-ui-btn-${variant}`,
        size === "sm" ? "finops-ui-btn-sm" : "",
        className
      ].filter(Boolean).join(" ")}
    >
      {icon && <Icon name={icon} />}
      {children}
    </Link>
  );
}

interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function Card({
  children,
  title,
  description,
  action,
  className = "",
  ...props
}: CardProps) {
  return (
    <section
      className={`finops-ui-card ${className}`}
      {...props}
    >
      {(title || description || action) && (
        <div className="finops-ui-card-header">
          <div>
            {title && (
              <h2 className="finops-ui-card-title">
                {title}
              </h2>
            )}

            {description && (
              <p className="finops-ui-card-description">
                {description}
              </p>
            )}
          </div>

          {action}
        </div>
      )}

      {children}
    </section>
  );
}

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

export function Badge({
  children,
  tone = "neutral",
  className = ""
}: BadgeProps) {
  return (
    <span
      className={`finops-ui-badge finops-ui-badge-${tone} ${className}`}
    >
      {children}
    </span>
  );
}

export function getStatusTone(status: string): BadgeTone {
  switch (status.trim().toLowerCase().replace(/[\s-]+/g, "_")) {
    case "active":
    case "approved":
    case "completed":
    case "success":
    case "low":
    case "low_risk":
      return "success";

    case "pending":
    case "pending_approval":
    case "in_progress":
    case "medium":
    case "medium_risk":
      return "warning";

    case "rejected":
    case "failed":
    case "blocked":
    case "high":
    case "high_risk":
    case "critical":
      return "danger";

    case "processing":
    case "under_review":
      return "info";

    default:
      return "neutral";
  }
}

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({
  status,
  label
}: StatusBadgeProps) {
  return (
    <Badge tone={getStatusTone(status)}>
      {label ??
        status.replace(/[_-]/g, " ").replace(/\b\w/g, char =>
          char.toUpperCase()
        )}
    </Badge>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({
  title,
  description,
  action
}: PageHeaderProps) {
  return (
    <header className="finops-ui-page-header">
      <div>
        <h1 className="finops-ui-page-title">
          {title}
        </h1>

        {description && (
          <p className="finops-ui-page-description">
            {description}
          </p>
        )}
      </div>

      {action}
    </header>
  );
}