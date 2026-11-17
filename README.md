# FinOps Enterprise — Corporate Financial Operations Portal

**Current source-based README** · Docker / Next.js / Express / MongoDB · Assignments 1–3

This README describes the source code supplied in `finops-enterprise(20261117-064018).zip`. The application simulates corporate client/account administration, internal transfers, risk assessment, approval workflows, operational reporting, policy management, and supporting documents. Transactions are simulated; no actual banking network is used.

## 1. First-time setup (start here)

### 1.1 Prerequisites

Install **Docker Desktop** (with the `docker compose` command), **Git**, and a browser. Start Docker Desktop first. Node.js/npm are **not required** for the standard Docker deployment; they are needed if you want to run tests directly on the host.

### 1.2 Clone and configure

```bash
git clone https://github.com/errixed/finops-enterprise.git
cd finops-enterprise
cp .env.example .env
```
For Windows users `cp` command is only available on Windows PowerShell console.

The default `.env.example` contains:

```dotenv
FRONTEND_PORT=8080
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb://mongodb:27017/finops_enterprise?replicaSet=rs0
MONGODB_DATABASE=finops_enterprise
CORS_ORIGIN=http://localhost:8080
NEXT_PUBLIC_API_BASE_URL=
```

**Do not replace `mongodb` with `localhost` inside the Docker Compose environment:** `mongodb` is the database service hostname on Docker's network. `NEXT_PUBLIC_API_BASE_URL` is empty by default so browser calls can use the public same-origin `/api/v1` proxy. Change `FRONTEND_PORT` and `CORS_ORIGIN` together if 8080 is unavailable.

### 1.3 Build and launch

From the project root:

```bash
docker compose up -d --build
docker compose ps
```

Compose starts MongoDB, waits for replica-set health, runs the `migrate` service (`migrate-json-to-mongodb.js` followed by `migrate-schema.js`), then starts the backend, frontend and Nginx. First builds can take longer as Docker installs dependencies. Check that `mongodb`, `backend`, `frontend`, and `nginx` report **healthy**. The one-off `migrate` container is expected to **exit successfully**.

### 1.4 Open and verify

- **Web application:** http://localhost:8080
- **API health:** http://localhost:8080/api/v1/health
- **API base URL:** `http://localhost:8080/api/v1`

```bash
curl -i http://localhost:8080/api/v1/health
curl -i http://localhost:8080/api/v1/clients
```

The backend listens on **port 3000 inside Docker only**, and the frontend on **3001 inside Docker only**. The host-facing entry point is Nginx on **8080**. Consequently `curl localhost:3000` on the host will fail with the supplied Compose file; this is expected.

### 1.5 Routine commands

```bash
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
docker compose logs --tail=100 migrate
docker compose logs --tail=100 nginx
docker compose down
docker compose up -d
docker compose up -d --build
```

`docker compose down` **keeps** the MongoDB volume. **Never use `docker compose down -v` unless you deliberately want to destroy persisted data.**

### 1.6 Initial data and optional demo data

Historical clients, accounts and transactions come from the `backend/data/legacy/*.json` files and are imported by the automatic migration. This data is separate from the optional demo seed. For richer dashboards/approvals, follow the explicit seed procedure in §2 below. Running a seed is **not required** simply to start the application.

## 2. Development demo seeds

The combined seed entry point is **`backend/scripts/seed.js`**. It performs five stages: core demonstration clients/accounts/transactions, risk cases, credit-related examples, account/balance history, and approval-management examples. The file enforces `NODE_ENV=development` and `ALLOW_ALL_DEMO_SEEDS=1`; without both it exits. **Seeds modify the selected database**, so run them only against a disposable/dev database or a database whose demo data you explicitly want to change.

For the supplied Docker Compose app, from the project root:

```bash
docker compose run --rm --no-deps \
  -e NODE_ENV=development \
  -e ALLOW_ALL_DEMO_SEEDS=1 \
  -e ALLOW_APPROVAL_DEMO_SEED=1 \
  backend node scripts/seed.js
```

