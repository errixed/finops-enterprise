
import { getDatabase } from "../config/mongodb.js";

const TIME_ZONE = "America/Toronto";
const DAY_MS = 86400000;
const HOUR_MS = 3600000;
const MINUTE_MS = 60000;

const BUILT_IN_RISKS = {
    "AWD-MEDIUM": "Medium",
    "AWD-HIGH": "High",
    "AWD-CRITICAL": "Critical"
};

const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
});

const offsetFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    timeZoneName: "shortOffset"
});

function localParts(date) {
    const values = {};

    for (const part of formatter.formatToParts(date)) {
        if (part.type !== "literal") {
            values[part.type] = Number(part.value);
        }
    }

    return values;
}

function offsetMinutes(date) {
    const value = offsetFormatter.formatToParts(date)
        .find(part => part.type === "timeZoneName")?.value ?? "GMT";

    const match = value.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);

    if (!match) {
        if (value === "GMT") return 0;
        throw new Error("Unable to resolve Toronto timezone offset");
    }

    const sign = match[1] === "+" ? 1 : -1;

    return sign * (
        Number(match[2]) * 60 +
        Number(match[3] ?? 0)
    );
}

function localToUtc(year, month, day, hour, minute) {
    const base = Date.UTC(year, month - 1, day, hour, minute);
    let result = base;

    for (let attempt = 0; attempt < 4; attempt++) {
        const next = base - offsetMinutes(new Date(result)) * MINUTE_MS;

        if (next === result) break;

        result = next;
    }

    return result;
}

function nextDate(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day) + DAY_MS);

    return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate()
    };
}

function intervalsForDate(parts, calendar) {
    const day = new Date(
        Date.UTC(parts.year, parts.month - 1, parts.day)
    ).getUTCDay();

    if (!calendar.weekdays.includes(day)) {
        return null;
    }

    const [startHour, startMinute] =
        calendar.start.split(":").map(Number);
    const [endHour, endMinute] =
        calendar.end.split(":").map(Number);

    return {
        start: localToUtc(
            parts.year,
            parts.month,
            parts.day,
            startHour,
            startMinute
        ),
        end: localToUtc(
            parts.year,
            parts.month,
            parts.day,
            endHour,
            endMinute
        )
    };
}

function calendarFor(definition) {
    const configured = definition.businessHours;

    if (
        configured?.timeZone === TIME_ZONE &&
        /^\d{2}:\d{2}$/.test(configured.start ?? "") &&
        /^\d{2}:\d{2}$/.test(configured.end ?? "") &&
        configured.start < configured.end &&
        Array.isArray(configured.weekdays) &&
        configured.weekdays.length > 0 &&
        configured.weekdays.every(day =>
            Number.isInteger(day) && day >= 0 && day <= 6
        )
    ) {
        return configured;
    }

    return {
        timeZone: TIME_ZONE,
        start: "09:00",
        end: "17:00",
        weekdays: [1, 2, 3, 4, 5]
    };
}

function businessDayMinutes(calendar) {
    const [sh, sm] = calendar.start.split(":").map(Number);
    const [eh, em] = calendar.end.split(":").map(Number);

    return (eh * 60 + em) - (sh * 60 + sm);
}

function addBusinessMinutes(startDate, minutes, calendar) {
    let current = startDate.getTime();
    let remaining = minutes * MINUTE_MS;

    for (let dayIndex = 0; dayIndex < 365; dayIndex++) {
        const parts = localParts(new Date(current));
        const interval = intervalsForDate(parts, calendar);

        if (interval) {
            const from = Math.max(current, interval.start);

            if (from < interval.end) {
                const available = interval.end - from;

                if (remaining <= available) {
                    return new Date(from + remaining);
                }

                remaining -= available;
            }
        }

        const next = nextDate(parts.year, parts.month, parts.day);

        current = localToUtc(
            next.year,
            next.month,
            next.day,
            0,
            0
        );
    }

    throw new Error("Unable to calculate business-hours SLA deadline");
}

function businessMinutesBetween(start, end, calendar) {
    if (end <= start) return 0;

    let current = start;
    let total = 0;

    for (let dayIndex = 0; dayIndex < 365 && current < end; dayIndex++) {
        const parts = localParts(new Date(current));
        const interval = intervalsForDate(parts, calendar);

        if (interval) {
            total += Math.max(
                0,
                Math.min(end, interval.end) -
                Math.max(current, interval.start)
            );
        }

        const next = nextDate(parts.year, parts.month, parts.day);

        current = localToUtc(
            next.year,
            next.month,
            next.day,
            0,
            0
        );
    }

    return total / MINUTE_MS;
}

function validDate(value) {
    if (!value) return null;

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}

function rolesMatch(workflow, definition) {
    const actual = workflow.requiredStages?.map(stage =>
        stage.requiredRole
    );

    return Array.isArray(actual) &&
        JSON.stringify(actual) ===
        JSON.stringify(definition.stages);
}

function stageBusinessDays(definition, index) {
    const explicit = definition.stageDefinitions?.[index];

    if (
        Number.isInteger(explicit?.slaBusinessDays) &&
        explicit.slaBusinessDays > 0
    ) {
        return explicit.slaBusinessDays;
    }

    const stageCount = definition.stages?.length ?? 0;

    if (!stageCount || !Number.isFinite(definition.slaHours)) {
        return null;
    }

    return Math.max(
        1,
        Math.ceil(definition.slaHours / stageCount / 24)
    );
}

