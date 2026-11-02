# FinOps Enterprise — Corporate Financial Operations Portal

FinOps Enterprise is a full-stack web application for managing corporate clients, financial accounts, and simulated financial transfers. The application was developed for Assignment 1 and extended in Assignment 2 to support MongoDB persistence, financial transaction processing, and a fully containerized deployment.

The frontend uses Next.js 16, React 19, TypeScript, and CSS. The backend uses Node.js and Express 5 with ES modules. MongoDB is the application's sole runtime database, and Docker Compose manages the complete application environment.

## 1. Quick Start — Installation and Setup

### 1.1 Prerequisites

The following software is required:

- Docker Desktop with Docker Compose
- Git
- A modern web browser

Node.js and npm do not need to be installed locally to run the application through Docker.

### 1.2 Clone the Repository

```bash
git clone https://github.com/errixed/finops-enterprise.git
cd finops-enterprise
```

### 1.3 Configure Environment Variables

Copy the provided environment configuration:

```bash
cp .env.example .env
```

The default configuration is:

```env
FRONTEND_PORT=8080
PORT=3000
NODE_ENV=production

MONGODB_URI=mongodb://mongodb:27017/finops_enterprise?replicaSet=rs0
MONGODB_DATABASE=finops_enterprise

CORS_ORIGIN=http://localhost:8080
```

The default values are suitable for the provided Docker Compose configuration. Environment variables can be modified if different ports or database settings are required.

### 1.4 Build and Start the Application

Ensure Docker Desktop is running, then execute the following command from the project root:

```bash
docker compose up -d --build
```

Docker Compose automatically:

1. Builds the frontend and backend images.
2. Starts MongoDB.
3. Initializes the MongoDB replica set.
4. Executes the JSON-to-MongoDB migration.
5. Starts the Express backend after migration.
6. Starts the Next.js frontend.
7. Starts NGINX as the application's public entry point.

Health checks and service dependencies coordinate the startup process.

The initial build downloads the required images and installs application dependencies inside the containers.

### 1.5 Access the Application

Once all required services are running, open:

**Application:** http://localhost:8080

**Backend health endpoint:** http://localhost:8080/api/v1/health

**Dashboard API:** http://localhost:8080/api/v1/dashboard/summary

All frontend and API requests are served through NGINX on port 8080 by default.

The backend and MongoDB services communicate internally through the Docker network.

### 1.6 Verify the Containers

Check the container status:

```bash
docker compose ps
```

View application logs:

```bash
docker compose logs --tail=100
```

View specific service logs:

```bash
docker compose logs backend --tail=100
docker compose logs frontend --tail=100
docker compose logs mongodb --tail=100
docker compose logs migrate --tail=100
```

### 1.7 Stop or Restart the Application

Stop the application while preserving the database:

```bash
docker compose down
```

Start it again:

```bash
docker compose up -d
```

Rebuild after code changes:

```bash
docker compose up -d --build
```

MongoDB uses a persistent Docker volume named `mongodb_data`.

Do not use `docker compose down -v` unless the intention is to delete the stored database.

### 1.8 Troubleshooting

If a service fails to start, inspect its logs:

```bash
docker compose ps -a
docker compose logs migrate --tail=100
docker compose logs backend --tail=100
docker compose logs nginx --tail=100
```

A migration failure prevents the backend and dependent services from starting successfully.

If the frontend returns HTTP 502, verify that the backend is healthy and that the migration completed successfully.

If the migration fails because a JSON source file is missing, verify that the following files exist:

```text
backend/data/legacy/clients.json
backend/data/legacy/accounts.json
backend/data/legacy/transactions.json
```

If port 8080 is already occupied, change `FRONTEND_PORT` in `.env` and restart the application. Adjust `CORS_ORIGIN` when changing the public application origin.

## 2. Project Overview

FinOps Enterprise provides a centralized corporate financial operations portal.

Assignment 1 established client management, account management, transaction visibility, dashboard reporting, REST API endpoints, and a layered backend architecture.

Assignment 2 extends the application with:

- MongoDB persistence instead of JSON-file repositories.
- Automated migration of the Assignment 1 dataset.
- Transaction initiation and processing.
- Financial business-rule validation.
- Idempotent transaction creation.
- Atomic financial transfers using MongoDB transactions.
- Conditional status transitions and concurrency protection.
- Completed and Rejected processing outcomes.
- Enhanced transaction details and dashboard indicators.
- Docker-based deployment with NGINX.