MongoDB must already be running and healthy (`docker compose up -d`). The seed script includes insert-only demonstration data in some phases; it is not a general database reset, and you should review the script before rerunning on valuable data. Inspect resulting records through the UI or API, and read the console summary for each seed stage.

Related initialization scripts:

```bash
docker compose run --rm --no-deps backend node scripts/verify-migration.js
docker compose run --rm --no-deps backend npm run validate:data
```

`initialize-risk-policies.js`, `initialize-approval-policies.js`, index and validator scripts are internal initialization utilities; do not confuse them with the combined development seed. Schema migration is executed by the Compose `migrate` service.

## 3. Run all tests

### 3.1 Backend tests (Docker; recommended)

From the project root, after Docker MongoDB is up:

```bash
docker compose run --rm --no-deps \
  -v "$PWD/backend:/app" \
  -v /app/node_modules \
  backend npm test
```

The backend's `npm test` script invokes `node --test --test-concurrency=1 tests/*.test.js`. The bind mount ensures the container executes the **current working tree**, not just the last image build. The anonymous `/app/node_modules` mount preserves container-compatible dependencies. Tests include HTTP integration, client/account constraints, transaction processing and concurrency, risk assessments/cases/policy lifecycle, approval decisions and management, document access, database infrastructure, and workflow-builder behavior.

**Database safety:** the integration helper generates databases named `finops_test_<random>` and verifies their names before setup/cleanup. Inspect the test logs: tests **must not** connect to or drop `finops_enterprise`. Testing performs database writes; use an isolated test environment.

To run a single backend suite:

```bash
docker compose run --rm --no-deps \
  -v "$PWD/backend:/app" \
  -v /app/node_modules \
  backend node --test tests/risk-policy-lifecycle.integration.test.js
```

To request Node's experimental coverage report:

```bash
docker compose run --rm --no-deps \
  -v "$PWD/backend:/app" \
  -v /app/node_modules \
  backend node --test --test-concurrency=1 --experimental-test-coverage tests/*.test.js
```

### 3.2 Backend tests directly on macOS/Linux

If Node/npm are installed locally, start Docker MongoDB, install backend dependencies, then override the database hostname (which is only resolvable *inside* Docker):

```bash
docker compose up -d mongodb
cd backend
npm ci
MONGODB_URI='mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true' npm test
cd ..
```

This uses the project's MongoDB port mapping `127.0.0.1:27017:27017`. Keep the temporary-database safeguards enabled.

### 3.3 Frontend end-to-end tests (Playwright)

The frontend package defines `test:e2e` and `test:e2e:ui`. The shipped `frontend/playwright.config.ts` starts a Next.js development server on `127.0.0.1:3001` automatically. Run **on the host** with Node/npm installed:

```bash
cd frontend
npm ci
npx playwright install chromium
npm run test:e2e
```

For the interactive runner:

```bash
npm run test:e2e:ui
```

These tests do **not** run as part of backend `npm test`. If you want to test the already-running Docker/Nginx site on `localhost:8080`, modify Playwright `baseURL` and remove/adjust the `webServer` configuration; the committed configuration targets a separate local dev server on 3001.

### 3.4 Postman/manual API tests

Import `postman/postman.json` if present in your checkout. Set its base URL to **`http://localhost:8080/api/v1`** for the default Compose deployment. Some routes require an actor header, valid resource IDs, idempotency keys, or document bytes. **Do not run a write-heavy collection against production or important demo records.** A broad route collection is not equivalent to a passing automated acceptance test suite.

## 4. Architecture and repository layout

```text
Browser / Postman
      |
      v
NGINX :8080 (host)
      |                           |                      +--> Express :3000 (Docker)
      +--> Next.js :3001           |  routes / controllers / services / repositories
                                      MongoDB 7 replica set (rs0)
```