async function getTransactions(database, ids) {
    const result = new Map();

    for (let index = 0; index < ids.length; index += 500) {
        const rows = await database.collection("transactions")
            .find({
                transactionId: { $in: ids.slice(index, index + 500) }
            })
            .project({
                _id: 0,
                transactionId: 1,
                riskLevel: 1
            })
            .toArray();

        for (const row of rows) {
            result.set(row.transactionId, row);
        }
    }

    return result;
}

async function getDecisions(database, ids) {
    const result = new Map();

    for (let index = 0; index < ids.length; index += 500) {
        const rows = await database.collection("approval_decisions")
            .find({
                workflowId: { $in: ids.slice(index, index + 500) },
                decision: { $in: ["Approved", "Rejected"] }
            })
            .project({
                _id: 0,
                workflowId: 1,
                stageNumber: 1,
                decision: 1,
                decidedAt: 1
            })
            .sort({ decidedAt: 1 })
            .toArray();

        for (const row of rows) {
            const key = `${row.workflowId}:${row.stageNumber}`;

            if (!result.has(key)) {
                result.set(key, row);
            }
        }
    }

    return result;
}

function percentage(count, total) {
    return Math.round(count / total * 1000) / 10;
}

export async function calculateWorkflowSlaMetrics(definition) {
    const riskLevel = BUILT_IN_RISKS[definition.definitionId];

    if (
        !riskLevel ||
        definition.protected !== true ||
        definition.origin !== "Assignment3"
    ) {
        return {
            onTime: null,
            atRisk: null,
            breached: null,
            sampleSize: 0,
            measurementAvailable: false,
            reason: "Approval instances are not linked to this custom definition"
        };
    }

    const database = getDatabase();
    const now = new Date();
    const windowStart = new Date(now.getTime() - 30 * DAY_MS);
    const calendar = calendarFor(definition);
    const minutesPerDay = businessDayMinutes(calendar);

    const workflows = await database.collection("approval_workflows")
        .find({
            createdAt: { $gte: windowStart, $lte: now }
        })
        .project({
            _id: 0,
            workflowId: 1,
            transactionId: 1,
            requiredStages: 1,
            createdAt: 1
        })
        .toArray();

    const compatible = workflows.filter(workflow =>
        rolesMatch(workflow, definition)
    );

    const transactions = await getTransactions(
        database,
        [...new Set(compatible.map(item => item.transactionId))]
    );

    const selected = compatible.filter(workflow =>
        transactions.get(workflow.transactionId)?.riskLevel === riskLevel
    );

    const decisions = await getDecisions(
        database,
        selected.map(item => item.workflowId)
    );

    const counts = {
        onTime: 0,
        atRisk: 0,
        breached: 0
    };

    let excludedStages = 0;

    for (const workflow of selected) {
        let stageStart = validDate(workflow.createdAt);

        if (!stageStart) continue;

        for (let index = 0; index < workflow.requiredStages.length; index++) {
            const stage = workflow.requiredStages[index];

            if (stage.status === "Waiting" ||
                stage.status === "Cancelled") {
                break;
            }

            const days = stageBusinessDays(definition, index);

            if (days === null) {
                excludedStages++;
                break;
            }

            const decision = decisions.get(
                `${workflow.workflowId}:${stage.stageNumber}`
            );

            const decidedAt = validDate(decision?.decidedAt);

            if (
                decision &&
                (!decidedAt || decidedAt < stageStart || decidedAt > now)
            ) {
                excludedStages++;
                break;
            }

            if (!decision && stage.status !== "Pending") {
                excludedStages++;
                break;
            }

            const budget = days * minutesPerDay;
            const deadline = addBusinessMinutes(
                stageStart,
                budget,
                calendar
            );

            if (decision) {
                if (decidedAt <= deadline) {
                    counts.onTime++;
                } else {
                    counts.breached++;
                }

                if (decision.decision !== "Approved") break;

                stageStart = decidedAt;
            } else {
                if (now > deadline) {
                    counts.breached++;
                } else {
                    const elapsed = businessMinutesBetween(
                        stageStart.getTime(),
                        now.getTime(),
                        calendar
                    );

                    if (elapsed >= budget * 0.75) {
                        counts.atRisk++;
                    } else {
                        counts.onTime++;
                    }
                }

                break;
            }
        }
    }

    const sampleSize =
        counts.onTime + counts.atRisk + counts.breached;

    if (sampleSize === 0) {
        return {
            onTime: null,
            atRisk: null,
            breached: null,
            sampleSize: 0,
            measurementAvailable: false,
            excludedStages,
            reason: "No eligible approval stages were found in the last 30 days"
        };
    }

    return {
        onTime: percentage(counts.onTime, sampleSize),
        atRisk: percentage(counts.atRisk, sampleSize),
        breached: percentage(counts.breached, sampleSize),
        sampleSize,
        measurementAvailable: true,
        excludedStages,
        counts,
        periodStart: windowStart.toISOString(),
        periodEnd: now.toISOString(),
        timeZone: TIME_ZONE,
        atRiskThreshold: 0.75
    };
}
