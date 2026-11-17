"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "../../../config";
import "./approval-ui.css";

const tabs = [
  {
    title: "Overview",
    icon: "home",
    href: ROUTES.approvals
  },
  {
    title: "Approval Queue",
    icon: "gavel",
    href: ROUTES.approvalsQueue
  },
  {
    title: "Approval Workflows",
    icon: "account_tree",
    href: "/approvals/workflows"
  },
  {
    title: "Approval Policies",
    icon: "description",
    href: "/approvals/policies"
  },
  {
    title: "Decision History",
    icon: "verified_user",
    href: "/approvals/decisions"
  },
  {
    title: "Audit Trail",
    icon: "folder_open",
    href: "/approvals/audit"
  }
];

export default function ApprovalsLayout({
  children
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <section className="am-area">
      <nav className="am-navigation" aria-label="Approval Management">
        {tabs.map(tab => {
          const active = tab.href !== null &&
            (
              pathname === tab.href ||
              (
                tab.href !== ROUTES.approvals &&
                pathname.startsWith(`${tab.href}/`)
              )
            );

          if (!tab.href) {
            return (
              <span
                key={tab.title}
                className="am-nav-disabled"
                aria-disabled="true"
                title={`${tab.title} page coming in a later milestone`}
              >
                <span className="material-symbols-rounded">
                  {tab.icon}
                </span>
                {tab.title}
              </span>
            );
          }

          return (
            <Link
              key={tab.title}
              href={tab.href}
              className={active ? "active" : ""}
              aria-current={active ? "page" : undefined}
            >
              <span className="material-symbols-rounded">
                {tab.icon}
              </span>
              {tab.title}
            </Link>
          );
        })}
      </nav>

      <div className="am-area-content">
        {children}
      </div>
    </section>
  );
}