Key directories: `backend/src/routes` (HTTP contracts), `backend/src/controllers` (request processing), `backend/src/services` (business rules), `backend/src/repositories` (MongoDB persistence), `backend/scripts` (migration, initialization and seeds), `backend/tests` (Node tests), `frontend/src/app` (Next.js pages), `frontend/src/components` (UI), `frontend/src/services` (API clients), and `frontend/tests/e2e` (Playwright tests). Nginx proxy configuration is `frontend/nginx.conf`; orchestration is `docker-compose.yml`.

**Stack verified from package files:** Next.js 16.4.0, React 19.3.0, TypeScript, Express 5.2.1, Node ES modules, MongoDB driver 7.x, MongoDB 7, Nginx, Docker Compose, and Playwright.

### Data model and controls

Core `clients`, `accounts`, and `transactions` collections support the directory and transfer workflows. Financial amounts are integer **minor units**: CAD 125.50 is `12550`. Financial processing uses MongoDB transactions to debit and credit atomically. The database also stores risk policies/assessments/cases, workflow definitions, approval decisions, actor records, audit events, balance history and document-related records. Documents use GridFS where implemented.

New transfers are initiated separately from processing; processing validates eligible status, funds, account state and currency, and records `Completed` or `Rejected`. The API also introduces risk classification, approval requirements, reviewer stages, escalation, policy lifecycle, and monitoring/reporting. Legacy migrated records remain distinct from newly initiated transfers.

**Security scope:** the project uses simulated workflow actors and has a demo document-access switch. Do not interpret these controls as production-grade authentication, authorization, encryption governance, or payments compliance. Restrict deployments to trusted development environments unless proper security controls are added.

## 5. REST API — complete mounted route inventory

**Public base:** `http://localhost:8080/api/v1`. Replace `:id` / `:documentId` in the paths with an actual record ID. All paths below are **relative to `/api/v1`**. Routes are listed from `backend/src/routes/index.js` and the mounted route modules in this archive. Some operations are purposefully state-changing; read the request requirements below before calling them.

### /clients (11 routes)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/clients` | Retrieve clients |
| `GET` | `/clients/options` | Retrieve options |
| `GET` | `/clients/summary` | Retrieve summary |
| `GET` | `/clients/:id/accounts` | Retrieve accounts |
| `GET` | `/clients/metrics` | Retrieve metrics |
| `GET` | `/clients/:id/report` | Retrieve report |
| `GET` | `/clients/export` | Export client directory |
| `GET` | `/clients/:id` | Get clients record |
| `POST` | `/clients` | Create clients record |
| `PUT` | `/clients/:id` | Update clients record |
| `PATCH` | `/clients/:id` | Patch clients record |

### /accounts (7 routes)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/accounts` | Retrieve accounts |
| `GET` | `/accounts/options` | Retrieve options |
| `GET` | `/accounts/with-activity` | Retrieve with activity |
| `GET` | `/accounts/:id/report` | Retrieve report |
| `GET` | `/accounts/:id/statement` | Download account statement |
| `GET` | `/accounts/:id` | Get accounts record |
| `POST` | `/accounts` | Create accounts record |

### /transactions (13 routes)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/transactions` | Retrieve transactions |
| `GET` | `/transactions/directory` | Retrieve directory |
| `POST` | `/transactions/preview` | Preview proposed transaction |
| `GET` | `/transactions/:id/documents` | Retrieve documents |
| `POST` | `/transactions/:id/documents` | Upload permitted raw document bytes (max 10 MB; demo access guard) |
| `GET` | `/transactions/:id/documents/:documentId` | Download uploaded document |
| `DELETE` | `/transactions/:id/documents/:documentId` | Delete documents for transactions |
| `GET` | `/transactions/history` | Retrieve history |
| `GET` | `/transactions/:id/document-history` | Retrieve document history |
| `GET` | `/transactions/:id` | Get transactions record |
| `GET` | `/transactions/:id/risk-assessment` | Retrieve risk assessment |
| `POST` | `/transactions` | Initiate transfer; Idempotency-Key header required |
| `POST` | `/transactions/:id/process` | Process eligible pending transfer |

