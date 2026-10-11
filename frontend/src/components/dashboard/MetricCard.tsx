interface MetricCardProps {
    title: string;
    value: number;
}

export default function MetricCard({
    title,
    value
}: MetricCardProps) {
    return (
        <div className="metric-card">
            <p className="metric-label">{title}</p>
            <h2 className="metric-value">
                {value.toLocaleString("en-CA")}
            </h2>
        </div>
    );
}