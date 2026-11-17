import {
    listRiskPolicies,
    getRiskPolicy,
    createRiskPolicy,
    modifyDraftRiskPolicy,
    activateRiskPolicy,
} from "../services/risk-policy.service.js";

export async function getRiskPolicies(req, res, next) {
    try {
        const policies = await listRiskPolicies(req.query);
        res.status(200).json(policies);
    } catch (error) {
        next(error);
    }
}

export async function getRiskPolicyById(req, res, next) {
    try {
        const policy = await getRiskPolicy(req.params.id);
        res.status(200).json(policy);
    } catch (error) {
        next(error);
    }
}

export async function createPolicy(req, res, next) {
    try {
        const policy = await createRiskPolicy(
            req.body,
            req.get("X-Actor-Id")
        );

        res.status(201).json(policy);
    } catch (error) {
        next(error);
    }
}

export async function updatePolicy(req, res, next) {
    try {
        const policy = await modifyDraftRiskPolicy(
            req.params.id,
            req.body,
            req.get("X-Actor-Id")
        );

        res.status(200).json(policy);
    } catch (error) {
        next(error);
    }
}

export async function activatePolicy(req, res, next) {
    try {
        const policy = await activateRiskPolicy(
            req.params.id,
            req.get("X-Actor-Id")
        );

        res.status(200).json(policy);
    } catch (error) {
        next(error);
    }
}