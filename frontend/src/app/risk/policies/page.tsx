"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
    getRiskPolicies,
    RiskPolicy,
    PolicyStatus
} from "@/services/risk-policies";

import { ROUTES } from "../../../../config";

const STATUSES: Array<PolicyStatus | "All"> = [
    "All",
    "Draft",
    "Active",
    "Superseded"
];

export default function RiskPoliciesPage() {
    const [policies, setPolicies] = useState<RiskPolicy[]>([]);
    const [status, setStatus] = useState<PolicyStatus | "All">("All");
    const [currency, setCurrency] = useState("All");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let mounted = true;

        getRiskPolicies()
            .then(data => {
                if (mounted) setPolicies(data);
            })
            .catch(err => {
                if (mounted) setError(err.message);
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, []);

    const visible = policies.filter(policy =>
        (status === "All" || policy.status === status) &&
        (currency === "All" || policy.currency === currency)
    );

    return (
        <section className="transaction-directory">
            <div className="transaction-directory-header">
                <div>
                    <h1>Risk Policies</h1>
                    <p>Manage policy versions and risk scoring rules.</p>
                </div>

                <Link
                    href={ROUTES.riskPolicyNew}
                    className="transaction-directory-create"
                >
                    Create Draft Version
                </Link>
            </div>

            <div className="risk-policy-filters">
                <label>
                    Status
                    <select
                        value={status}
                        onChange={event =>
                            setStatus(
                                event.target.value as PolicyStatus | "All"
                            )
                        }
                    >
                        {STATUSES.map(value => (
                            <option key={value} value={value}>
                                {value}
                            </option>
                        ))}
                    </select>
                </label>

                <label>
                    Currency
                    <select
                        value={currency}
                        onChange={event =>
                            setCurrency(event.target.value)
                        }
                    >
                        <option value="All">All currencies</option>
                        <option value="CAD">CAD</option>
                        <option value="USD">USD</option>
                    </select>
                </label>
            </div>

            {error && <p role="alert">{error}</p>}

            <div className="transaction-directory-table-scroll">
                <table className="transaction-directory-table">
                    <thead>
                        <tr>
                            <th>Policy Family</th>
                            <th>Currency</th>
                            <th>Version</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6}>Loading policies...</td>
                            </tr>
                        ) : visible.length === 0 ? (
                            <tr>
                                <td colSpan={6}>No policies found.</td>
                            </tr>
                        ) : visible.map(policy => (
                            <tr key={policy._id}>
                                <td>{policy.policyId}</td>
                                <td>{policy.currency}</td>
                                <td>v{policy.version}</td>
                                <td>
                                    <span
                                        className={`risk-policy-status ${policy.status.toLowerCase()}`}
                                    >
                                        {policy.status}
                                    </span>
                                </td>
                                <td>
                                    {new Date(
                                        policy.createdAt
                                    ).toLocaleDateString("en-CA")}
                                </td>
                                <td>
                                    <div className="risk-policy-row-actions">
                                        <Link
                                            href={ROUTES.riskPolicyDetails(
                                                policy._id
                                            )}
                                        >
                                            View
                                        </Link>

                                        {policy.status === "Draft" && (
                                            <Link
                                                href={ROUTES.riskPolicyEdit(
                                                    policy._id
                                                )}
                                            >
                                                Edit
                                            </Link>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
