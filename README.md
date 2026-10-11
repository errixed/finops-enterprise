# FinOps Enterprise — Corporate Financial Operations Portal

FinOps Enterprise is a web application for managing corporate clients and financial accounts and viewing financial transactions. It uses **Next.js 16, React, TypeScript** for the frontend and **Node.js, Express 5 (ES modules)** for the backend. Data persists in JSON files. This Assignment 1 implementation establishes the structure for transaction processing and approval workflows in Assignment 2.

## 1. Project Overview
FinOps Enterprise is the Assignment 1 corporate operations portal. Its current scope includes client management, financial account management, and read-only transactions.

## 2. Business Scenario
A financial institution needs one portal to register corporate clients, maintain their details, create and inspect financial accounts, and review financial activity. FinOps Enterprise provides a dashboard, searchable client and account directories, client registration and editing, account registration, and read-only transaction views. Business rules reject duplicate corporate registration numbers and prevent account registration for non-active clients. Transactions are demonstration records in Assignment 1; the application does not yet provide APIs to create, approve, or settle them.

## 3. Technologies
| Component | Implementation |
|---|---|
| Frontend | Next.js 16.4.0, React 19, TypeScript, CSS |
| Backend | Node.js, Express.js 5.2.1, ES6 modules |
| Persistence | JSON files, Node.js file-system APIs |
| Verification | Postman, Node.js data-validation script, manual browser testing |
| Package management / version control | npm / Git and GitHub |
| Icons | Google Material Symbols Rounded |

## 4. Application Architecture
Request flow: **Next.js page/component → frontend API service → Express route → controller → business service → repository → JSON file**. A response travels back through the layers. The frontend uses `frontend/src/app/` for pages, `frontend/src/components/` for reusable UI, `frontend/src/services/` for requests, and `frontend/config.ts` for route and backend URL definitions. The backend uses `backend/src/routes/` to map URLs, `controllers/` for HTTP request/response handling, `services/` for validation and business rules, and `repositories/` for data access. Middleware in `backend/src/middleware/` supports request logging, not-found handling, and centralized errors; `backend/src/app.js` configures the Express application.

## 5. Project Structure
```text
finops-enterprise/
├── backend/
│   ├── config.js
│   ├── data/                  # clients.json, accounts.json, transactions.json
│   ├── scripts/validate-data.js
│   ├── src/
│   │   ├── config/environment.js
│   │   ├── controllers/       # client, account, transaction, dashboard
│   │   ├── middleware/        # request logger, not found, error handler
│   │   ├── repositories/      # JSON, entity, client, account, transaction
│   │   ├── routes/            # API endpoint definitions
│   │   ├── services/          # business logic and validation
│   │   ├── utils/             # money and pagination
│   │   ├── app.js
│   │   └── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/              # dashboard, clients, accounts, transactions
│   │   ├── components/       # layout, forms, dashboard
│   │   └── services/         # frontend API functions
│   ├── config.ts
│   └── package.json
├── postman/
│   ├── postman_collection.json
│   └── postman_test_run.json
├── screenshots/
├── scripts/start.js
├── package.json
├── .gitignore
└── README.md
```
The tree shows the important source files and directories; dependencies and generated files are omitted.

## 6. Installation and Startup
**Requirements:** Node.js **20.9 or newer**, npm, Git, and a modern browser. Postman is needed to rerun the API collection.

```bash
# Clone the repository and enter its root directory
git clone REPOSITORY_URL
cd finops-enterprise

# Install dependencies, build frontend, and start both servers
npm start
```
The root `package.json` runs a `prestart` script that installs backend/frontend dependencies and builds the frontend, followed by `scripts/start.js`, which starts both servers. Open **http://localhost:3001** for the UI or **http://localhost:3000/api/v1/health** for the backend health check. Use **Ctrl+C** to stop both servers. To run the applications separately:

```bash
# Terminal 1, from project root
cd backend && npm install && npm start

# Terminal 2, from project root
cd frontend && npm install && npm run build && npm start
```

