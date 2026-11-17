import { createHash, randomUUID } from "node:crypto";
import { Long, GridFSBucket } from "mongodb";
import {
  connectMongoDB,
  closeMongoDB,
  getDatabase
} from "../src/config/mongodb.js";
import {
  DEFAULT_RISK_RULES,
  DEFAULT_RISK_THRESHOLDS
} from "../src/services/risk-assessment.service.js";

if (
  process.env.NODE_ENV !== "development" ||
  process.env.ALLOW_ALL_DEMO_SEEDS !== "1"
) {
  console.error(
    "Development seeding is disabled. Set NODE_ENV=development and ALLOW_ALL_DEMO_SEEDS=1."
  );
  process.exit(1);
}

async function seedCore() {
const PREFIX = "DEMO-SCENARIO-2026";

const id = (kind, n) => {
  const hex = createHash("sha256")
    .update(`${PREFIX}:${kind}:${n}`)
    .digest("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const date = (daysAgo, hour = 12) =>
  new Date(
    Date.now() -
    daysAgo * 86400000 +
    (hour - 12) * 3600000
  );

const long = n => Long.fromBigInt(BigInt(n));

const clientsN = 36;

const industries = [
  "Manufacturing",
  "Construction",
  "Transportation",
  "Technology",
  "Financial Services",
  "Retail",
  "Wholesale Distribution",
  "Healthcare",
  "Energy"
];

const companyRoots = [
  "Northstar",
  "Maple",
  "Cedar",
  "Harbor",
  "Aurora",
  "Pine",
  "Bluewater",
  "Summit",
  "Silverline",
  "Granite",
  "Evergreen",
  "Riverbend"
];

const suffixes = [
  "Systems",
  "Logistics",
  "Holdings",
  "Solutions",
  "Trading",
  "Operations"
];

const managers = [
  "Morgan Lee",
  "Olivia Chen",
  "Daniel Brooks",
  "Priya Shah"
];

const actors = [
  {
    actorId: "ACTOR-POLICY-001",
    name: "Morgan Lee",
    role: "PolicyAdministrator",
    active: true
  },
  {
    actorId: "ACTOR-OPERATIONS-001",
    name: "Olivia Chen",
    role: "OperationsReviewer",
    active: true
  },
  {
    actorId: "ACTOR-SENIOR-001",
    name: "Daniel Brooks",
    role: "SeniorReviewer",
    active: true
  },
  {
    actorId: "ACTOR-COMPLIANCE-001",
    name: "Priya Shah",
    role: "ComplianceReviewer",
    active: true
  }
];

const roleActor = Object.fromEntries(
  actors.map(a => [a.role, a])
);

const riskRules = {
  Low: [],
  Medium: ["RISK-001", "RISK-004"],
  High: ["RISK-002", "RISK-007"],
  Critical: ["RISK-003", "RISK-007", "RISK-008"]
};

const roles = {
  Low: [],
  Medium: ["OperationsReviewer"],
  High: ["OperationsReviewer", "SeniorReviewer"],
  Critical: ["SeniorReviewer", "ComplianceReviewer"]
};

const riskSequence = [
  "Low",
  "Medium",
  "High",
  "Critical"
];

const workflowSequence = [
  "Pending",
  "InReview",
  "Approved",
  "Rejected",
  "Escalated",
  "Cancelled"
];

async function upsert(collection, key, doc) {
  await collection.updateOne(
    key,
    { $setOnInsert: doc },
    { upsert: true }
  );
}

async function main() {
  await connectMongoDB();

  const db = getDatabase();
  const c = name => db.collection(name);
  const summary = {};

  try {
    const collections = [
      "clients",
      "accounts",
      "transactions",
      "risk_assessments",
      "approval_workflows",
      "approval_decisions",
      "risk_policies",
      "approval_policies",
      "workflow_actors"
    ];

    for (const name of collections) {
      const existing = await db
        .listCollections({ name }, { nameOnly: true })
        .toArray();

      if (!existing.length) {
        await db.createCollection(name);
      }
    }

    for (const actor of actors) {
      await upsert(
        c("workflow_actors"),
        { actorId: actor.actorId },
        actor
      );
    }

    for (const currency of ["CAD", "USD"]) {
      const existing = await c("risk_policies").findOne({
        status: "Active",
        currency
      });

      if (!existing) {
        const p = {
          policyId: `RISK-POLICY-${currency}`,
          version: 1,
          currency,
          isDefault: true,
          status: "Active",
          rules: structuredClone(DEFAULT_RISK_RULES),
          thresholds: structuredClone(DEFAULT_RISK_THRESHOLDS),
          effectiveFrom: date(90),
          effectiveTo: null,
          createdBy: "SYSTEM",
          createdAt: date(90),
          updatedAt: date(90)
        };

        await upsert(
          c("risk_policies"),
          { policyId: p.policyId, version: 1 },
          p
        );
      }
    }

    for (const level of riskSequence) {
      const policyId =
        `APPROVAL-POLICY-${level.toUpperCase()}`;

      const p = {
        policyId,
        version: 1,
        status: "Active",
        riskLevel: level,
        requiredRoles: roles[level],
        createdAt: date(90)
      };

      await upsert(
        c("approval_policies"),
        { policyId, version: 1 },
        p
      );
    }

    for (let i = 0; i < clientsN; i++) {
      const createdAt = date(
        i < 12 ? i + 1 : 45 + i * 4
      );

      const clientType =
        i % 5 === 0 ? "Individual" : "Corporate";

      const companyName = clientType === "Individual"
        ? `${
            [
              "Alex",
              "Jordan",
              "Taylor",
              "Casey",
              "Avery",
              "Sam",
              "Riley",
              "Morgan"
            ][i % 8]
          } ${
            [
              "Parker",
              "Turner",
              "Carter",
              "Morgan",
              "Shaw"
            ][i % 5]
          }`
        : `${
            companyRoots[i % companyRoots.length]
          } ${
            suffixes[
              Math.floor(i / companyRoots.length) %
              suffixes.length
            ]
          } Demo ${i + 1}`;

      const client = {
        clientId: id("client", i),
        companyName,
        registrationNumber:
          `DEMO26${String(i + 1).padStart(6, "0")}`,
        registrationNumberNormalized:
          `DEMO26${String(i + 1).padStart(6, "0")}`,
        clientType,
        relationshipManager:
          managers[i % managers.length],
        nextReviewAt:
          i % 4 === 0
            ? date(i + 1)
            : date(-30 - i),
        industry: industries[i % industries.length],
        country:
          i % 4 === 0
            ? "United States"
            : "Canada",
        contactEmail: `client${i + 1}@example.test`,
        contactPhone:
          `+1-416-555-${String(1000 + i).padStart(4, "0")}`,
        status: [
          "Active",
          "Active",
          "Active",
          "Inactive",
          "Suspended"
        ][i % 5],
        createdAt,
        updatedAt: createdAt
      };

      await upsert(
        c("clients"),
        { clientId: client.clientId },
        client
      );
    }

    summary.clients = clientsN;

    const accountIds = [];

    for (let i = 0; i < clientsN; i++) {
      accountIds[i] = [];

      for (let j = 0; j < 3; j++) {
        const currency = j === 2 ? "USD" : "CAD";

        const account = {
          accountId: id("account", i * 3 + j),
          clientId: id("client", i),
          accountNumber:
            `DEMO${String(80000000 + i * 3 + j)}`,
          accountType: [
            "Operating",
            "Savings",
            "Investment"
          ][j],
          currency,
          balanceMinor: long(
            (i + 1) * 1000000 +
            (j + 1) * 250000
          ),
          status: [
            "Active",
            "Active",
            "Frozen",
            "Closed"
          ][(i + j) % 4],
          createdAt: date(35 + i * 3)
        };

        accountIds[i].push(account.accountId);

        await upsert(
          c("accounts"),
          { accountId: account.accountId },
          account
        );
      }
    }

    summary.accounts = clientsN * 3;

    let transactionCount = 0;
    let assessmentCount = 0;
    let workflowCount = 0;
    let decisionCount = 0;

    for (let i = 0; i < 240; i++) {
      const fromIndex = i % clientsN;
      const toIndex =
        (fromIndex + 1 + (i % 7)) % clientsN;

      const currency =
        i % 5 === 0 ? "USD" : "CAD";

      const sourceAccountId =
        accountIds[fromIndex][currency === "USD" ? 2 : 0];

      const destinationAccountId =
        accountIds[toIndex][currency === "USD" ? 2 : 0];

      const riskLevel = riskSequence[i % 4];

      const workflowStatus =
        riskLevel === "Low"
          ? "NotRequired"
          : workflowSequence[
              Math.floor(i / 4) %
              workflowSequence.length
            ];

      const status =
        workflowStatus === "NotRequired" ||
        workflowStatus === "Approved"
          ? "Completed"
          : workflowStatus === "Rejected" ||
            workflowStatus === "Cancelled"
            ? "Rejected"
            : i % 2
              ? "Pending"
              : "Processing";

      const createdAt = date(i % 110, i % 24);
      const txId = id("transaction", i);

      const amountMinor = [
        12000,
        1150000,
        6800000,
        18500000,
        250000,
        42000000
      ][i % 6];

      const rejectionCode =
        status === "Rejected"
          ? "BUSINESS_RULE_VIOLATION"
          : null;

      const tx = {
        transactionId: txId,
        referenceNumber:
          `DEMO-TX-${String(i + 1).padStart(5, "0")}`,
        sourceAccountId,
        destinationAccountId,
        amountMinor: long(amountMinor),
        currency,
        transactionType: "Transfer",
        status,
        description:
          `${PREFIX}: ${riskLevel} / ${workflowStatus} fixture`,
        isLegacy: true,
        rejectionCode,
        rejectionReason: rejectionCode
          ? "Demo scenario: approval rejected"
          : null,
        createdAt,
        updatedAt: createdAt,
        processedAt:
          status === "Completed"
            ? createdAt
            : null
      };

      await upsert(
        c("transactions"),
        { transactionId: txId },
        tx
      );

      transactionCount++;

      const triggeredRules = riskRules[riskLevel].map(
        ruleId => {
          const rule = DEFAULT_RISK_RULES.find(
            x => x.ruleId === ruleId
          );

          return {
            ruleId,
            points: rule.points,
            reason:
              `${PREFIX}: synthetic ${ruleId} scenario`,
            evaluatedInput: {
              demo: true,
              amountMinor
            }
          };
        }
      );

      const riskScore = Math.min(
        100,
        triggeredRules.reduce(
          (sum, rule) => sum + rule.points,
          0
        )
      );

      const assessmentId = id("assessment", i);

      const assessment = {
        assessmentId,
        transactionId: txId,
        policyId: `RISK-POLICY-${currency}`,
        policyVersion: 1,
        riskScore,
        riskLevel,
        approvalRequired: riskLevel !== "Low",
        triggeredRules,
        assessedAt: createdAt
      };

      await upsert(
        c("risk_assessments"),
        { assessmentId },
        assessment
      );

      assessmentCount++;

      if (riskLevel !== "Low") {
        const requiredRoles = roles[riskLevel];

        const decisionIDs = [];

        const stages = requiredRoles.map(
          (requiredRole, j) => ({
            stageNumber: j + 1,
            requiredRole,
            status: j === 0 ? "Pending" : "Waiting"
          })
        );

        let currentStage = 1;

        if (
          ["InReview", "Approved"].includes(workflowStatus) &&
          stages.length > 1
        ) {
          stages[0].status = "Approved";

          stages[1].status =
            workflowStatus === "Approved"
              ? "Approved"
              : "Pending";

          currentStage =
            workflowStatus === "Approved"
              ? null
              : 2;

          decisionIDs.push({
            stage: 1,
            decision: "Approved"
          });
        } else if (workflowStatus === "Approved") {
          stages[0].status = "Approved";
          currentStage = null;

          decisionIDs.push({
            stage: 1,
            decision: "Approved"
          });
        } else if (workflowStatus === "Rejected") {
          stages[0].status = "Rejected";

          for (const s of stages.slice(1)) {
            s.status = "Cancelled";
          }

          currentStage = null;

          decisionIDs.push({
            stage: 1,
            decision: "Rejected"
          });
        } else if (workflowStatus === "Cancelled") {
          stages[0].status = "Cancelled";

          for (const s of stages.slice(1)) {
            s.status = "Cancelled";
          }

          currentStage = null;
        }

        const workflowId = id("workflow", i);

        const workflow = {
          workflowId,
          transactionId: txId,
          assessmentId,
          approvalPolicyId:
            `APPROVAL-POLICY-${riskLevel.toUpperCase()}`,
          approvalPolicyVersion: 1,
          status: workflowStatus,
          currentStage,
          requiredStages: stages,
          createdAt,
          updatedAt: createdAt
        };

        await upsert(
          c("approval_workflows"),
          { workflowId },
          workflow
        );

        workflowCount++;

        for (const d of decisionIDs) {
          const actor =
            roleActor[requiredRoles[d.stage - 1]];

          if (!actor) continue;

          const decision = {
            decisionId: id(
              "decision",
              `${i}-${d.stage}`
            ),
            workflowId,
            transactionId: txId,
            stageNumber: d.stage,
            actorId: actor.actorId,
            actorRole: actor.role,
            decision: d.decision,
            comments:
              `${PREFIX}: seeded ${d.decision.toLowerCase()} decision`,
            idempotencyKey:
              `demo-decision-${i}-${d.stage}`,
            decidedAt: createdAt
          };

          await upsert(
            c("approval_decisions"),
            { decisionId: decision.decisionId },
            decision
          );

          decisionCount++;
        }
      }
    }

    Object.assign(summary, {
      transactions: transactionCount,
      riskAssessments: assessmentCount,
      approvalWorkflows: workflowCount,
      approvalDecisions: decisionCount
    });

    console.log(
      `\n${PREFIX}: seed applied (insert-if-missing; existing records unchanged).`
    );

    console.table(summary);

    console.log(
      "Includes: active/inactive/suspended clients; " +
      "corporate/individual; managers; due/upcoming reviews; " +
      "CAD/USD; operating/savings/investment; " +
      "active/frozen/closed; varied account balances; " +
      "recent/older transactions; four risk levels; " +
      "no/one/two-stage approvals; pending, in-review, " +
      "approved, rejected, escalated, cancelled; approval decisions."
    );
  } finally {
    await closeMongoDB();
  }
}
await main();
}

async function seedCases() {
const investigators = [
    "Morgan Lee",
    "Olivia Chen",
    "Daniel Brooks",
    "Priya Shah",
    "Alex Morgan",
    "Samantha Wilson"
];

const subjects = [
    "Unusual High-Value Transfer",
    "Repeated Outgoing Transactions",
    "Potential Account Compromise",
    "Unusual Client Transaction Pattern",
    "Large Transfer Requires Investigation",
    "Client Status Compliance Review",
    "Suspicious Transfer Frequency",
    "Account Balance Utilization Alert",
    "Potential Fraud Investigation",
    "Cross-Border Transfer Review",
    "Transaction Monitoring Exception",
    "Unusual Payment Activity",
    "Large Outbound Transfer",
    "Account Activity Investigation",
    "Risk Policy Exception",
    "Possible Duplicate Transaction",
    "Unexpected Transfer Volume",
    "Customer Due Diligence Review",
    "Low-Risk Verification",
    "Transaction Documentation Review"
];

const summaries = [
    "Transaction activity requires further review to confirm its business purpose and legitimacy.",
    "Several outgoing transactions were identified during the monitoring period.",
    "The transaction triggered monitoring controls and requires investigation.",
    "The transaction amount is unusual compared with the client's recorded account activity.",
    "The investigation will verify authorization and supporting documentation.",
    "The client's account and transaction activity require a compliance review.",
    "The review focuses on transaction frequency, amount and associated risk indicators.",
    "Additional supporting information may be required before the investigation can conclude."
];

const actions = [
    "Review transaction details and related risk assessment.",
    "Contact the assigned relationship manager.",
    "Verify supporting transaction documentation.",
    "Review recent account activity.",
    "Confirm transaction authorization.",
    "Complete compliance review and record findings."
];

const resolutions = [
    "Transaction activity was reviewed and determined to be consistent with the client's expected business operations.",
    "Supporting documentation was reviewed and the investigation was closed with no additional action required.",
    "The flagged transaction was investigated and the findings were documented.",
    "The review found no additional risk indicators requiring continued investigation.",
    "The investigation was completed and the findings were referred to the appropriate internal team.",
    "The client activity was verified against available records and the case was closed."
];

const noteTexts = [
    "Initial case review completed. Transaction details and available risk indicators were examined.",
    "Investigating the account activity and comparing transactions with the recorded client profile.",
    "Relevant documentation was reviewed and the investigation findings were recorded.",
    "Follow-up review completed. The case remains under monitoring pending a final determination.",
    "Additional information was requested from the responsible relationship manager.",
    "Risk indicators were assessed against the applicable policy and transaction history."
];

const riskLevels = [
    "High",
    "Critical",
    "Medium",
    "Low",
    "High",
    "Medium",
    "Critical",
    "High",
    "Low",
    "Medium",
    "High",
    "Critical"
];

const statuses = [
    "Open",
    "In Investigation",
    "Resolved"
];

const day = 86400000;
const now = Date.now();

function makeDate(daysAgo) {
    return new Date(now - daysAgo * day);
}

function caseAge(index) {
    if (index < 10) {
        return (index % 6) + 1;
    }

    if (index < 24) {
        return 8 + (index - 10) * 2;
    }

    if (index < 38) {
        return 33 + (index - 24) * 4;
    }

    return 101 + (index - 38) * 8;
}

function caseIdentifier(index) {
    return `CASE-DEMO-${String(index + 1).padStart(4, "0")}`;
}

async function insertEvent(db, entry) {
    await db.collection("risk_case_events").updateOne(
        { eventId: entry.eventId },
        { $setOnInsert: entry },
        { upsert: true }
    );
}

async function seedDocument(bucket, files, item, index) {
    const existing = await files.findOne({
        "metadata.caseId": item.caseId,
        "metadata.demoSeed": true
    });

    if (existing) return false;

    const filename = `case-review-${String(index + 1).padStart(3, "0")}.txt`;

    const content = [
        "FINOPS ENTERPRISE - DEMONSTRATION CASE DOCUMENT",
        "",
        `Case ID: ${item.caseId}`,
        `Subject: ${item.subject}`,
        `Risk Level: ${item.riskLevel}`,
        `Status: ${item.status}`,
        `Transaction ID: ${item.transactionId ?? "Not linked"}`,
        "",
        "This document contains synthetic demonstration content.",
        "It must not be used as evidence of a real investigation.",
        "",
        "Sample review checklist:",
        "- Review transaction information",
        "- Verify applicable risk indicators",
        "- Record investigation findings",
        "- Determine the next action"
    ].join("\n");

    await new Promise((resolve, reject) => {
        const stream = bucket.openUploadStream(filename, {
            contentType: "text/plain",
            metadata: {
                caseId: item.caseId,
                contentType: "text/plain",
                uploadedBy: "DEMO-SEED",
                demoSeed: true
            }
        });

        stream.on("finish", resolve);
        stream.on("error", reject);
        stream.end(Buffer.from(content, "utf8"));
    });

    return true;
}

async function main() {
    await connectMongoDB();

    try {
        const db = getDatabase();

        if (/prod(uction)?/i.test(db.databaseName)) {
            throw new Error(
                "Refusing to seed a database whose name indicates production."
            );
        }

        const casesCollection = db.collection("risk_cases");
        const filesCollection = db.collection("risk_case_attachments.files");
        const bucket = new GridFSBucket(db, {
            bucketName: "risk_case_attachments"
        });

        const [assessments, transactions, accounts, clients] =
            await Promise.all([
                db.collection("risk_assessments")
                    .find({})
                    .sort({ assessedAt: -1 })
                    .toArray(),
                db.collection("transactions")
                    .find({})
                    .toArray(),
                db.collection("accounts")
                    .find({})
                    .toArray(),
                db.collection("clients")
                    .find({})
                    .toArray()
            ]);

        const transactionMap = new Map(
            transactions.map(item => [item.transactionId, item])
        );

        const accountMap = new Map(
            accounts.map(item => [item.accountId, item])
        );

        const clientMap = new Map(
            clients.map(item => [item.clientId, item])
        );

        const assessmentOptions = assessments.filter(item =>
            transactionMap.has(item.transactionId)
        );

        console.log("Seeding demonstration Risk Management cases...");
        console.log(`Existing clients: ${clients.length}`);
        console.log(`Existing transactions: ${transactions.length}`);
        console.log(`Linked assessments available: ${assessmentOptions.length}`);

        let inserted = 0;
        let existing = 0;
        let documentsAdded = 0;

        for (let index = 0; index < 48; index++) {
            const id = caseIdentifier(index);

            const age = caseAge(index);
            const createdAt = makeDate(age);

            const status = statuses[index % statuses.length];

            const assessment = assessmentOptions.length
                ? assessmentOptions[index % assessmentOptions.length]
                : null;

            const transaction = assessment
                ? transactionMap.get(assessment.transactionId)
                : transactions.length
                    ? transactions[index % transactions.length]
                    : null;

            const account = transaction
                ? accountMap.get(transaction.sourceAccountId)
                : null;

            const client = account
                ? clientMap.get(account.clientId)
                : clients.length
                    ? clients[index % clients.length]
                    : null;

            const riskLevel = assessment?.riskLevel &&
                ["Low", "Medium", "High", "Critical"]
                    .includes(assessment.riskLevel)
                ? assessment.riskLevel
                : riskLevels[index % riskLevels.length];

            const assignedTo = index % 7 === 0
                ? null
                : investigators[index % investigators.length];

            const resolvedAt = status === "Resolved"
                ? makeDate(age - Math.min(2, age / 2))
                : null;

            const lastActivity = resolvedAt ??
                (status === "In Investigation"
                    ? makeDate(Math.max(0.25, age - 0.5))
                    : createdAt);

            const item = {
                caseId: id,
                subject: subjects[index % subjects.length],
                summary: summaries[index % summaries.length],
                nextAction: status === "Resolved"
                    ? "No further investigation required."
                    : actions[index % actions.length],
                clientId: client?.clientId ?? null,
                clientName: client?.companyName ??
                    "Unassigned client",
                transactionId: transaction?.transactionId ?? null,
                riskLevel,
                status,
                assignedTo,
                resolution: status === "Resolved"
                    ? resolutions[index % resolutions.length]
                    : null,
                createdAt,
                updatedAt: lastActivity,
                resolvedAt,
                createdBy: "DEMO-SEED",
                demoSeed: true
            };

            const result = await casesCollection.updateOne(
                { caseId: id },
                { $setOnInsert: item },
                { upsert: true }
            );

            if (result.upsertedCount) {
                inserted++;
            } else {
                existing++;
            }

            const stored = await casesCollection.findOne({
                caseId: id
            });

            if (!stored?.demoSeed) {
                console.log(
                    `Skipping activities for non-demo record ${id}`
                );
                continue;
            }

            await insertEvent(db, {
                eventId: `${id}-CREATED`,
                caseId: id,
                action: "Case Created",
                details: "Demonstration investigation case opened.",
                actorId: "DEMO-SEED",
                createdAt
            });

            if (assignedTo) {
                await insertEvent(db, {
                    eventId: `${id}-ASSIGNED`,
                    caseId: id,
                    action: "Case Assigned",
                    details: `Assigned to ${assignedTo}`,
                    actorId: "DEMO-SEED",
                    createdAt: new Date(
                        createdAt.getTime() + 30 * 60000
                    )
                });
            }

            if (status !== "Open") {
                await insertEvent(db, {
                    eventId: `${id}-INVESTIGATION`,
                    caseId: id,
                    action: "Investigation Started",
                    details: "Case moved into active investigation.",
                    actorId: assignedTo ?? "DEMO-SEED",
                    createdAt: new Date(
                        createdAt.getTime() + 60 * 60000
                    )
                });
            }

            const notesCount = status === "Open"
                ? index % 2
                : 2 + index % 3;

            for (let n = 0; n < notesCount; n++) {
                const noteDate = new Date(
                    createdAt.getTime() +
                    (n + 1) * 2 * 3600000
                );

                await insertEvent(db, {
                    eventId: `${id}-NOTE-${n + 1}`,
                    caseId: id,
                    action: "Note Added",
                    details: noteTexts[
                        (index + n) % noteTexts.length
                    ],
                    actorId: assignedTo ?? "DEMO-SEED",
                    createdAt: noteDate
                });
            }

            if (status === "Resolved") {
                await insertEvent(db, {
                    eventId: `${id}-RESOLVED`,
                    caseId: id,
                    action: "Case Resolved",
                    details: item.resolution,
                    actorId: assignedTo ?? "DEMO-SEED",
                    createdAt: resolvedAt
                });
            }

            if (index % 4 === 0 || index % 4 === 1) {
                const added = await seedDocument(
                    bucket,
                    filesCollection,
                    stored,
                    index
                );

                if (added) documentsAdded++;
            }
        }

        await casesCollection.createIndex(
            { caseId: 1 },
            { unique: true }
        );

        await casesCollection.createIndex({
            createdAt: -1,
            status: 1
        });

        await db.collection("risk_case_events").createIndex({
            caseId: 1,
            createdAt: 1
        });

        const demoCases = await casesCollection.find({
            demoSeed: true
        }).toArray();

        const count = status =>
            demoCases.filter(item => item.status === status).length;

        console.log("");
        console.log("Case seed completed successfully.");
        console.log(`New cases: ${inserted}`);
        console.log(`Already existing: ${existing}`);
        console.log(`Total demo cases: ${demoCases.length}`);
        console.log(`Open: ${count("Open")}`);
        console.log(`In Investigation: ${count("In Investigation")}`);
        console.log(`Resolved: ${count("Resolved")}`);
        console.log(`New documents: ${documentsAdded}`);
        console.log("");
        console.log("Existing manually created cases were preserved.");
    } finally {
        await closeMongoDB();
    }
}
await main();
}

async function seedCredit() {
await connectMongoDB();

try {
    const accounts = getDatabase().collection("accounts");

    const cursor = accounts.find({
        creditLimitMinor: { $exists: false },
        outstandingCreditMinor: { $exists: false }
    });

    let updated = 0;

    for await (const account of cursor) {
        const hash = [...account.accountId]
            .reduce((sum, char) => sum + char.charCodeAt(0), 0);

        const creditLimitMinor =
            (100000 + (hash % 50) * 10000) * 100;

        const utilization = 20 + (hash % 7) * 10;

        const outstandingCreditMinor = Math.round(
            creditLimitMinor * utilization / 100
        );

        const result = await accounts.updateOne(
            {
                _id: account._id,
                creditLimitMinor: { $exists: false },
                outstandingCreditMinor: { $exists: false }
            },
            {
                $set: {
                    creditLimitMinor,
                    outstandingCreditMinor,
                    creditDataSynthetic: true
                }
            }
        );

        updated += result.modifiedCount;
    }

    console.log(`Credit facilities seeded for ${updated} accounts.`);
} finally {
    await closeMongoDB();
}
}

async function seedBalances() {
const SEED_NAME = "development-account-balance-history-v1";
const MONTHS = 6;

function asBigInt(value) {
    if (Long.isLong(value)) {
        return value.toBigInt();
    }

    if (typeof value === "bigint") {
        return value;
    }

    if (Number.isSafeInteger(value)) {
        return BigInt(value);
    }

    throw new Error("Invalid account balance");
}

function monthKey(date) {
    return date.toISOString().slice(0, 7);
}

function getMonthStart(year, month) {
    return new Date(Date.UTC(year, month, 1));
}

function getMonthEnd(year, month) {
    return new Date(
        Date.UTC(year, month + 1, 0, 23, 59, 59, 999)
    );
}

function getMonthLabel(date) {
    return date.toLocaleDateString("en-CA", {
        month: "short",
        year: "numeric",
        timeZone: "UTC"
    });
}

function variationFor(accountId, month, index) {
    const hash = createHash("sha256")
        .update(`${accountId}:${month}:${SEED_NAME}`)
        .digest();

    const random = hash.readUInt32BE(0) / 4294967295;

    const trend = (index - (MONTHS - 1)) * 0.012;
    const variation = (random - 0.5) * 0.22;

    return Math.round(
        (1 + trend + variation) * 10000
    );
}

function syntheticBalance(currentBalance, factor) {
    const result =
        currentBalance * BigInt(factor) / BigInt(10000);

    return result < BigInt(0)
        ? BigInt(0)
        : result;
}

async function seedAccount(account, history, now) {
    const accountId = account.accountId;

    if (!accountId || !account.currency) {
        return { status: "skipped", reason: "invalid account" };
    }

    const currentBalance = asBigInt(account.balanceMinor);

    if (currentBalance < BigInt(0)) {
        return { status: "skipped", reason: "negative balance" };
    }

    const existing = await history
        .find({ accountId })
        .sort({ occurredAt: 1, _id: 1 })
        .toArray();

    const unrecognized = existing.filter(snapshot =>
        snapshot.seedName !== SEED_NAME &&
        snapshot.eventType !== "BASELINE"
    );

    if (unrecognized.length > 0) {
        return {
            status: "skipped",
            reason: "real balance activity already exists"
        };
    }

    const baselines = existing.filter(snapshot =>
        snapshot.eventType === "BASELINE" &&
        snapshot.seedName !== SEED_NAME
    );

    if (baselines.length > 1) {
        return {
            status: "skipped",
            reason: "multiple existing baselines"
        };
    }

    const currentMonth = monthKey(now);

    if (baselines.length === 1) {
        const baseline = baselines[0];

        if (
            monthKey(new Date(baseline.occurredAt)) !== currentMonth ||
            asBigInt(baseline.balanceMinor) !== currentBalance
        ) {
            return {
                status: "skipped",
                reason: "existing baseline does not match current balance"
            };
        }
    }

    const previousSeedBaseline = existing.find(snapshot =>
        snapshot.seedName === SEED_NAME &&
        snapshot.eventType === "BASELINE"
    );

    if (previousSeedBaseline && (
        monthKey(new Date(previousSeedBaseline.occurredAt)) !== currentMonth ||
        asBigInt(previousSeedBaseline.balanceMinor) !== currentBalance
    )) {
        return {
            status: "skipped",
            reason: "previous seed baseline is outdated"
        };
    }

    let created = 0;
    let updated = 0;

    for (let index = 0; index < MONTHS - 1; index++) {
        const offset = MONTHS - 1 - index;

        const year = now.getUTCFullYear();
        const month = now.getUTCMonth() - offset;

        const monthStart = getMonthStart(year, month);
        const monthEnd = getMonthEnd(year, month);

        const key = monthKey(monthStart);

        const factor = variationFor(
            accountId,
            key,
            index
        );

        const balance = syntheticBalance(
            currentBalance,
            factor
        );

        const result = await history.updateOne(
            {
                accountId,
                seedName: SEED_NAME,
                seedMonth: key
            },
            {
                $set: {
                    balanceMinor: Long.fromBigInt(balance),
                    currency: account.currency,
                    occurredAt: monthEnd,
                    eventType: "SYNTHETIC_MONTHLY_BALANCE",
                    synthetic: true
                },
                $setOnInsert: {
                    snapshotId: randomUUID(),
                    accountId,
                    seedName: SEED_NAME,
                    seedMonth: key,
                    createdAt: new Date()
                }
            },
            { upsert: true }
        );

        if (result.upsertedCount) {
            created++;
        } else {
            updated++;
        }

        console.log(
            `  ${getMonthLabel(monthStart)}: ${(
                Number(balance) / 100
            ).toLocaleString("en-CA", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })} ${account.currency} [SYNTHETIC]`
        );
    }

    if (!baselines.length) {
        const result = await history.updateOne(
            {
                accountId,
                seedName: SEED_NAME,
                seedMonth: currentMonth
            },
            {
                $setOnInsert: {
                    snapshotId: randomUUID(),
                    accountId,
                    balanceMinor: Long.fromBigInt(currentBalance),
                    currency: account.currency,
                    occurredAt: now,
                    createdAt: now,
                    eventType: "BASELINE",
                    synthetic: false,
                    seedName: SEED_NAME,
                    seedMonth: currentMonth
                }
            },
            { upsert: true }
        );

        if (result.upsertedCount) {
            created++;
        }
    }

    return {
        status: "seeded",
        created,
        updated
    };
}

await connectMongoDB();

try {
    const db = getDatabase();

    const accounts = db.collection("accounts");
    const history = db.collection("account_balance_history");

    const now = new Date();

    await history.createIndex(
        {
            accountId: 1,
            seedName: 1,
            seedMonth: 1
        },
        {
            unique: true,
            partialFilterExpression: {
                seedName: SEED_NAME
            }
        }
    );

    const accountDocuments = await accounts
        .find(
            {},
            {
                projection: {
                    accountId: 1,
                    accountNumber: 1,
                    currency: 1,
                    balanceMinor: 1,
                    createdAt: 1
                }
            }
        )
        .toArray();

    console.log(
        `Found ${accountDocuments.length} accounts.`
    );

    let seeded = 0;
    let skipped = 0;
    let created = 0;
    let updated = 0;

    for (const account of accountDocuments) {
        console.log(
            `\nAccount: ${account.accountNumber ?? account.accountId}`
        );

        try {
            const result = await seedAccount(
                account,
                history,
                now
            );

            if (result.status === "skipped") {
                skipped++;
                console.log(`  Skipped: ${result.reason}`);
                continue;
            }

            seeded++;
            created += result.created;
            updated += result.updated;
        } catch (error) {
            skipped++;
            console.error(
                `  Failed: ${error.message}`
            );
        }
    }

    console.log("\nAccount balance seed completed.");
    console.log(`Accounts seeded: ${seeded}`);
    console.log(`Accounts skipped: ${skipped}`);
    console.log(`Snapshots created: ${created}`);
    console.log(`Snapshots refreshed: ${updated}`);
    console.log(
        `Total snapshots: ${await history.countDocuments({})}`
    );
} finally {
    await closeMongoDB();
}
}

async function seedApprovalManagement() {
const PREFIX = "DEMO-APPROVAL-MANAGEMENT-V1";

const LEVELS = ["Low", "Medium", "High", "Critical"];

const ROLES = {
  Low: [],
  Medium: ["OperationsReviewer"],
  High: ["OperationsReviewer", "SeniorReviewer"],
  Critical: ["SeniorReviewer", "ComplianceReviewer"]
};

const ACTORS = [
  {
    actorId: "ACTOR-OPERATIONS-001",
    name: "Olivia Chen",
    role: "OperationsReviewer",
    active: true
  },
  {
    actorId: "ACTOR-SENIOR-001",
    name: "Daniel Brooks",
    role: "SeniorReviewer",
    active: true
  },
  {
    actorId: "ACTOR-COMPLIANCE-001",
    name: "Priya Shah",
    role: "ComplianceReviewer",
    active: true
  },
  {
    actorId: "ACTOR-POLICY-001",
    name: "Morgan Lee",
    role: "PolicyAdministrator",
    active: true
  }
];

const BY_ROLE = Object.fromEntries(
  ACTORS.map(actor => [actor.role, actor])
);

const DAYS = 86400000;

const date = (daysAgo, hours = 0) =>
  new Date(Date.now() - daysAgo * DAYS - hours * 3600000);

const uuid = (kind, value) => {
  const hex = createHash("sha256")
    .update(`${PREFIX}:${kind}:${value}`)
    .digest("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const insertOnce = (db, name, key, doc) =>
  db.collection(name).updateOne(
    key,
    { $setOnInsert: doc },
    { upsert: true }
  );

async function main() {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.ALLOW_APPROVAL_DEMO_SEED !== "1"
  ) {
    throw new Error(
      "Use NODE_ENV=development ALLOW_APPROVAL_DEMO_SEED=1 against a disposable development database"
    );
  }

  await connectMongoDB();

  try {
    const db = getDatabase();

    const [accounts, clients, policies] = await Promise.all([
      db.collection("accounts")
        .find({ status: "Active" })
        .project({
          accountId: 1,
          currency: 1,
          clientId: 1
        })
        .toArray(),

      db.collection("clients")
        .find({})
        .project({ clientId: 1 })
        .limit(1)
        .toArray(),

      db.collection("approval_policies")
        .find({ status: "Active" })
        .toArray()
    ]);

    const byCurrency = new Map();

    for (const account of accounts) {
      const values = byCurrency.get(account.currency) ?? [];

      values.push(account);
      byCurrency.set(account.currency, values);
    }

    const pair = [...byCurrency.entries()].find(
      ([, values]) =>
        values.length >= 2 &&
        values[0].accountId !== values[1].accountId
    );

    if (!pair) {
      throw new Error(
        "At least two active accounts of the same currency are required. Run the existing core development seed first."
      );
    }

    if (!clients.length) {
      throw new Error(
        "No clients found. Run the existing core development seed first."
      );
    }

    const [currency, accountList] = pair;
    const [source, destination] = accountList;

    const riskPolicy = await db
      .collection("risk_policies")
      .findOne({
        status: "Active",
        currency
      });

    if (!riskPolicy) {
      throw new Error(
        `Missing active ${currency} risk policy. Run existing migrations first.`
      );
    }

    const policyFor = level =>
      policies.find(
        policy =>
          policy.riskLevel === level &&
          JSON.stringify(policy.requiredRoles) ===
            JSON.stringify(ROLES[level])
      );

    if (LEVELS.some(level => !policyFor(level))) {
      throw new Error(
        "Active Assignment 3 approval policies are missing or have unexpected reviewer roles."
      );
    }

    for (const actor of ACTORS) {
      await insertOnce(
        db,
        "workflow_actors",
        { actorId: actor.actorId },
        actor
      );
    }

    const statuses = [
      "Pending",
      "InReview",
      "Approved",
      "Rejected",
      "Escalated",
      "Cancelled"
    ];

    const summary = {
      transactions: 0,
      assessments: 0,
      workflows: 0,
      decisions: 0,
      definitionEvents: 0,
      draftPolicies: 0
    };

    for (let i = 0; i < 72; i++) {
      const level = LEVELS[i % LEVELS.length];
      const roles = ROLES[level];

      const status =
        level === "Low"
          ? "NotRequired"
          : statuses[
              Math.floor(i / LEVELS.length) %
                statuses.length
            ];

      const age =
        i % 9 === 0
          ? 35 + (i % 45)
          : i % 27;

      const createdAt = date(age, i % 20);

      const txId = uuid("transaction", i);
      const assessmentId = uuid("assessment", i);
      const workflowId = uuid("workflow", i);

      const transactionsStatus =
        status === "NotRequired" || status === "Approved"
          ? "Completed"
          : ["Rejected", "Cancelled"].includes(status)
            ? "Rejected"
            : "Pending";

      const tx = {
        transactionId: txId,
        referenceNumber:
          `APPR-DEMO-${String(i + 1).padStart(5, "0")}`,
        sourceAccountId: source.accountId,
        destinationAccountId: destination.accountId,
        amountMinor: Long.fromNumber(
          150000 + i * 725000
        ),
        currency,
        transactionType: "Transfer",
        status: transactionsStatus,
        description: `${PREFIX}: ${level} / ${status}`,
        isLegacy: true,
        rejectionCode:
          transactionsStatus === "Rejected"
            ? "BUSINESS_RULE_VIOLATION"
            : null,
        rejectionReason:
          transactionsStatus === "Rejected"
            ? "Development approval fixture"
            : null,
        createdAt,
        updatedAt: createdAt,
        processedAt:
          transactionsStatus === "Completed"
            ? createdAt
            : null
      };

      await insertOnce(
        db,
        "transactions",
        { transactionId: txId },
        tx
      );

      summary.transactions++;

      const assessment = {
        assessmentId,
        transactionId: txId,
        policyId: riskPolicy.policyId,
        policyVersion: riskPolicy.version,
        riskScore: {
          Low: 12,
          Medium: 38,
          High: 64,
          Critical: 89
        }[level],
        riskLevel: level,
        approvalRequired: roles.length > 0,
        triggeredRules: [],
        assessedAt: createdAt
      };

      await insertOnce(
        db,
        "risk_assessments",
        { assessmentId },
        assessment
      );

      summary.assessments++;

      if (!roles.length) continue;

      let currentStage = 1;

      const stages = roles.map(
        (requiredRole, index) => ({
          stageNumber: index + 1,
          requiredRole,
          status: index ? "Waiting" : "Pending"
        })
      );

      const decisions = [];

      if (
        status === "InReview" &&
        roles.length > 1
      ) {
        stages[0].status = "Approved";
        stages[1].status = "Pending";
        currentStage = 2;

        decisions.push({
          index: 0,
          decision: "Approved"
        });
      } else if (status === "Approved") {
        stages.forEach(stage => {
          stage.status = "Approved";
        });

        roles.forEach((_, index) =>
          decisions.push({
            index,
            decision: "Approved"
          })
        );

        currentStage = null;
      } else if (status === "Rejected") {
        stages[0].status = "Rejected";

        stages.slice(1).forEach(stage => {
          stage.status = "Cancelled";
        });

        decisions.push({
          index: 0,
          decision: "Rejected"
        });

        currentStage = null;
      } else if (status === "Cancelled") {
        stages.forEach(stage => {
          stage.status = "Cancelled";
        });

        currentStage = null;
      } else if (status === "Escalated") {
        stages[0].status = "Pending";
      }

      const approvalPolicy = policyFor(level);

      const workflow = {
        workflowId,
        transactionId: txId,
        assessmentId,
        approvalPolicyId: approvalPolicy.policyId,
        approvalPolicyVersion: approvalPolicy.version,
        status,
        currentStage,
        requiredStages: stages,
        createdAt,
        updatedAt: date(
          Math.max(0, age - 1),
          0
        )
      };

      await insertOnce(
        db,
        "approval_workflows",
        { workflowId },
        workflow
      );

      summary.workflows++;

      for (const decision of decisions) {
        const role = roles[decision.index];
        const actor = BY_ROLE[role];

        const decidedAt = new Date(
          createdAt.getTime() +
          (decision.index + 1) * 3600000
        );

        const decisionId = uuid(
          "decision",
          `${i}:${decision.index}`
        );

        await insertOnce(
          db,
          "approval_decisions",
          { decisionId },
          {
            decisionId,
            workflowId,
            transactionId: txId,
            stageNumber: decision.index + 1,
            actorId: actor.actorId,
            actorRole: role,
            decision: decision.decision,
            comments:
              `${PREFIX}: ${decision.decision} example`,
            decidedAt,
            idempotencyKey:
              `${PREFIX}-${i}-${decision.index}`
          }
        );

        summary.decisions++;
      }
    }

    const definitions = await db
      .collection("approval_workflow_definitions")
      .find({
        definitionId: {
          $in: [
            "AWD-HIGH",
            "AWD-MEDIUM",
            "AWD-CRITICAL",
            "AWD-MANUAL",
            "AWD-EXCEPTION"
          ]
        }
      })
      .project({ definitionId: 1 })
      .toArray();

    const auditActions = [
      "Created",
      "Updated",
      "Conditions Updated",
      "SLA Updated",
      "Assignments Updated",
      "Activated",
      "Accessed"
    ];

    for (const def of definitions) {
      for (let i = 0; i < auditActions.length; i++) {
        const eventId = uuid(
          "definition-event",
          `${def.definitionId}:${i}`
        );

        await insertOnce(
          db,
          "approval_workflow_definition_events",
          { eventId },
          {
            eventId,
            definitionId: def.definitionId,
            action: auditActions[i],
            actorId: ACTORS[i % ACTORS.length].actorId,
            details: {
              description:
                `${PREFIX}: demonstration ${auditActions[i].toLowerCase()} event`,
              demo: true
            },
            createdAt: date(i + 1, i)
          }
        );

        summary.definitionEvents++;
      }
    }

    const samples = [
      {
        id: "TRANSFER-LIMITS",
        name: "High-Value Transfer Draft",
        status: "Draft",
        levels: ["High", "Critical"]
      },
      {
        id: "EXCEPTION-REVIEW",
        name: "Exception Review Draft",
        status: "Draft",
        levels: ["Medium", "High"]
      },
      {
        id: "POLICY-REVIEW",
        name: "Policy Review Pending Approval",
        status: "PendingApproval",
        levels: ["Critical"]
      },
      {
        id: "LEGACY",
        name: "Legacy Approval Policy Archive",
        status: "Archived",
        levels: ["Medium"]
      }
    ];

    for (const [index, item] of samples.entries()) {
      const policyId = `${PREFIX}-${item.id}`;
      const createdAt = date(12 + index);

      await insertOnce(
        db,
        "approval_policies",
        { policyId, version: 1 },
        {
          policyId,
          version: 1,
          name: item.name,
          description:
            `${PREFIX}: ${item.name}. Example policy record for directory filters and version history.`,
          status: item.status,
          riskLevels: item.levels,
          requiredRoles: [],
          owner: "Operations",
          createdBy: "ACTOR-POLICY-001",
          changedBy: "ACTOR-POLICY-001",
          changeSummary: "Created development fixture",
          createdAt,
          updatedAt: createdAt,
          effectiveDate:
            item.status === "Archived"
              ? date(80)
              : null
        }
      );

      summary.draftPolicies++;
    }

    console.log(
      `${PREFIX}: insert-only seed finished; existing documents were not overwritten.`
    );

    console.table(summary);

    console.log(
      "Data covers queue, workflow states, decision history, policy filters and workflow-definition audit activity."
    );

    console.log(
      "Policy drafts and archived examples are not active routing policies."
    );

    console.log(
      "Escalated workflows are status fixtures, not real escalation-decision events."
    );
  } finally {
    await closeMongoDB();
  }
}

  await main();
}


try {
  await seedCore();
  await seedCases();
  await seedCredit();
  await seedBalances();
  await seedApprovalManagement();
  console.log("All five development seed stages completed.");
} catch (error) {
  console.error("Combined development seeding failed:", error);
  process.exitCode = 1;
}