The existing Assignment 1 functionality remains available.

## 3. Business Scenario

A financial institution requires an internal portal to register corporate clients, manage financial accounts, review financial activity, and execute simulated transfers between accounts.

FinOps Enterprise allows users to:

- Register and maintain corporate client information.
- Search, filter, and inspect corporate clients.
- Register accounts associated with eligible clients.
- View account details and balances.
- Search and inspect historical transactions.
- Initiate financial transfers between existing accounts.
- Process eligible Pending transactions.
- Review successful and rejected processing outcomes.
- Monitor financial activity through the operations dashboard.

The system applies business rules for client registration, account creation, transaction validation, balance availability, currency compatibility, and financial transaction processing.

The financial transfers are simulated operations performed within the application's MongoDB database. The system does not connect to external banking or payment networks.

## 4. Technologies

| Component | Technology |
|---|---|
| Frontend | Next.js 16.4.0, React 19.3.0, TypeScript |
| Frontend styling | CSS, Google Material Symbols Rounded |
| Backend | Node.js 24, Express.js 5.2.1 |
| Backend modules | JavaScript ES modules |
| Database | MongoDB 7 |
| Database driver | MongoDB Node.js Driver |
| Reverse proxy | NGINX |
| Containerization | Docker and Docker Compose |
| API testing | Postman |
| Automated testing | Node.js built-in test runner |
| Dataset validation | Node.js validation scripts |
| Package management | npm |
| Version control | Git and GitHub |

The application uses Next.js rather than Vite.

## 5. Application Architecture

The application follows a layered architecture that separates presentation, HTTP handling, business rules, and database access.

### 5.1 Request Flow

```text
Browser
   |
   v
NGINX
   |
   +-----------------------+
   |                       |
   v                       v
Next.js Frontend       Express Backend
                           |
                           v
                        Routes
                           |
                           v
                       Controllers
                           |
                           v
                        Services
                           |
                           v
                       Repositories
                           |
                           v
                         MongoDB
```

NGINX receives requests on the application's public port.

Requests to `/api/v1/*` are forwarded to the Express backend. Other application requests are forwarded to the Next.js frontend.

The frontend communicates with the backend through REST APIs. It does not connect directly to MongoDB.

### 5.2 Frontend Architecture

The frontend is organized into:

- `frontend/src/app/` — Application pages and routes.
- `frontend/src/components/` — Reusable UI and form components.
- `frontend/src/services/` — HTTP requests, API types, and frontend service functions.
- `frontend/src/app/globals.css` — Application styling.
- `frontend/config.ts` — Frontend application and API route configuration.

React components manage user interaction, form validation, loading states, error handling, and navigation.

### 5.3 Backend Architecture

The backend is organized into:

- Routes — Define REST API endpoints.
- Controllers — Handle HTTP requests and responses.
- Services — Enforce validation and business rules.
- Repositories — Execute MongoDB queries and updates.
- Configuration — Manage environment settings and database connections.
- Middleware — Handle logging, errors, and unmatched routes.
- Utilities — Provide reusable financial, document, and transaction functions.

Controllers do not directly execute MongoDB queries.

Business rules are implemented in services, while repositories encapsulate database operations.

A shared MongoDB client is initialized during backend startup.

### 5.4 Database Architecture

MongoDB is the sole runtime persistence system.

The database is named:

```text
finops_enterprise
```

Its collections include:

- `clients`
- `accounts`
- `transactions`
- `schema_migrations`

Indexes and collection validators are initialized as part of the database migration and setup process.

## 6. Project Structure

