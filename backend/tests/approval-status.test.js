import test from "node:test";
import assert from "node:assert/strict";

import {
    APPROVAL_STATUS,
    APPROVAL_STATES,
    isValidApprovalStatus,
    isTerminalApprovalStatus
} from "../src/constants/approval-status.js";

test("6.3: supports all seven approval states", () => {
    assert.deepEqual(APPROVAL_STATES, [
        "NotRequired",
        "Pending",
        "InReview",
        "Approved",
        "Rejected",
        "Escalated",
        "Cancelled"
    ]);
});

test("6.3: rejects unsupported approval states", () => {
    assert.equal(
        isValidApprovalStatus("AwaitingApproval"),
        false
    );

    assert.equal(
        isValidApprovalStatus("Processing"),
        false
    );
});

test("6.3: recognizes valid approval states", () => {
    for (const status of APPROVAL_STATES) {
        assert.equal(isValidApprovalStatus(status), true);
    }
});

test("6.3: identifies terminal approval states", () => {
    assert.equal(
        isTerminalApprovalStatus(APPROVAL_STATUS.APPROVED),
        true
    );

    assert.equal(
        isTerminalApprovalStatus(APPROVAL_STATUS.REJECTED),
        true
    );

    assert.equal(
        isTerminalApprovalStatus(APPROVAL_STATUS.CANCELLED),
        true
    );

    assert.equal(
        isTerminalApprovalStatus(APPROVAL_STATUS.PENDING),
        false
    );

    assert.equal(
        isTerminalApprovalStatus(APPROVAL_STATUS.ESCALATED),
        false
    );
});

test("6.3: financial and approval statuses are independent", () => {
    const transaction = {
        status: "Pending",
        approvalStatus: APPROVAL_STATUS.IN_REVIEW
    };

    assert.equal(transaction.status, "Pending");
    assert.equal(transaction.approvalStatus, "InReview");
});