import {
    getDashboardSummary,
    getOperationsTrend
} from "../services/dashboard.service.js";

export async function getSummary(req, res, next) {
    try {
        const summary = await getDashboardSummary();
        res.status(200).json(summary);
    } catch (error) {
        next(error);
    }
}

export async function getTrend(req, res, next) {
    try {
        const days = Number(req.query.days ?? 30);

        if (![7, 30, 90].includes(days)) {
            return res.status(400).json({
                error: {
                    message: "Days must be 7, 30, or 90"
                }
            });
        }

        const trend = await getOperationsTrend(days);
        res.status(200).json(trend);
    } catch (error) {
        next(error);
    }
}