### /dashboard (2 routes)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/dashboard/summary` | Retrieve summary |
| `GET` | `/dashboard/trend` | Retrieve trend |

### /risk-policies (5 routes)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/risk-policies` | Retrieve risk policies |
| `GET` | `/risk-policies/:id` | Get risk policies record |
| `POST` | `/risk-policies` | Create risk policies record |
| `PUT` | `/risk-policies/:id` | Update risk policies record |
| `POST` | `/risk-policies/:id/activate` | Activate risk policy draft |

### /risk-cases (13 routes)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/risk-cases/summary` | Retrieve summary |
| `GET` | `/risk-cases` | Retrieve risk cases |
| `POST` | `/risk-cases` | Create risk cases record |
| `GET` | `/risk-cases/:id` | Get risk cases record |
| `PATCH` | `/risk-cases/:id` | Patch risk cases record |
| `POST` | `/risk-cases/:id/resolve` | Resolve risk case |
| `GET` | `/risk-cases/:id/events` | Retrieve events |
| `POST` | `/risk-cases/:id/notes` | Add note to risk case |
| `GET` | `/risk-cases/:id/triggers` | Retrieve triggers |
| `GET` | `/risk-cases/:id/documents` | Retrieve documents |
| `POST` | `/risk-cases/:id/documents` | Upload supporting document to risk case |
| `GET` | `/risk-cases/:id/documents/:documentId` | Get documents for risk cases |
| `DELETE` | `/risk-cases/:id/documents/:documentId` | Delete documents for risk cases |

### /approval-workflows (5 routes)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/approval-workflows` | Retrieve approval workflows |
| `GET` | `/approval-workflows/:id` | Get approval workflows record |
| `GET` | `/approval-workflows/:id/decisions` | Retrieve decisions |
| `POST` | `/approval-workflows/:id/decisions` | Submit approval decision for workflow |
| `POST` | `/approval-workflows/:id/escalate` | Escalate approval workflow |

### /approval-workflow-definitions (9 routes)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/approval-workflow-definitions/summary` | Retrieve summary |
| `GET` | `/approval-workflow-definitions` | Retrieve approval workflow definitions |
| `GET` | `/approval-workflow-definitions/:id/audit` | Retrieve audit |
| `GET` | `/approval-workflow-definitions/:id` | Get approval workflow definitions record |
| `POST` | `/approval-workflow-definitions` | Create approval workflow definitions record |
| `PUT` | `/approval-workflow-definitions/:id` | Update approval workflow definitions record |
| `POST` | `/approval-workflow-definitions/:id/duplicate` | Duplicate workflow definition |
| `POST` | `/approval-workflow-definitions/:id/status` | Change workflow definition status |
| `DELETE` | `/approval-workflow-definitions/:id` | Delete approval workflow definitions record |

### /approval-workflow-clones (1 route)

| Method | Endpoint | Operation |
|---|---|---|
| `POST` | `/approval-workflow-clones/:id` | Clone selected workflow definition |

### /approval-workflow-definition-details (6 routes)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/approval-workflow-definition-details/actors` | Retrieve actors |
| `GET` | `/approval-workflow-definition-details/:id` | Get approval workflow definition details record |
| `PUT` | `/approval-workflow-definition-details/:id/stages` | Update stages |
| `PUT` | `/approval-workflow-definition-details/:id/conditions` | Update conditions |
| `PUT` | `/approval-workflow-definition-details/:id/assignments` | Update assignments |
| `PUT` | `/approval-workflow-definition-details/:id/sla` | Update sla |

### /approval-workflow-sla (2 routes)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/approval-workflow-sla/:id/metrics` | Retrieve metrics |
| `PUT` | `/approval-workflow-sla/:id` | Update approval workflow sla record |

### /workflow-actors (1 route)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/workflow-actors` | Retrieve workflow actors |