```text
finops-enterprise/
├── backend/
│   ├── data/
│   │   └── legacy/
│   │       ├── clients.json
│   │       ├── accounts.json
│   │       └── transactions.json
│   ├── scripts/
│   │   ├── initialize-indexes.js
│   │   ├── initialize-validators.js
│   │   ├── migrate-json-to-mongodb.js
│   │   ├── validate-data.js
│   │   └── verify-migration.js
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── repositories/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/
│   │   ├── concurrency.test.js
│   │   ├── integration.test.js
│   │   ├── migration.test.js
│   │   ├── repository.test.js
│   │   └── transaction-processing.test.js
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── services/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── next.config.ts
│   ├── config.ts
│   └── package.json
├── mongodb/
│   └── replica-set-init/
│       └── init.sh
├── postman/
│   └── postman.json
├── screenshots/
├── scripts/
│   └── start.js
├── docker-compose.yml
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

The project structure excludes installed dependencies and generated build files.

The JSON files inside `backend/data/legacy/` are historical source data used for migration and validation. They are not the application's runtime persistence mechanism.

## 7. MongoDB Migration

### 7.1 Migration Objective

Assignment 1 used JSON files to store clients, accounts, and transactions.

Assignment 2 migrates the historical records to MongoDB while preserving the original identifiers, relationships, and financial values.

### 7.2 Source Dataset

The historical dataset is stored in:

```text
backend/data/legacy/
```

It contains:

| Collection | Historical Records |
|---|---:|
| Clients | 10 |
| Accounts | 20 |
| Transactions | 50 |
| Total | 80 |

The historical transactions include:

| Status | Count |
|---|---:|
| Pending | 8 |
| Completed | 38 |
| Rejected | 4 |

These values describe the original migration dataset, not necessarily the current MongoDB record counts.

### 7.3 Migration Process

The migration script is located at:

```text
backend/scripts/migrate-json-to-mongodb.js
```

It performs the following operations:

1. Loads and validates the historical JSON dataset.
2. Connects to MongoDB.
3. Initializes the required collections and validators.
4. Creates or verifies database indexes.
5. Converts the historical records into MongoDB documents.
6. Preserves the original public UUIDs and account numbers.
7. Preserves financial amounts and existing relationships.
8. Imports clients, accounts, and transactions.
9. Verifies migrated record counts and values.
10. Records successful migration information in `schema_migrations`.

Migration operations use MongoDB transactions to prevent partially committed imports.

The migration records a version and a checksum of the source dataset.

If the same migration has already completed successfully, the script skips the import rather than creating duplicate records.

A source-data conflict or incomplete migration is reported as an error.

### 7.4 Legacy Transactions

Historical transactions retain their original business status and are marked as legacy records.

Historical Completed and Rejected transactions remain terminal.

Historical Pending transactions are protected from the new processing operation.

Only newly initiated, eligible, non-legacy Pending transactions can be processed.

### 7.5 Verify Migration

After starting Docker, check the migration logs:

```bash
docker compose logs migrate --tail=100
```

Run migration verification:

```bash
docker compose run --rm --no-deps backend node scripts/verify-migration.js
```

The verification compares the original historical records against the corresponding MongoDB documents.

New records created after migration do not replace or modify the original legacy source files.

## 8. Data Model

### 8.1 Clients

Client documents contain fields such as:

- `clientId`
- `companyName`
- `registrationNumber`
- `registrationNumberNormalized`
- `industry`
- `country`
- `contactEmail`
- `contactPhone`
- `status`
- `createdAt`
- `updatedAt`

Client statuses include Active, Inactive, and Suspended.

Registration numbers are normalized to support uniqueness checks.

A client can own multiple financial accounts.

### 8.2 Accounts

Account documents contain fields such as:

- `accountId`
- `clientId`
- `accountNumber`
- `accountType`
- `currency`
- `balanceMinor`
- `status`
- `createdAt`

Each account belongs to an existing client.

Account creation requires an eligible Active client.

Account numbers are unique.

Account statuses include Active, Frozen, and Closed.

Supported currencies include CAD and USD.

### 8.3 Transactions

Transaction documents contain fields such as:

- `transactionId`
- `referenceNumber`
- `sourceAccountId`
- `destinationAccountId`
- `amountMinor`
- `currency`
- `transactionType`
- `description`
- `status`
- `idempotencyKey`
- `requestFingerprint`
- `isLegacy`
- `rejectionCode`
- `rejectionReason`
- `createdAt`
- `updatedAt`
- `processedAt`

Each transaction references a source and destination account.

New transfers are created with status Pending.

A successfully processed transfer becomes Completed.

A business-rule failure during processing results in Rejected with an appropriate code and reason.

### 8.4 Monetary Values

Financial balances and transaction amounts are stored as integer minor units.

For example:

```text
CAD 125.50 = 12550 minor units
USD 80.00  = 8000 minor units
```

Using integer minor units avoids floating-point precision issues during financial calculations.

Validation also checks that monetary values remain within the supported safe integer range.

## 9. Financial Transaction Processing

### 9.1 Transaction Initiation

Users can create simulated financial transfers through the Transaction Creation page.

The initiation process requires:

- A valid source account.
- A valid destination account.
- Different source and destination accounts.
- Compatible account currencies.
- A positive transaction amount.
- A description within the supported length.
- An idempotency key.

The backend generates the transaction ID and reference number.

Successful initiation creates a Pending transaction without immediately modifying account balances.

Initiation and processing are separate operations.

### 9.2 Transaction Lifecycle

```text
Pending
   |
   v