## 7. Configuration Requirements
| Variable | Default | Defined in |
|---|---|---|
| `PORT` | `3000` | `backend/config.js` |
| `FRONTEND_ORIGIN` | `http://localhost:3001` | `backend/config.js` |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:3000` | `frontend/config.ts` |

**No `.env` file is required for the default local setup.** The backend can read environment variables using `dotenv`; Next.js can read local environment configuration. Actual `.env` files are ignored by Git. If changing ports, keep the frontend API URL and backend CORS origin consistent. Rebuild the frontend after changing `NEXT_PUBLIC_` values for production.

## 8. REST API Catalogue
All routes are prefixed with `/api/v1`; **13 endpoints** are implemented.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Backend health check |
| GET | `/dashboard/summary` | Dashboard figures |
| GET | `/clients` | List, search, filter, and paginate clients |
| GET | `/clients/options` | Client form options |
| GET | `/clients/:id` | Client details and associated accounts |
| POST | `/clients` | Register client |
| PATCH | `/clients/:id` | Update client |
| GET | `/accounts` | List and filter accounts |
| GET | `/accounts/options` | Account form options |
| GET | `/accounts/:id` | Account details and related transactions |
| POST | `/accounts` | Register account |
| GET | `/transactions` | List, search, filter, and paginate transactions |
| GET | `/transactions/:id` | Transaction details |

Client list filters include `search`, `status`, `industry`, `page`, and `pageSize`. Account filters include `clientId`, `accountType`, `currency`, and `status`. Transaction filters include `search`, `sourceAccountId`, `status`, `dateFrom`, `dateTo`, `page`, and `pageSize`. Paginated responses return a `data` array and `pagination` metadata. Relevant HTTP statuses are **200** (success), **201** (created), **400** (invalid input), **404** (missing resource), **409** (duplicate or business-rule conflict), and **500** (server/storage error).

## 9. Data Model
| File | Important fields | Relationship / rules |
|---|---|---|
| `backend/data/clients.json` | `clientId`, `companyName`, `registrationNumber`, `industry`, `country`, `contactEmail`, `contactPhone`, `status`, `createdAt`, `updatedAt` | Unique client ID and registration number; statuses Active, Inactive, Suspended |
| `backend/data/accounts.json` | `accountId`, `clientId`, `accountNumber`, `accountType`, `currency`, `balanceMinor`, `status`, `createdAt` | Account belongs to an existing client; account registration requires Active client; account numbers unique |
| `backend/data/transactions.json` | `transactionId`, `referenceNumber`, `sourceAccountId`, `destinationAccountId`, `amountMinor`, `currency`, `transactionType`, `status`, `description`, `createdAt` | Both accounts must exist and differ; currencies must match; amount is a positive safe integer |

One client can have multiple accounts; each account belongs to one client. Every transaction references a source and destination account. Amounts are stored as **integer minor units** (for example, CAD 125.50 is stored as `12550`).

## 10. Demonstration Dataset
The original demonstration data contains **10 clients, 20 accounts, and 50 transactions** (80 records total), including nine industries, CAD/USD accounts, active/inactive/suspended clients, and active/frozen/closed accounts. Transaction statuses initially include **8 Pending, 38 Completed, and 4 Rejected** records. Counts may change when new clients or accounts are registered.

## 11. Repository Layer and Restart Persistence
`backend/src/repositories/json.repository.js` is the shared file-storage implementation. `readJsonFile()` reads and parses the allowed JSON files and checks that each contains an array. `updateJsonFile()` reads the latest data, applies an updater to a structured clone, validates the result, writes a uniquely named temporary file, and renames it over the original. `client.repository.js`, `account.repository.js`, and `transaction.repository.js` provide entity-specific access to this shared storage layer.

A per-file promise queue in `withFileLock()` serializes operations on the same file **inside one Node.js backend process**, reducing lost updates. Duplicate registration checking is performed during the queued update. This is not a cross-process lock or a multi-file database transaction. Changes are written to disk rather than kept only in React or Node.js memory; restarting the server reads the persisted JSON data again. Persistent JSON files must therefore remain available and writable for the application to keep data across restarts.

## 12. Repeatable Dataset Validation
From the **root directory**, run:

```bash
npm run validate:data
# Equivalent direct command:
node backend/scripts/validate-data.js
```
`backend/scripts/validate-data.js` checks array structure, minimum dataset counts, required fields and types, unique IDs and registration numbers, supported statuses and currencies, valid integer monetary amounts, timestamps, client/account references, transaction relationships, currency consistency, and required demonstration-data variety. It reports a pass summary or exits with an error if a rule fails. The original dataset was verified using this command; repeat it after modifying data or testing API operations.

## 13. Testing Instructions
### 13.1 Postman API Tests
The project includes **`postman/postman_collection.json`** and the successful execution results in **`postman/postman_test_run.json`**. To rerun: start the backend, import `postman_collection.json` into Postman, set the collection's configurable `baseUrl` to `http://localhost:3000`, and run the collection. It covers all 13 endpoints with successful requests, invalid input, nonexistent resources, duplicate registration numbers, and business-rule conflicts. A test expecting 400, 404, or 409 is successful when the backend correctly rejects that request. The supplied test run completed successfully. Some tests create or modify stored data; use a clean copy of the JSON dataset when reproducible starting records are important.

### 13.2 Frontend Verification
Verify dashboard and directory navigation, client/account details, client creation and editing, account creation, form validation messages, loading indicators, empty search/filter results, success messages, failed API requests, and duplicate-submit prevention. Check at **1440×900** (desktop), **1280×800** (smaller desktop), **1024×768** (tablet landscape), and **768×1024** (tablet portrait). Browser developer tools can simulate viewports and network throttling. Test error handling by temporarily stopping the backend and loading a data-dependent page; restart it afterward. Record actual Pass/Fail results and screenshots for manually executed scenarios; no overall frontend pass result is asserted here.

### 13.3 Persistence Verification
Start the application, register a client, confirm it appears in the directory, stop and restart the application, and confirm the record remains. Repeat with an account if needed. Run `npm run validate:data` afterward to confirm dataset consistency. A complete repeatable review sequence is: **validate data → `npm start` → check health/UI → run Postman → perform frontend/viewport checks → restart and verify persistence → validate data again**.

