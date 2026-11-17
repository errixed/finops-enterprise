"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
    activateRiskPolicy,
    getRiskPolicy,
    getRiskPolicies,
    RiskPolicy
} from "@/services/risk-policies";

import { ROUTES } from "../../../../../config";

interface Props {
    params: Promise<{ id: string }>;
}

export default function RiskPolicyDetailsPage({
    params
}: Props) {
    const { id } = use(params);
    const router = useRouter();

    const [latestVersion, setLatestVersion] =
        useState<number | null>(null);

    const [policy, setPolicy] = useState<RiskPolicy | null>(null);
    const [loading, setLoading] = useState(true);
    const [activating, setActivating] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        async function load() {
            setLoading(true);
            setError("");
            setLatestVersion(null);

            try {
                const [currentPolicy, allPolicies] =
                    await Promise.all([
                        getRiskPolicy(id),
                        getRiskPolicies()
                    ]);

                if (!active) return;

                setPolicy(currentPolicy);

                const versions = allPolicies
                    .filter(item =>
                        item.policyId === currentPolicy.policyId &&
                        item.currency === currentPolicy.currency
                    )
                    .map(item => item.version);

                setLatestVersion(
                    versions.length
                        ? Math.max(...versions)
                        : null
                );
            } catch (err) {
                if (!active) return;

                setPolicy(null);
                setError(
                    err instanceof Error
                        ? err.message
                        : "Unable to load risk policy"
                );
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => {
            active = false;
        };
    }, [id]);

    const canActivate = Boolean(
        policy?.status === "Draft" &&
        latestVersion !== null &&
        policy.version === latestVersion &&
        !activating
    );

    async function activate() {
        if (!policy || !canActivate) return;

        if (
            !window.confirm(
                `Activate ${policy.policyId} version ${policy.version}? The current active version will become Superseded.`
            )
        ) {
            return;
        }

        setActivating(true);
        setError("");

        try {
            const updated = await activateRiskPolicy(
                policy._id
            );

            setPolicy(updated);
            router.refresh();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to activate policy"
            );
        } finally {
            setActivating(false);
        }
    }

    if (loading) {
        return <p>Loading risk policy...</p>;
    }

    if (!policy) {
        return (
            <section className="risk-policy-page">
                <p role="alert">{error || "Policy not found."}</p>
                <Link href={ROUTES.riskPolicies}>
                    Back to Policies
                </Link>
            </section>
        );
    }

    return (
        <section className="risk-policy-page">
            <Link href={ROUTES.riskPolicies}>
                Back to Policies
            </Link>

            <div className="risk-policy-header">
                <div>
                    <h1>{policy.policyId}</h1>
                    <p>
                        {policy.currency} · Version {policy.version}
                    </p>
                </div>

                <span
                    className={`risk-policy-status ${policy.status.toLowerCase()}`}
                >
                    {policy.status}
                </span>
            </div>

            {error && (
                <p className="risk-policy-error" role="alert">
                    {error}
                </p>
            )}

            {policy.status === "Draft" ? (
                <div className="risk-policy-actions">
                    <Link
                        href={ROUTES.riskPolicyEdit(policy._id)}
                        className="risk-policy-secondary-button"
                    >
                        Edit Draft
                    </Link>

                    <button
                        type="button"
                        className="risk-policy-primary-button"
                        onClick={activate}
                        disabled={!canActivate}
                    >
                        {activating
                            ? "Activating..."
                            : "Activate Policy"}
                    </button>

                    {latestVersion !== null &&
                        policy.version < latestVersion && (
                            <p className="risk-policy-readonly">
                                This Draft is not the latest version.
                                Only version {latestVersion} can be activated.
                            </p>
                        )}

                </div>
            ) : (
                <div className="risk-policy-readonly">
                    This {policy.status.toLowerCase()} policy
                    version is read-only. Create a new Draft
                    version to change its configuration.
                </div>
            )}

            <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <h2>Version Information</h2>
                </div>

                <dl className="risk-policy-metadata">
                    <div>
                        <dt>Policy ID</dt>
                        <dd>{policy.policyId}</dd>
                    </div>
                    <div>
                        <dt>Version</dt>
                        <dd>{policy.version}</dd>
                    </div>
                    <div>
                        <dt>Status</dt>
                        <dd>{policy.status}</dd>
                    </div>
                    <div>
                        <dt>Created By</dt>
                        <dd>{policy.createdBy}</dd>
                    </div>
                    <div>
                        <dt>Effective From</dt>
                        <dd>
                            {policy.effectiveFrom
                                ? new Date(
                                    policy.effectiveFrom
                                ).toLocaleString("en-CA")
                                : "Not activated"}
                        </dd>
                    </div>
                    <div>
                        <dt>Effective To</dt>
                        <dd>
                            {policy.effectiveTo
                                ? new Date(
                                    policy.effectiveTo
                                ).toLocaleString("en-CA")
                                : "—"}
                        </dd>
                    </div>
                </dl>
            </section>

            <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <h2>Rule Configuration</h2>
                </div>

                <div className="dashboard-table-wrap">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th>Rule</th>
                                <th>Points</th>
                                <th>Threshold</th>
                            </tr>
                        </thead>
                        <tbody>
                            {policy.rules.map(rule => (
                                <tr key={rule.ruleId}>
                                    <td>{rule.ruleId}</td>
                                    <td>{rule.points}</td>
                                    <td>
                                        {rule.threshold ?? "Not applicable"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                    <h2>Risk Thresholds</h2>
                </div>

                <div className="dashboard-table-wrap">
                    <table className="dashboard-table">
                        <thead>
                            <tr>
                                <th>Level</th>
                                <th>Minimum</th>
                                <th>Maximum</th>
                            </tr>
                        </thead>
                        <tbody>
                            {policy.thresholds.map(item => (
                                <tr key={item.level}>
                                    <td>{item.level}</td>
                                    <td>{item.min}</td>
                                    <td>{item.max}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </section>
    );
}