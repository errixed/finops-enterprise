interface TransactionStatusChartProps {
    statuses: {
        Pending: number;
        Completed: number;
        Rejected: number;
    };
}

export default function TransactionStatusChart({
    statuses
}: TransactionStatusChartProps) {
    const total =
        statuses.Pending +
        statuses.Completed +
        statuses.Rejected;

    const items = [
        {
            label: "Completed",
            value: statuses.Completed,
            className: "chart-completed"
        },
        {
            label: "Pending",
            value: statuses.Pending,
            className: "chart-pending"
        },
        {
            label: "Rejected",
            value: statuses.Rejected,
            className: "chart-rejected"
        }
    ];

    return (
        <div className="dashboard-panel">
            <h2>Transaction Status Distribution</h2>

            <div className="status-chart">
                {items.map(item => {
                    const percentage = total > 0
                        ? (item.value / total) * 100
                        : 0;

                    return (
                        <div className="chart-item" key={item.label}>
                            <div className="chart-item-heading">
                                <span>{item.label}</span>
                                <span>
                                    {item.value} ({percentage.toFixed(1)}%)
                                </span>
                            </div>

                            <div
                                className="chart-track"
                                role="progressbar"
                                aria-label={`${item.label} transactions`}
                                aria-valuenow={item.value}
                                aria-valuemin={0}
                                aria-valuemax={total}
                            >
                                <div
                                    className={`chart-fill ${item.className}`}
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {total === 0 && (
                <p>No transaction data available.</p>
            )}
        </div>
    );
}