## 14. Technical Reflection
### 14.1 How does the layered Express.js architecture separate HTTP handling, business rules and persistent storage? What happens if business logic is placed directly inside route handlers?
The backend separates routes, controllers, services, and repositories. For example, `backend/src/routes/client.routes.js` declares client endpoints, `client.controller.js` translates requests and service results into HTTP responses, `client.service.js` validates client information and applies business rules, and `client.repository.js` accesses persisted records using the shared JSON repository. Similarly, `account.service.js` checks whether the selected client exists and is Active before allowing account creation. If validation and storage logic were placed directly inside route handlers, the route files would become longer, harder to test, and more tightly coupled to the JSON file format. Shared rules could be duplicated between endpoints and become inconsistent. Keeping the layers separate makes it easier to locate bugs, reuse functionality, and change the storage mechanism later.

### 14.2 What problems can occur when multiple asynchronous operations attempt to update the same JSON file? How does the application prevent lost updates?
Without coordination, two requests could read the same version of `clients.json`, each append a client, and then write their own version. The last write could overwrite the first, losing a registration. The shared `json.repository.js` uses a `Map` of per-file promise queues through `withFileLock()`. `updateJsonFile()` waits for earlier operations on that file, reads the latest data, applies and validates the update, writes to a temporary file, and renames it over the original. Duplicate registration checks also occur inside the queued operation so they use current data. This prevents common overlapping read-modify-write problems within one server process, but it does not coordinate independent server processes or make changes across multiple files atomic.

### 14.3 Why are financial amounts represented using integer minor units instead of floating-point values? How are amounts validated and formatted?
JavaScript floating-point arithmetic cannot represent every decimal amount exactly; for example, `0.1 + 0.2` does not equal exactly `0.3`. To avoid introducing these precision issues into stored balances, the project saves amounts in cents as integers, such as `12550` for CAD 125.50. The backend's `backend/src/utils/money.js` uses `validateMinorUnits()` to require a non-negative safe integer for account balances and `formatMoney()` to produce currency-formatted output using `Intl.NumberFormat`. Transaction validation in `transaction.service.js` requires a positive safe integer. On the frontend, `parseMoney()` in `frontend/src/services/accounts.ts` accepts decimal input with up to two places, converts it with `BigInt`, and rejects values outside the safe integer range. The persisted amount remains an integer even though it is displayed in dollars.

### 14.4 How does React handle asynchronous requests, loading states, failed operations, form validation, and duplicate submissions?
Frontend API calls are organized under `frontend/src/services/`, while components manage UI state with React hooks. For example, `frontend/src/components/forms/ClientForm.tsx` maintains form values, validation errors, loading state, and success feedback. It retrieves available form options from the backend so the frontend does not keep a separate hardcoded list. The component validates required values, email formatting, lengths, and selected options before sending a request. During submission, the `saving` state shows progress and disables the submit button to prevent normal repeated clicks. Asynchronous requests use `try/catch/finally`: successful operations show feedback or navigate to the resulting record, failures display messages, and the final step resets the loading state. Backend validation still provides the final protection, even when frontend validation has passed. Maintaining consistency between the frontend options and backend rules was an important implementation concern.

### 14.5 How would the architecture support transaction processing and approval workflows in Assignment 2?
The existing transaction routes, controller, service, repository, detail pages, account services, and validation utilities provide a starting point, but Assignment 1 only supports reading stored transactions. Assignment 2 could add transaction creation, approval, rejection, and processing endpoints, along with frontend submission and approval screens. The service layer would enforce account availability, allowed status transitions, sufficient funds, currency compatibility, and approval permissions. Additional modules would be needed for authentication/authorization, approver roles, audit history, workflow decisions, and tests for concurrent transactions. Actual balance transfers also require coordinated updates to accounts and transactions. The current JSON repository only serializes operations per file and cannot guarantee atomic multi-file financial updates. For reliable processing, I would move persistence to a database with transactions while keeping the route/controller/service separation and adapting the repository layer.

## 15. ChatGPT Use Acknowledgement
ChatGPT was used as a development assistance tool for the following tasks:

| Use case | Files / details |
|---|---|
| UI styling | Generated CSS styling |
| Postman testing | Generated `postman/postman_collection.json` |
| Dataset validation | Generated `backend/scripts/validate-data.js` |
| Transaction validation | Generated valid-state and transaction validation logic in `backend/src/services/transaction.service.js` |
| Startup automation | Generated `scripts/start.js` to start the frontend and backend using one command |
| Demonstration data | Generated the original 10 records in `backend/data/clients.json`, 20 in `backend/data/accounts.json`, and 50 in `backend/data/transactions.json` |
| Git configuration | Generated `.gitignore` |
| File organization | Helped maintain consistent directories and separation of responsibilities |
| Code structure review | Helped check imports, exports, module organization, and correct usage of `backend/config.js` and `frontend/config.ts` |
| README generation | Generated `README.md` **excluding Section 14 (Technical Reflection)** |
| Technical Reflection editing | Used only to correct grammar and vocabulary in the Technical Reflection section; the answers describe the project's implementation and development decisions |