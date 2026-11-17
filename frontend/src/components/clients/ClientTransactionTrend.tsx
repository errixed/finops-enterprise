"use client";

import { useId, useMemo } from "react";
import type { ClientOperationalReport } from "@/services/clients";
import "./ClientTransactionTrend.css";

type Props = {
  report: ClientOperationalReport | null;
  currency?: "CAD" | "USD";
};

type ChartPoint = {
  month: string;
  label: string;
  volume: number;
  count: number;
};

function niceMaximum(value: number) {
  if (value <= 0) return 1;

  const rough = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));

  const normalized = rough / magnitude;

  const step =
    normalized <= 1 ? 1 :
    normalized <= 2 ? 2 :
    normalized <= 2.5 ? 2.5 :
    normalized <= 5 ? 5 : 10;

  return step * magnitude * 4;
}

function formatVolume(value: number) {
  if (value === 0) return "0.0";
  if (value < 0.1) return value.toFixed(2);
  if (value < 10) return value.toFixed(1);
  return value.toLocaleString("en-CA", {
    maximumFractionDigits: 1
  });
}

export default function ClientTransactionTrend({
  report,
  currency = "CAD"
}: Props) {
  const gradientId = useId().replace(/:/g, "");

  const points = useMemo<ChartPoint[]>(() => {
    if (!report) return [];

    return report.transactionTrend.map(item => {
      const rawMinor = item.volumeByCurrency?.[currency] ?? "0";

      const minorAmount = Number(rawMinor);

      const volume = Number.isFinite(minorAmount)
        ? minorAmount / 100 / 1_000_000
        : 0;

      const [year, month] = item.month.split("-").map(Number);

      const label = new Date(
        Date.UTC(year, month - 1, 1)
      ).toLocaleDateString("en-CA", {
        month: "short",
        timeZone: "UTC"
      });

      return {
        month: item.month,
        label,
        volume,
        count: item.count
      };
    });
  }, [report, currency]);

  if (!report) {
    return (
      <div className="ctt-empty">
        Transaction trend unavailable.
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="ctt-empty">
        No transaction trend data available.
      </div>
    );
  }

  const width = 680;
  const height = 270;

  const left = 67;
  const right = 54;
  const top = 17;
  const bottom = 43;

  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const maxVolume = niceMaximum(
    Math.max(0, ...points.map(point => point.volume))
  );

  const maxCount = niceMaximum(
    Math.max(0, ...points.map(point => point.count))
  );

  const stepWidth = plotWidth / points.length;
  const barWidth = Math.min(66, stepWidth * 0.68);

  const x = (index: number) =>
    left + stepWidth * (index + 0.5);

  const volumeY = (volume: number) =>
    top + plotHeight * (1 - volume / maxVolume);

  const countY = (count: number) =>
    top + plotHeight * (1 - count / maxCount);

  const linePath = points.map((point, index) =>
    `${index === 0 ? "M" : "L"} ${x(index)} ${countY(point.count)}`
  ).join(" ");

  const volumeValues = Array.from(
    { length: 5 },
    (_, index) => maxVolume * (4 - index) / 4
  );

  const countValues = Array.from(
    { length: 5 },
    (_, index) => maxCount * (4 - index) / 4
  );

  const countTick = (value: number) =>
    Number.isInteger(value)
      ? value.toLocaleString("en-CA")
      : value.toFixed(1);

  return (
    <div className="ctt-container">
      <div className="ctt-chart">
        <svg
          className="ctt-svg"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Six-month transaction volume in millions of ${currency} and transaction count`}
        >
          <defs>
            <linearGradient
              id={gradientId}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#2494f5" />
              <stop offset="100%" stopColor="#68bdf5" />
            </linearGradient>
          </defs>

          {volumeValues.map((value, index) => {
            const y = top + index * plotHeight / 4;

            return (
              <g key={index}>
                <line
                  x1={left}
                  y1={y}
                  x2={width - right}
                  y2={y}
                  stroke="#d8e5f4"
                  strokeWidth="1"
                />

                <text
                  x={left - 13}
                  y={y + 5}
                  textAnchor="end"
                  className="ctt-axis-text"
                >
                  {formatVolume(value)}
                </text>

                <text
                  x={width - right + 12}
                  y={y + 5}
                  textAnchor="start"
                  className="ctt-axis-text"
                >
                  {countTick(countValues[index])}
                </text>
              </g>
            );
          })}

          <line
            x1={left}
            y1={top}
            x2={left}
            y2={top + plotHeight}
            stroke="#72849c"
            strokeWidth="1.4"
          />

          <line
            x1={width - right}
            y1={top}
            x2={width - right}
            y2={top + plotHeight}
            stroke="#72849c"
            strokeWidth="1.4"
          />

          <line
            x1={left}
            y1={top + plotHeight}
            x2={width - right}
            y2={top + plotHeight}
            stroke="#72849c"
            strokeWidth="1.4"
          />

          <text
            transform={`translate(17 ${top + plotHeight / 2}) rotate(-90)`}
            textAnchor="middle"
            className="ctt-axis-title"
          >
            Volume (M {currency})
          </text>

          <text
            transform={`translate(${width - 9} ${top + plotHeight / 2}) rotate(90)`}
            textAnchor="middle"
            className="ctt-axis-title"
          >
            Count
          </text>

          {points.map((point, index) => {
            const center = x(index);
            const barTop = volumeY(point.volume);

            return (
              <g key={point.month}>
                {point.volume > 0 && (
                  <rect
                    x={center - barWidth / 2}
                    y={barTop}
                    width={barWidth}
                    height={top + plotHeight - barTop}
                    rx="3"
                    fill={`url(#${gradientId})`}
                    stroke="#1587e9"
                    strokeWidth="1.4"
                  >
                    <title>
                      {`${point.label}: ${point.volume.toFixed(3)} million ${currency}`}
                    </title>
                  </rect>
                )}

                <text
                  x={center}
                  y={top + plotHeight + 24}
                  textAnchor="middle"
                  className="ctt-month-text"
                >
                  {point.label}
                </text>
              </g>
            );
          })}

          {points.length > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke="#ff7900"
              strokeWidth="3.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {points.map((point, index) => (
            <circle
              key={`point-${point.month}`}
              cx={x(index)}
              cy={countY(point.count)}
              r="6"
              fill="#fff"
              stroke="#ff7900"
              strokeWidth="3"
            >
              <title>
                {`${point.label}: ${point.count} transactions`}
              </title>
            </circle>
          ))}
        </svg>
      </div>

      <div className="ctt-legend">
        <div className="ctt-legend-item">
          <span className="ctt-legend-bar" />
          <span>
            Transaction
            <br />
            Volume (M {currency})
          </span>
        </div>

        <div className="ctt-legend-item">
          <span className="ctt-legend-line">
            <span />
          </span>
          <span>
            Transaction
            <br />
            Count
          </span>
        </div>
      </div>
    </div>
  );
}