### /risk-assessments (6 routes)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/risk-assessments` | Retrieve risk assessments |
| `GET` | `/risk-assessments/overview` | Retrieve overview |
| `GET` | `/risk-assessments/alerts` | Retrieve alerts |
| `GET` | `/risk-assessments/dashboard` | Retrieve dashboard |
| `GET` | `/risk-assessments/analytics` | Retrieve analytics |
| `GET` | `/risk-assessments/:id` | Get risk assessments record |

### /risk (1 route)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/risk/dashboard` | Retrieve dashboard |

### /approvals (3 routes)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/approvals/dashboard` | Retrieve dashboard |
| `GET` | `/approvals/queue` | Retrieve queue |
| `GET` | `/approvals/overview` | Retrieve overview |

### /approval-workflow-builders (6 routes)

| Method | Endpoint | Operation |
|---|---|---|
| `POST` | `/approval-workflow-builders/drafts` | Create approval workflow builders draft |
| `GET` | `/approval-workflow-builders/drafts/:id` | Get approval workflow builders record |
| `PUT` | `/approval-workflow-builders/drafts/:id` | Update approval workflow builders record |
| `POST` | `/approval-workflow-builders/drafts/:id/complete` | Complete workflow builder draft |
| `DELETE` | `/approval-workflow-builders/drafts/:id` | Delete approval workflow builders record |
| `POST` | `/approval-workflow-builders` | Create approval workflow builders record |

### /approval-decision-history (1 route)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/approval-decision-history` | Retrieve approval decision history |

### /approval-audit-trail (1 route)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/approval-audit-trail` | Retrieve approval audit trail |

### /approval-policy-management (3 routes)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/approval-policy-management` | Retrieve approval policy management |
| `GET` | `/approval-policy-management/:id` | Get approval policy management record |
| `POST` | `/approval-policy-management/drafts` | Create approval policy management draft |

### /approval-policy-wizard (5 routes)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/approval-policy-wizard/workflows` | Retrieve workflows |
| `GET` | `/approval-policy-wizard/:id` | Get approval policy wizard record |
| `POST` | `/approval-policy-wizard` | Create approval policy wizard record |
| `PUT` | `/approval-policy-wizard/:id` | Update approval policy wizard record |
| `DELETE` | `/approval-policy-wizard/:id` | Delete approval policy wizard record |

### /health (1 route)

| Method | Endpoint | Operation |
|---|---|---|
| `GET` | `/health` | Application/database readiness |

### Request examples and important headers

**Create client** (`POST /clients`), example fields: `companyName`, `registrationNumber`, `industry`, `country`, `contactEmail`, `contactPhone`; use the valid option values exposed by `GET /clients/options`. **Create account** (`POST /accounts`) requires an eligible `clientId`, account information and currency; obtain options from `GET /accounts/options`. For edit operations, consult server validation and the corresponding frontend forms for the allowed fields.

**Initiate a transfer:**

```http
POST /api/v1/transactions
Content-Type: application/json
Idempotency-Key: sample-transfer-unique-001
```

```json
{
  "sourceAccountId": "<existing-source-account-id>",
  "destinationAccountId": "<existing-destination-account-id>",
  "amountMinor": 25000,
  "currency": "CAD",
  "description": "Test transfer"
}
```

Account IDs must exist, be compatible, and differ from each other. New initiation returns a Pending transaction. `POST /transactions/:id/process` then attempts processing. Replaying an idempotency key with a different payload can return `409`. Only process a record in an appropriate state.

**Risk policy management:** creation, editing and activation are protected by **simulated** policy administrator checking. Supply `X-Actor-Id: ACTOR-POLICY-001` only after seeding a matching active `PolicyAdministrator` actor, or create an authorized test actor in a disposable database. Identifiers follow the backend's risk-policy validation rules. Policies support drafts and versioning; activated historical versions are preserved.

