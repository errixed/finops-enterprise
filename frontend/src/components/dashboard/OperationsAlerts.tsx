"use client";

import Link from "next/link";
import { ROUTES } from "../../../config";
import type { RiskDashboardData } from "@/services/risk-dashboard";
import type { ApprovalDashboardData } from "@/services/approval-dashboard";
import { Icon } from "@/components/ui";

export type OperationsAlert = {
  id: string;
  label: string;
  count: number | null;
  icon: string;
  tone: "danger" | "warning" | "info" | "policy";
  href: string;
};

export function buildOperationsAlerts(
  risk: RiskDashboardData | null,
  approvals: ApprovalDashboardData | null
): OperationsAlert[] {
  return [
    {
      id: "high-risk",
      label: "High-Risk Assessments",
      count: risk
        ? risk.riskLevels.High + risk.riskLevels.Critical
        : null,
      icon: "warning",
      tone: "danger",
      href: ROUTES.riskAssessments
    },
    {
      id: "pending-approvals",
      label: "Transactions Pending Approval",
      count: approvals?.awaitingReview ?? null,
      icon: "hourglass_top",
      tone: "warning",
      href: ROUTES.approvalsQueue
    },
    {
      id: "escalations",
      label: "Escalations Require Attention",
      count: approvals?.escalatedWorkflows ?? null,
      icon: "info",
      tone: "info",
      href: ROUTES.approvals
    },
    {
      id: "policy-reviews",
      label: "Policy Reviews Due",
      count: null,
      icon: "calendar_month",
      tone: "policy",
      href: ROUTES.riskPolicies
    }
  ];
}

export function OperationsAlerts({
  alerts,
  onNavigate
}: {
  alerts: OperationsAlert[];
  onNavigate?: () => void;
}) {
  return (
    <div className="ops-alert-list">
      {alerts.map(alert => (
        <Link
          key={alert.id}
          href={alert.href}
          className={`ops-alert ops-alert-${alert.tone}`}
          onClick={onNavigate}
        >
          <Icon name={alert.icon} size={25} />

          <span className="ops-alert-label">
            {alert.count === null
              ? alert.label
              : `${alert.count.toLocaleString("en-CA")} ${alert.label}`}
          </span>

          <Icon name="chevron_right" size={23} />
        </Link>
      ))}
    </div>
  );
}