"use client";

import { useId } from "react";
import type { AccountBalancePoint } from "@/services/accounts";
import "./AccountBalanceTrend.css";

interface Props {
  points: AccountBalancePoint[];
  currency: string;
}

function formatAxis(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toLocaleString("en-CA", {
    maximumFractionDigits: 2
  });
}

export default function AccountBalanceTrend({
  points,
  currency
}: Props) {
  const gradientId = useId().replace(/:/g, "");

  const data = points.map(point => ({
    ...point,
    balance: point.balanceMinor === null
      ? null
      : Number(point.balanceMinor) / 100
  }));

  const available = data
    .map(point => point.balance)
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (!available.length) {
    return (
      <div className="abt-empty">
        No recorded balance history yet.
      </div>
    );
  }

  const width = 640;
  const height = 250;
  const left = 76;
  const right = 16;
  const top = 18;
  const bottom = 45;

  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const minObserved = Math.min(...available);
  const maxObserved = Math.max(...available);

  const range = Math.max(1, maxObserved - minObserved);
  const padding = Math.max(range * 0.3, Math.abs(maxObserved) * 0.04, 1);

  const minY = Math.max(0, minObserved - padding);
  const maxY = maxObserved + padding;
  const scale = maxY - minY || 1;

  const x = (index: number) =>
    left + plotWidth * (
      data.length <= 1 ? 0.5 : index / (data.length - 1)
    );

  const y = (value: number) =>
    top + plotHeight * (1 - (value - minY) / scale);

  const segments: { line: string; area: string; indices: number[] }[] = [];

  let segment: number[] = [];

  function flushSegment() {
    if (!segment.length) return;

    const line = segment.map((index, position) =>
      `${position === 0 ? "M" : "L"} ${x(index)} ${y(data[index].balance!)}`
    ).join(" ");

    const first = segment[0];
    const last = segment[segment.length - 1];

    const area = [
      line,
      `L ${x(last)} ${top + plotHeight}`,
      `L ${x(first)} ${top + plotHeight}`,
      "Z"
    ].join(" ");

    segments.push({ line, area, indices: [...segment] });
    segment = [];
  }

  data.forEach((point, index) => {
    if (point.balance === null) {
      flushSegment();
    } else {
      segment.push(index);
    }
  });

  flushSegment();

  return (
    <div className="abt-container">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Observed account balance trend in ${currency}`}
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#2588fb" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#2588fb" stopOpacity="0.025" />
          </linearGradient>
        </defs>

        {Array.from({ length: 5 }, (_, index) => {
          const value = maxY - (maxY - minY) * index / 4;
          const tickY = top + plotHeight * index / 4;

          return (
            <g key={index}>
              <line
                x1={left}
                x2={width - right}
                y1={tickY}
                y2={tickY}
                stroke="#d8e6f6"
                strokeWidth="1"
              />
              <text
                x={left - 10}
                y={tickY + 4}
                textAnchor="end"
                className="abt-axis-text"
              >
                {formatAxis(value)}
              </text>
            </g>
          );
        })}

        <line
          x1={left}
          y1={top}
          x2={left}
          y2={top + plotHeight}
          stroke="#8da6c7"
          strokeWidth="1"
        />

        <line
          x1={left}
          y1={top + plotHeight}
          x2={width - right}
          y2={top + plotHeight}
          stroke="#8da6c7"
          strokeWidth="1"
        />

        {segments.map((item, index) => (
          <g key={index}>
            <path
              d={item.area}
              fill={`url(#${gradientId})`}
            />
            <path
              d={item.line}
              fill="none"
              stroke="#0663ed"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        ))}

        {data.map((point, index) => {
          const date = new Date(`${point.month}-01T00:00:00.000Z`);

          const label = Number.isNaN(date.getTime())
            ? point.month
            : date.toLocaleDateString("en-CA", {
              month: "short",
              timeZone: "UTC"
            });

          return (
            <g key={point.month}>
              <text
                x={x(index)}
                y={height - 13}
                textAnchor="middle"
                className="abt-month-text"
              >
                {label}
              </text>

              {point.balance !== null && (
                <circle
                  cx={x(index)}
                  cy={y(point.balance)}
                  r="5"
                  fill="#0663ed"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                >
                  <title>
                    {`${label}: ${point.balance.toLocaleString("en-CA", {
                      style: "currency",
                      currency
                    })}`}
                  </title>
                </circle>
              )}
            </g>
          );
        })}
      </svg>
      <p className="abt-caption">
        {available.length === 1
          ? `Balance history started in ${new Date(`${data.find(point => point.balance !== null)?.month}-01T00:00:00Z`)
            .toLocaleDateString("en-CA", {
              month: "long",
              year: "numeric",
              timeZone: "UTC"
            })
          }. Earlier balances are unavailable.`
          : `Recorded monthly balances · ${currency}`}
      </p>
    </div>
  );
}
