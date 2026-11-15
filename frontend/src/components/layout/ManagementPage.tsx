import Link from "next/link";
import { ReactNode } from "react";

interface ManagementPageProps {
    title: string;
    description: string;
    children: ReactNode;
    backHref?: string;
    backLabel?: string;
}

export default function ManagementPage({
    title,
    description,
    children,
    backHref,
    backLabel = "Back"
}: ManagementPageProps) {
    return (
        <section className="finops-dashboard">
            {backHref && (
                <div style={{ marginBottom: 16 }}>
                    <Link
                        href={backHref}
                        className="finops-view-all"
                    >
                        {backLabel}
                    </Link>
                </div>
            )}

            <div style={{ marginBottom: 20 }}>
                <h1
                    style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: "#102344",
                        marginBottom: 8
                    }}
                >
                    {title}
                </h1>

                <p style={{ color: "#64748b", fontSize: 14 }}>
                    {description}
                </p>
            </div>

            <div className="finops-panel">
                {children}
            </div>
        </section>
    );
}