Processing
   |
   +------------------+
   |                  |
   v                  v
Completed          Rejected
```

The transaction states are:

| Status | Description |
|---|---|
| Pending | Transfer instruction has been created |
| Processing | Transfer eligibility and financial conditions are being evaluated |
| Completed | Transfer completed and both balances were updated |
| Rejected | Processing failed a business rule without changing balances |

Completed and Rejected are terminal states.

Processing may be a temporary state within the MongoDB transaction and does not need to be externally visible before the terminal outcome commits.

### 9.3 Processing Business Rules

The backend validates transaction eligibility and current financial conditions at processing time.

Rules include:

- The transaction must be eligible and non-legacy.
- The transaction must currently be Pending.
- Both accounts must exist.
- Both accounts must be Active.
- Account currencies must be compatible.
- The source account must have sufficient funds.
- The destination balance must remain within the supported integer range.
- The transfer must not execute more than once.

A successful transfer debits the source account and credits the destination account by exactly the same amount.

The combined balance of both accounts must remain unchanged.

### 9.4 Atomic Processing

The backend performs financial processing using MongoDB multi-document transactions.

The processing service:

1. Starts a MongoDB client session and transaction.
2. Validates the current transaction state.
3. Retrieves and validates the participating accounts.
4. Checks the current source balance.
5. Calculates the resulting balances.
6. Conditionally updates the source and destination balances.
7. Records the final transaction status and processing timestamp.
8. Commits the transaction.

The participating financial updates use the same database session.

A business-rule rejection records the Rejected outcome without applying the transfer's balance changes.

An unexpected database failure aborts the MongoDB transaction.

This prevents a partially completed transfer from being committed.

### 9.5 Rejection Codes

Supported rejection codes include:

| Code | Meaning |
|---|---|
| `INSUFFICIENT_FUNDS` | Source account has insufficient funds |
| `SOURCE_ACCOUNT_INACTIVE` | Source account is not Active |
| `DESTINATION_ACCOUNT_INACTIVE` | Destination account is not Active |
| `CURRENCY_MISMATCH` | Account currencies are incompatible |
| `ACCOUNT_NOT_FOUND` | A participating account no longer exists |
| `BUSINESS_RULE_VIOLATION` | Another documented processing restriction failed |

Rejected transactions preserve the rejection code and reason.

They cannot be processed again.

### 9.6 Idempotency and Concurrency

Transaction initiation requires the `Idempotency-Key` HTTP header.

A repeated request with the same key and matching normalized request returns the existing transaction.

Reusing the same key with a different request produces HTTP 409.

Idempotency information is stored in MongoDB so protection remains effective after application restarts.

Processing uses conditional status transitions and concurrency-safe balance updates to prevent duplicate execution and lost balance updates.

## 10. REST API

All application endpoints use the `/api/v1` prefix.

### 10.1 Existing API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Check application and database health |
| GET | `/dashboard/summary` | Retrieve operations dashboard statistics |
| GET | `/clients` | List and filter clients |
| GET | `/clients/options` | Retrieve client form options |
| GET | `/clients/:id` | Retrieve client details |
| GET | `/clients/:id/accounts` | Retrieve client accounts |
| POST | `/clients` | Register a client |
| PUT | `/clients/:id` | Update client information |
| PATCH | `/clients/:id` | Update client information |
| GET | `/accounts` | List and filter accounts |
| GET | `/accounts/options` | Retrieve account form options |
| GET | `/accounts/:id` | Retrieve account details |
| POST | `/accounts` | Register an account |
| GET | `/transactions` | List and filter transactions |
| GET | `/transactions/:id` | Retrieve transaction details |

All directory data is retrieved from MongoDB.

Filtering, sorting, and pagination are performed within database queries rather than loading entire collections into application memory.

### 10.2 New Assignment 2 Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/transactions` | Initiate a financial transfer |
| POST | `/transactions/:id/process` | Process an eligible Pending transfer |

### 10.3 Initiate a Transaction

**Endpoint:**

