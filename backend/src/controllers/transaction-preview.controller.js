import { findAccountById } from "../repositories/account.repository.js";
import { findActiveRiskPolicy } from "../repositories/risk-policy.repository.js";
import { buildRiskContext } from "../services/risk-context.service.js";
import { evaluateTransactionRisk } from "../services/risk-assessment.service.js";
import { resolveApprovalPolicy } from "../services/approval-policy.service.js";

export async function previewTransaction(req, res, next) {
    try {
        const {
            sourceAccountId,
            destinationAccountId,
            amountMinor,
            currency
        } = req.body ?? {};

        const validId = value =>
            typeof value === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

        if (
            !validId(sourceAccountId) ||
            !validId(destinationAccountId) ||
            sourceAccountId === destinationAccountId ||
            !Number.isSafeInteger(amountMinor) ||
            amountMinor <= 0 ||
            typeof currency !== "string"
        ) {
            return res.status(400).json({
                error: {
                    message: "Invalid transaction preview request"
                }
            });
        }

        const [source, destination] = await Promise.all([
            findAccountById(sourceAccountId),
            findAccountById(destinationAccountId)
        ]);

        if (!source || !destination) {
            return res.status(404).json({
                error: { message: "Account not found" }
            });
        }

        if (
            source.currency !== destination.currency ||
            source.currency !== currency
        ) {
            return res.status(400).json({
                error: {
                    message: "Account currencies must match"
                }
            });
        }

        if (source.status !== "Active" || destination.status !== "Active") {
            return res.status(400).json({
                error: { message: "Both accounts must be active" }
            });
        }

        if (amountMinor > source.balanceMinor) {
            return res.status(400).json({
                error: { message: "Insufficient source account balance" }
            });
        }

        const policy = await findActiveRiskPolicy(currency);

        if (!policy) {
            return res.status(503).json({
                error: { message: "No active risk policy" }
            });
        }

        const context = await buildRiskContext({
            sourceAccountId,
            destinationAccountId,
            amountMinor,
            currency,
            periodHours: 24,
            asOf: new Date()
        });

        const result = evaluateTransactionRisk(context, policy);
        const approval = await resolveApprovalPolicy(result.riskLevel);

        return res.json({
            riskScore: result.riskScore,
            riskLevel: result.riskLevel,
            triggeredRules: result.triggeredRules,
            approvalRequired: approval.approvalRequired,
            requiredRoles: approval.requiredRoles,
            provisional: true
        });
    } catch (error) {
        next(error);
    }
}