**Approvals:** the workflow decision route expects an eligible reviewer actor in the correct stage. For seeded examples, actors include `ACTOR-OPERATIONS-001`, `ACTOR-SENIOR-001`, and `ACTOR-COMPLIANCE-001`; approvals and escalation may change workflow or transaction state. Workflow builders, definition details, SLA routes, and policy wizard each accept **different** JSON schemas; consult their route module before submitting create/update payloads, rather than reusing a body from another policy route.

**Transaction document upload:** `POST /transactions/:id/documents` accepts **raw binary request bodies**, not ordinary JSON or multipart form data. Supported content types in its parser are PDF, PNG, JPEG, DOCX, XLSX, DOC, and XLS; its request-body limit is **10 MB**. Download and delete use the stored document ID. The shipped Docker backend currently sets `ENABLE_DEMO_DOCUMENT_ACCESS=true`; the integration helper disables it. This flag is **demo-only** and should not be exposed to untrusted users.

**Response codes:** reads and successful actions commonly return `200`, creations `201`, deletion `204`, validation `400`, missing resource `404`, state/uniqueness conflict `409`, and infrastructure errors `5xx` (for example `503` health failure). Exact status and JSON shape depend on route and operation. Error responses generally have an `error` object with `code`, `message`, and `details`.

## 6. Migration and persistence

The Compose `migrate` service invokes these commands in order:

```bash
node scripts/migrate-json-to-mongodb.js
node scripts/migrate-schema.js
```

The first imports the legacy JSON dataset, and the second applies current schema changes. A failed migration blocks the backend startup. Verify historical migration with:

```bash
docker compose logs migrate --tail=100
docker compose run --rm --no-deps backend node scripts/verify-migration.js
```

The seed is **separate** from the migration. Normal Compose restarts preserve the named `mongodb_data` volume and should not be used as a database reset. Never remove that volume casually, particularly after using the application for transactions or workflow reviews.

## 7. Troubleshooting

| Symptom | Check and remedy |
|---|---|
| `curl localhost:3000` refuses connection | Expected with supplied Compose. Use `localhost:8080/api/v1`; only Nginx is host-published for HTTP. |
| `502 Bad Gateway` on `localhost:8080` | `docker compose ps`; inspect `backend`, `frontend`, and `nginx` logs. |
| `getaddrinfo ENOTFOUND mongodb` from local `npm test` | Docker hostname cannot resolve on the host. Use Docker test command or host URI `127.0.0.1:27017` with `directConnection=true`. |
| MongoDB transactions fail | Confirm single-node replica set is healthy and `migrate` completed. |
| Seed refuses to run | Set both `NODE_ENV=development` and `ALLOW_ALL_DEMO_SEEDS=1` **on the seed command**, not in the production Compose environment. |
| Tests use `finops_enterprise` | **Stop immediately**; verify `backend/tests/helpers/integration.js` creates and verifies `finops_test_...` before any database writes or cleanup. |
| Playwright cannot find a server | Its committed config starts a local frontend on 3001. Run `npm ci` and execute Playwright from `frontend/`; check that port 3001 is free. |
| Postman collection runner reports an unexpected error | First try `curl -i http://localhost:8080/api/v1/health`, then run one GET in Postman. Populate valid IDs, headers and request bodies before running mutation requests. |
| Port 8080 already in use | Change `FRONTEND_PORT` and `CORS_ORIGIN` in `.env`, then recreate affected services. |

## 8. Development and test coverage notes

Backend integration suites cover account/client validation, transaction handling, concurrent processing and idempotency, risk assessment and policy lifecycle, risk cases, approval execution/management and workflow builder behavior. Frontend Playwright tests cover navigation and selected page-level behavior; they are **not** a substitute for complete user-flow functional coverage. Continue testing document upload/download, administrative policy configuration, reporting totals, error handling, and failure recovery with isolated data. Do not equate a passing test count with proof of complete coverage.

## 9. Development-assistance acknowledgement

ChatGPT was used as a development aid for UI styling, tests, API/Postman tooling, documentation, and script/design review.