```http
POST /api/v1/transactions
```

**Required header:**

```http
Idempotency-Key: transfer-example-001
Content-Type: application/json
```

**Example request:**

```json
{
  "sourceAccountId": "d82d86a1-ccf7-4a34-81d2-60c93a11d0f7",
  "destinationAccountId": "f7bb29ce-9e48-447e-940b-184c31f5068a",
  "amountMinor": 250000,
  "currency": "CAD",
  "description": "Supplier payment"
}
```

The example account IDs must correspond to valid accounts in the database.

Successful new initiation returns HTTP 201 and a Location header.

The transaction is initially Pending.

### 10.4 Process a Transaction

**Endpoint:**

```http
POST /api/v1/transactions/:id/process
```

The request does not require a business request body.

Possible results include:

| Result | HTTP Status | Transaction Status |
|---|---|---|
| Successful transfer | 200 | Completed |
| Business-rule rejection | 200 | Rejected |
| Terminal or protected legacy transaction | 409 | Unchanged |
| Missing transaction | 404 | Not applicable |

Successful processing returns the final transaction information.

### 10.5 Error Responses

API errors follow a consistent structure:

```json
{
  "error": {
    "code": "TRANSACTION_ALREADY_PROCESSED",
    "message": "The transaction is not eligible for processing.",
    "details": []
  }
}
```

Relevant HTTP status codes include:

| Status | Usage |
|---|---|
| 200 | Successful operation or business-rule processing outcome |
| 201 | Resource created |
| 400 | Invalid request |
| 404 | Resource not found |
| 409 | Uniqueness, idempotency, or lifecycle conflict |
| 500 | Unexpected server error |
| 503 | Required database service unavailable |

Database credentials, connection strings, and internal stack traces must not be exposed through API responses.

## 11. Frontend Features

### 11.1 Operations Dashboard

The dashboard displays:

- Total Clients.
- Total Accounts.
- Pending Transactions.
- Processing Transactions.
- Completed Transactions.
- Rejected Transactions.
- Completed CAD Volume.
- Completed USD Volume.
- Recent Processing Activity.

The dashboard also displays period-based indicators for new clients, new accounts, and completed transactions.

Dashboard statistics are calculated using MongoDB data.

Completed CAD and USD amounts are displayed separately rather than combined into one monetary value.

### 11.2 Client Management

Available functionality includes:

- Client Directory.
- Client Registration.
- Client Details.
- Client Editing.
- Client search, filtering, and pagination.
- Associated account information.

### 11.3 Account Management

Available functionality includes:

- Account Directory.
- Account Registration.
- Account Details.
- Account search, filtering, and pagination.
- Account status and balance information.
- Related transaction information.

Account balances reflect completed financial transfers.

### 11.4 Transaction Management

Available functionality includes:

- Transaction Directory.
- Transaction Creation.
- Transaction Details.
- Transaction search, filtering, and pagination.
- Transaction status information.
- Processing eligible Pending transactions.
- Completed transaction outcomes.
- Rejected transaction codes and reasons.

The Transaction Creation page validates account selection, currency compatibility, amount, and description.

The frontend generates an idempotency key and reuses it when retrying the same submission.

Successful creation navigates to the Transaction Details page.

Legacy and terminal transactions do not provide an active processing action.

Transaction editing and deletion are not part of the implemented financial transaction workflow.

### 11.5 Responsive Interface

The application includes responsive layouts for desktop, tablet, and mobile viewports.

Navigation, forms, tables, and detail pages adjust to different screen sizes.

## 12. Docker Deployment

### 12.1 Containers

The Docker Compose deployment includes:

| Service | Responsibility |
|---|---|
| `mongodb` | Persistent MongoDB database |
| `mongo-init` | MongoDB replica-set initialization |
| `migrate` | One-time historical JSON migration |
| `backend` | Express REST API |
| `frontend` | Next.js application |
| `nginx` | Reverse proxy and public entry point |

### 12.2 Frontend Container

The frontend Dockerfile uses a multi-stage build.

The build stage installs dependencies and builds the Next.js application.

The runtime stage serves the standalone Next.js production output.

NGINX runs as a separate container and routes requests to the frontend and backend.

### 12.3 Backend Container

The backend container installs production dependencies and starts the Express application.

The backend connects to MongoDB using the internal Docker network.

A health endpoint checks database availability.

### 12.4 MongoDB Replica Set

MongoDB runs as a single-node replica set.

