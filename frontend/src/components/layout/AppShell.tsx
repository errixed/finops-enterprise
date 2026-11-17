"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ROUTES } from "../../../config";

import {
  getRiskDashboard,
  type RiskDashboardData
} from "@/services/risk-dashboard";

import {
  getApprovalDashboard,
  type ApprovalDashboardData
} from "@/services/approval-dashboard";

import {
  buildOperationsAlerts,
  OperationsAlerts
} from "@/components/dashboard/OperationsAlerts";

interface AppShellProps {
  children: ReactNode;
}

const navItems = [
  {
    label: "Dashboard",
    href: ROUTES.dashboard,
    icon: "home"
  },
  {
    label: "Clients",
    href: ROUTES.clients,
    icon: "groups"
  },
  {
    label: "Accounts",
    href: ROUTES.accounts,
    icon: "database"
  },
  {
    label: "Transactions",
    href: ROUTES.transactions,
    icon: "swap_horiz"
  },
  {
    label: "Risk Management",
    href: ROUTES.risk,
    icon: "shield"
  },
  {
    label: "Approval Management",
    href: ROUTES.approvals,
    icon: "assignment_turned_in"
  }
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getPageTitle(pathname: string) {
  if (pathname === "/") return "Operations Dashboard";

  if (pathname === "/clients") return "Client Directory";
  if (pathname === "/clients/new") return "Create Client";
  if (pathname.startsWith("/clients/") && pathname.endsWith("/edit")) {
    return "Edit Client";
  }
  if (pathname.startsWith("/clients/")) return "Client Details";

  if (pathname === "/accounts") return "Account Directory";
  if (pathname === "/accounts/new") return "Register Account";
  if (pathname.startsWith("/accounts/")) return "Account Details";

  if (pathname === "/transactions") return "Transaction Management";
  if (pathname === "/transactions/new") return "Create Transaction";
  if (pathname.startsWith("/transactions/")) return "Transaction Details";

  if (pathname === ROUTES.risk) return "Risk Management";
  if (pathname === ROUTES.riskAssessments) return "Risk Assessments";
  if (pathname === ROUTES.riskPolicies) return "Risk Policies";
  if (pathname === ROUTES.riskPolicyNew) return "Create Risk Policy";

  if (
    pathname.startsWith("/risk/policies/") &&
    pathname.endsWith("/edit")
  ) {
    return "Edit Risk Policy";
  }

  if (pathname.startsWith("/risk/policies/")) {
    return "Risk Policy Details";
  }

  if (pathname.startsWith("/risk/assessments/")) {
    return "Risk Assessment Details";
  }

  if (pathname === ROUTES.approvals) {
    return "Approval Management";
  }

  if (pathname === ROUTES.approvalsQueue) {
    return "Approval Queue";
  }

  if (pathname.startsWith("/approvals/")) {
    return "Approval Workflow Details";
  }

  return "FinOps Enterprise";
}

function getPageIcon(pathname: string) {
  if (pathname === "/") return "dashboard";
  if (pathname.startsWith("/clients")) return "groups";
  if (pathname.startsWith("/accounts")) return "database";
  if (pathname.startsWith("/transactions")) return "swap_horiz";
  if (pathname.startsWith("/risk")) return "shield";
  if (pathname.startsWith("/approvals")) return "assignment_turned_in";

  return "dashboard";
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [riskData, setRiskData] = useState<RiskDashboardData | null>(null);
  const [approvalData, setApprovalData] =
    useState<ApprovalDashboardData | null>(null);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState(false);

  const alerts = buildOperationsAlerts(riskData, approvalData);

  const alertCategoryCount = alerts.filter(
    alert => alert.count !== null && alert.count > 0
  ).length;

  async function loadNotifications(signal?: AbortSignal) {
    setNotificationsLoading(true);
    setNotificationsError(false);

    try {
      const [risk, approvals] = await Promise.all([
        getRiskDashboard(signal),
        getApprovalDashboard(signal)
      ]);

      if (signal?.aborted) return;

      setRiskData(risk);
      setApprovalData(approvals);
    } catch {
      if (!signal?.aborted) {
        setNotificationsError(true);
      }
    } finally {
      if (!signal?.aborted) {
        setNotificationsLoading(false);
      }
    }
  }

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const controller = new AbortController();

    void loadNotifications(controller.signal);

    return () => controller.abort();
  }, []);

  useEffect(() => {
    setNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setNotificationsOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <div className="app-shell finops-shell">
      {menuOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        className={`sidebar finops-sidebar ${menuOpen ? "sidebar-open" : ""
          }`}
      >
        <div className="sidebar-brand finops-brand">
          <Link
            href={ROUTES.dashboard}
            className="finops-brand-link"
            aria-label="FinOps Enterprise Dashboard"
          >
            <Image
              src="/images/branding/logo.png"
              alt="FinOps Enterprise logo"
              width={62}
              height={62}
              priority
              className="finops-brand-logo"
            />

            <span className="finops-brand-copy">
              <strong>FinOps Enterprise</strong>
              <small>Financial Operations Platform</small>
            </span>
          </Link>

          <button
            type="button"
            className="sidebar-close"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          >
            <span className="material-symbols-rounded">
              close
            </span>
          </button>
        </div>

        <nav className="sidebar-nav finops-nav" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`sidebar-link finops-nav-link ${active ? "active" : ""
                  }`}
                onClick={() => setMenuOpen(false)}
              >
                <span
                  className="material-symbols-rounded finops-nav-icon"
                  aria-hidden="true"
                >
                  {item.icon}
                </span>

                <span className="finops-nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="app-main finops-main">
        <header className="topbar finops-topbar">
          <div className="topbar-heading finops-topbar-heading">
            <button
              type="button"
              className="mobile-menu-button finops-mobile-menu"
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <span className="material-symbols-rounded">
                menu
              </span>
            </button>

            <span
              className="material-symbols-rounded finops-page-icon"
              aria-hidden="true"
            >
              {getPageIcon(pathname)}
            </span>

            <h1>{getPageTitle(pathname)}</h1>
          </div>

          <div className="finops-topbar-actions">

            <div className="finops-notification-wrapper">
              <button
                type="button"
                className="finops-notification-button"
                aria-label={`Notifications: ${alertCategoryCount} active alert categories`}
                aria-expanded={notificationsOpen}
                aria-controls="finops-notifications-panel"
                onClick={() => {
                  const next = !notificationsOpen;
                  setNotificationsOpen(next);

                  if (next) {
                    void loadNotifications();
                  }
                }}
              >
                <span className="material-symbols-rounded">
                  notifications
                </span>

                {alertCategoryCount > 0 && (
                  <span className="finops-notification-badge">
                    {alertCategoryCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div
                  id="finops-notifications-panel"
                  className="finops-notification-dropdown"
                >
                  <div className="finops-notification-header">
                    <div>
                      <strong>Alerts & Actions</strong>
                      <small>Operations requiring attention</small>
                    </div>

                    <button
                      type="button"
                      aria-label="Close notifications"
                      onClick={() => setNotificationsOpen(false)}
                    >
                      <span className="material-symbols-rounded">
                        close
                      </span>
                    </button>
                  </div>

                  {notificationsLoading && (
                    <p className="finops-notification-status">
                      Updating alerts...
                    </p>
                  )}

                  {notificationsError && (
                    <p className="finops-notification-status">
                      Unable to refresh alerts.
                    </p>
                  )}

                  <OperationsAlerts
                    alerts={alerts}
                    onNavigate={() => setNotificationsOpen(false)}
                  />

                  <div className="finops-notification-footer">
                    <Link
                      href={ROUTES.dashboard}
                      onClick={() => setNotificationsOpen(false)}
                    >
                      View Operations Dashboard
                      <span className="material-symbols-rounded">
                        arrow_forward
                      </span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="finops-user">
              <span
                className="material-symbols-rounded finops-user-icon"
                aria-hidden="true"
              >
                account_circle
              </span>

              <span className="finops-user-name">Admin User</span>
            </div>
          </div>
        </header>

        <main className="app-content finops-content">
          {children}
        </main>
      </div>
    </div>
  );
}