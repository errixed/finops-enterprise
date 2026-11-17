"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import RiskPolicyEditor from "@/components/risk/RiskPolicyEditor";

import {
    getRiskPolicy,
    updateRiskPolicy,
    RiskPolicy,
    PolicyConfiguration
} from "@/services/risk-policies";

import { ROUTES } from "../../../../../../config";

interface Props {
    params: Promise<{ id: string }>;
}

export default function EditRiskPolicyPage({
    params
}: Props) {
    const { id } = use(params);
    const router = useRouter();

    const [policy, setPolicy] = useState<RiskPolicy | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        getRiskPolicy(id)
            .then(result => {
                if (active) setPolicy(result);
            })
            .catch(err => {
                if (active) setError(err.message);
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [id]);

    async function save(configuration: PolicyConfiguration) {
        if (!policy || policy.status !== "Draft") {
            setError("Only Draft policies may be edited.");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const updated = await updateRiskPolicy(
                policy._id,
                configuration
            );

            router.push(
                ROUTES.riskPolicyDetails(updated._id)
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to save draft"
            );
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <p>Loading Draft policy...</p>;

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

    if (policy.status !== "Draft") {
        return (
            <section className="risk-policy-page">
                <h1>Policy Is Read-Only</h1>
                <p>
                    Version {policy.version} is {policy.status}.
                    Only Draft versions can be edited.
                </p>
                <Link
                    href={ROUTES.riskPolicyDetails(policy._id)}
                >
                    View Policy Details
                </Link>
            </section>
        );
    }

    return (
        <section className="risk-policy-page">
            <Link
                href={ROUTES.riskPolicyDetails(policy._id)}
            >
                Back to Policy Details
            </Link>

            <h1>Edit Draft Risk Policy</h1>
            <p>
                {policy.policyId} · {policy.currency} ·
                Version {policy.version}
            </p>

            <RiskPolicyEditor
                key={`${policy._id}-${policy.updatedAt}`}
                initial={{
                    rules: policy.rules,
                    thresholds: policy.thresholds
                }}
                submitLabel="Save Draft"
                submitting={saving}
                error={error}
                onSubmit={save}
            />
        </section>
    );
}