The replica set supports MongoDB multi-document transactions required for atomic financial processing.

MongoDB is not exposed through a public host port by the default Compose configuration.

### 12.5 Persistence

MongoDB uses a named Docker volume.

Application records, financial balances, transaction results, idempotency information, and migration history remain stored after normal container restarts and recreation.

Historical JSON files are used for migration rather than runtime writes.

## 13. Testing and Verification

### 13.1 Dataset Validation

The dataset validation script is located at:

```text
backend/scripts/validate-data.js
```

Run it through Docker:

```bash
docker compose run --rm --no-deps backend npm run validate:data
```

This checks the original historical JSON dataset, including:

- Record structure.
- Required fields.
- Unique identifiers.
- Registration numbers.
- Supported statuses.
- Currency values.
- Monetary values.
- Client-account relationships.
- Transaction relationships.
- Dataset consistency.

The script validates the historical source data rather than newly created MongoDB records.

### 13.2 Migration Verification

Run:

```bash
docker compose run --rm --no-deps backend node scripts/verify-migration.js
```

This checks the migration record and compares historical source records with the migrated MongoDB documents.

### 13.3 Automated Backend Tests

Automated tests are located in:

```text
backend/tests/
```

The test files include:

- `migration.test.js`
- `repository.test.js`
- `transaction-processing.test.js`
- `integration.test.js`
- `concurrency.test.js`

Run the backend test suite:

```bash
docker compose run --rm --no-deps backend npm test
```

The tests cover database behavior, migration, financial transaction processing, integration behavior, and concurrency scenarios.

### 13.4 Postman API Tests

The Postman collection is located at:

```text
postman/postman.json
```

To run the collection:

1. Start the application through Docker Compose.
2. Open Postman.
3. Import `postman/postman.json`.
4. Confirm that `baseUrl` is `http://localhost:8080/api/v1`.
5. Run the collection folders in their intended order.

The collection includes tests for API behavior, validation, transaction initiation, processing outcomes, and relevant error responses.

The ordered acceptance suite creates test records and performs financial transfers, so it modifies the connected database.

Use a disposable development or testing database when running state-changing tests.

Some scenarios, including container restarts, database outages, and concurrent processing, require separate manual or automated verification outside the Postman collection.

### 13.5 Frontend Verification

Frontend verification should include:

- Navigation between application pages.
- Client registration and editing.
- Account registration.
- Search, filtering, and pagination.
- Transaction initiation.
- Form validation.
- Pending transaction processing.
- Completed transaction details.
- Rejected transaction details.
- Loading and error states.
- Responsive layouts.
- Handling unavailable backend services.

Screenshots of application pages are stored in:

```text
screenshots/
```

### 13.6 Persistence Verification

A persistence test can be performed by:

1. Starting the application.
2. Registering a client or initiating a new transaction.
3. Verifying that the record appears in the application.
4. Stopping the containers without deleting volumes.
5. Starting the application again.
6. Confirming that the record remains available.

For completed transfers, the account balances and transaction status should also remain unchanged after restart.

## 14. Technical Reflection

### 14.1 How does the layered Express.js architecture separate HTTP handling, business rules and persistent storage? What happens if business logic is placed directly inside route handlers?

The backend separates routes, controllers, services, and repositories. For example, `backend/src/routes/client.routes.js` declares client endpoints, `client.controller.js` translates requests and service results into HTTP responses, `client.service.js` validates client information and applies business rules, and `client.repository.js` accesses persisted records through MongoDB. Similarly, `account.service.js` checks whether the selected client exists and is Active before allowing account creation. Transaction processing follows the same architecture, with the processing service enforcing business rules and repositories performing database operations.

If validation and storage logic were placed directly inside route handlers, the route files would become longer, harder to test, and more tightly coupled to the database implementation. Shared rules could be duplicated between endpoints and become inconsistent. Keeping the layers separate makes it easier to locate bugs, reuse functionality, and modify the persistence mechanism without changing the entire application.

### 14.2 What problems can occur when multiple asynchronous operations attempt to update the same JSON file? How does the application prevent lost updates?

In Assignment 1, without coordination, two requests could read the same version of `clients.json`, each append a client, and then write their own version. The last write could overwrite the first, losing a registration. The shared `json.repository.js` used a `Map` of per-file promise queues through `withFileLock()`. The `updateJsonFile()` function waited for earlier operations on the same file, read the latest data, applied and validated the update, wrote to a temporary file, and renamed it over the original. Duplicate registration checks also occurred inside the queued operation so they used current data.

