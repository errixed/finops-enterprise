"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import RiskPolicyEditor from "@/components/risk/RiskPolicyEditor";

import {
    createRiskPolicy,
    getRiskPolicies,
    RiskPolicy,
    PolicyConfiguration
} from "@/services/risk-policies";

import { ROUTES } from "../../../../../config";

export default function NewRiskPolicyPage() {
    const router = useRouter();

    const [policies, setPolicies] = useState<RiskPolicy[]>([]);
    const [selectedId, setSelectedId] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        getRiskPolicies()
            .then(data => {
                setPolicies(data);
                const latest = data.find(
                    policy => policy.currency === "CAD"
                ) ?? data[0];

                if (latest) setSelectedId(latest.policyId);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const families = Array.from(
        new Set(policies.map(policy => policy.policyId))
    );

    const base = policies
        .filter(policy => policy.policyId === selectedId)
        .sort((a, b) => b.version - a.version)[0];

    async function submit(configuration: PolicyConfiguration) {
        if (!base) return;

        setSaving(true);
        setError("");

        try {
            const created = await createRiskPolicy(
                base.policyId,
                base.currency,
                configuration
            );

            router.push(
                ROUTES.riskPolicyDetails(created._id)
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to create policy"
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="risk-policy-page">
            <Link href={ROUTES.riskPolicies}>
                Back to Risk Policies
            </Link>

            <h1>Create Draft Risk Policy</h1>
            <p>
                Create a new version of an existing policy family.
                The new version will remain Draft until activated.
            </p>

            {error && <p role="alert" className="risk-policy-error">{error}</p>}

            {loading ? (
                <p>Loading policy families...</p>
            ) : (
                <>
                    <div className="dashboard-panel">
                        <label className="risk-policy-family-select">
                            Policy Family
                            <select
                                value={selectedId}
                                onChange={event =>
                                    setSelectedId(event.target.value)
                                }
                            >
                                {families.map(id => (
                                    <option key={id} value={id}>
                                        {id}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {base && (
                            <p>
                                Currency: {base.currency} ·
                                New version: v{base.version + 1}
                            </p>
                        )}
                    </div>

                    {base && (
                        <RiskPolicyEditor
                            key={`${base.policyId}-${base.version}`}
                            initial={{
                                rules: base.rules,
                                thresholds: base.thresholds
                            }}
                            submitLabel="Create Draft Version"
                            submitting={saving}
                            error={error}
                            onSubmit={submit}
                        />
                    )}
                </>
            )}
        </section>
    );
}