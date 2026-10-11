import { getDashboardSummary } from "../services/dashboard.service.js";

export async function getSummary(req, res, next) {
    try {
        const summary = await getDashboardSummary();
        res.status(200).json(summary);
    } catch (error) {
        next(error);
    }
}