This approach prevented common overlapping read-modify-write problems within one server process, but it did not coordinate independent server processes or make changes across multiple files atomic.

In Assignment 2, the JSON repositories were replaced with MongoDB repositories. The application now relies on database operations, uniqueness constraints, conditional updates, and MongoDB transactions for consistency. Financial transfer processing uses a MongoDB session and transaction so updates to both accounts and the transaction outcome are coordinated. This provides stronger protection against lost updates and partially completed financial operations.

### 14.3 Why are financial amounts represented using integer minor units instead of floating-point values? How are amounts validated and formatted?

JavaScript floating-point arithmetic cannot represent every decimal amount exactly; for example, `0.1 + 0.2` does not equal exactly `0.3`. To avoid introducing these precision issues into stored balances, the project saves amounts in cents as integers, such as `12550` for CAD 125.50.

The backend validates monetary values as safe integers. Account balances must be non-negative, while initiated transfer amounts must be positive. The backend also checks that financial calculations remain within the supported integer range before updating account balances.

The frontend accepts monetary input with up to two decimal places and converts it into integer minor units before sending the request. Currency values are formatted for display using the appropriate currency formatting utilities. The stored financial amounts remain integer values even though users see decimal currency amounts.

This representation is especially important in Assignment 2 because completed financial transfers must debit and credit the exact same amount without introducing floating-point rounding errors.

### 14.4 How does React handle asynchronous requests, loading states, failed operations, form validation, and duplicate submissions?

Frontend API calls are organized under `frontend/src/services/`, while components manage UI state with React hooks. For example, the client registration form maintains form values, validation errors, loading state, and success feedback. It retrieves available form options from the backend so the frontend does not maintain a separate hardcoded list.

The components validate required values, email formatting, lengths, and selected options before sending requests. During submission, loading states show progress and disable submit buttons to prevent normal repeated clicks. Asynchronous requests use `try/catch/finally`: successful operations show feedback or navigate to the resulting record, failures display error messages, and the final step resets the loading state. Backend validation still provides the final protection, even when frontend validation passes.

Assignment 2 extends this behavior to transaction initiation and processing. The Transaction Creation page validates the selected accounts, currency compatibility, transfer amount, and description. It also generates an idempotency key for each new transaction submission and reuses that key when retrying the same submission. The backend stores idempotency information in MongoDB to prevent duplicate transactions even if a request is repeated or the backend restarts.

Maintaining consistency between frontend validation, backend rules, and transaction processing outcomes remains an important implementation concern.

### 14.5 How would the architecture support transaction processing and approval workflows in Assignment 2?

Assignment 2 extends the existing layered architecture by implementing transaction creation and financial processing. The application now includes transaction initiation and processing endpoints, a Transaction Creation page, and processing controls in the Transaction Details page.

The transaction service validates source and destination accounts, account currencies, monetary amounts, and idempotency information. Newly created transactions are stored with Pending status. The processing service then validates account availability, sufficient funds, allowed status transitions, and financial conditions before completing or rejecting the transfer.

The JSON-based storage from Assignment 1 was replaced with MongoDB because the original per-file locking approach could not guarantee atomic changes across account balances and transaction records. MongoDB multi-document transactions now coordinate financial updates within the same database session. The processing logic also uses conditional updates to protect against duplicate execution and concurrent changes.

The implemented workflow distinguishes between initiating a transaction and executing it. Processing may temporarily move the transaction to Processing before reaching Completed or Rejected. Completed transactions update both balances, while Rejected transactions preserve the balances and record the rejection reason.

A separate approval workflow with authentication, authorization, approver roles, and approval history is not part of the current implementation. Such functionality could be introduced later through additional routes, services, repositories, and frontend pages while maintaining the existing layered architecture.

## 15. ChatGPT Use Acknowledgement

ChatGPT was used as a development assistance tool for the following tasks:

| Use Case | Description |
|---|---|
| UI styling | CSS styling |
| Postman | Generated `postman/postman.json` |
| Dataset validation | Generated `backend/scripts/*` |
| File organization | Assisted with organizing project files and directories |
| README generation | Generated README documentation |
| Technical Reflection editing | Used only to correct grammar and vocabulary in the Technical Reflection section; the answers describe the project's implementation and development decisions |