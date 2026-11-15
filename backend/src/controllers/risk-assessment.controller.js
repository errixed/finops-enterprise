import {
    listRiskAssessments,
    getRiskAssessment,
    getTransactionRiskAssessment
} from "../services/risk-assessment-query.service.js";

export async function getRiskAssessments(req, res, next) {
    try {
        const result = await listRiskAssessments(
            req.query
        );

        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

export async function getRiskAssessmentById(req, res, next) {
    try {
        const assessment = await getRiskAssessment(
            req.params.id
        );

        res.status(200).json(assessment);
    } catch (error) {
        next(error);
    }
}

export async function getRiskAssessmentByTransaction(
    req,
    res,
    next
) {
    try {
        const assessment =
            await getTransactionRiskAssessment(
                req.params.id
            );

        res.status(200).json(assessment);
    } catch (error) {
        next(error);
    }
}