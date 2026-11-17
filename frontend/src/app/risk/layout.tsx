"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "../../../config";
import "./risk-ui.css";

const sections = [
  {
    label: "Overview",
    icon: "speed",
    href: ROUTES.risk
  },
  {
    label: "Risks & Alerts",
    icon: "warning",
    href: ROUTES.riskAlerts
  },
  {
    label: "Risk Assessment",
    icon: "shield",
    href: ROUTES.riskAssessments
  },
  {
    label: "Rules & Policies",
    icon: "description",
    href: ROUTES.riskPolicies
  },
  {
    label: "Risk Analytics",
    icon: "bar_chart",
    href: "/risk/analytics"
  },
  {
    label: "Case Management",
    icon: "folder_managed",
    href: "/risk/cases"
  }
];

export default function RiskLayout({
  children
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="risk-area">
      <nav
        className="risk-top-nav"
        aria-label="Risk Management sections"
      >
        {sections.map(item => {
          const active =
            pathname === item.href ||
            (
              item.href !== ROUTES.risk &&
              pathname.startsWith(`${item.href}/`)
            );

          return (
            <Link
              key={item.label}
              href={item.href}
              className={active ? "risk-nav-active" : ""}
              aria-current={active ? "page" : undefined}
            >
              <span
                className="material-symbols-rounded"
                aria-hidden="true"
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="risk-area-content">
        {children}
      </div>
    </div>
  );
}