# FinOps Enterprise – Corporate Financial Operations Portal

## 1. Project Overview

FinOps Enterprise is a web-based corporate financial operations application developed using Next.js, React, TypeScript, Node.js, and Express.js.

The application provides a centralized platform for managing corporate clients, financial accounts, and viewing financial transactions. It is designed to simulate a financial operations environment where client and account information must be organized, validated, and stored reliably.

The application uses a layered backend architecture to separate HTTP request handling, business logic, and data storage. JSON files are used for persistent storage instead of a traditional database.

This project represents Assignment 1 and establishes the foundation for additional financial operations functionality in Assignment 2.

## 2. Business Scenario

A financial institution manages multiple corporate clients, each of which may have one or more financial accounts. These accounts can have different types, currencies, balances, and operational statuses.

The institution also needs to monitor transactions associated with these accounts and maintain accurate information about its corporate clients.

FinOps Enterprise addresses these requirements by providing the following functionality:

- Operations Dashboard: Displays financial operation metrics and recent transactions.
- Client Directory: Allows users to search, filter, and view registered corporate clients.
- Client Registration: Allows users to register new corporate clients.
- Client Details and Editing: Allows users to view and update corporate client information.
- Financial Account Directory: Displays registered financial accounts and their associated corporate clients.
- Account Registration: Allows users to create financial accounts for active corporate clients.
- Account Details: Displays account information and related transactions.
- Transaction Directory: Allows users to view, search, and filter existing transactions.
- Transaction Details: Displays detailed information about individual transactions.

The application also implements validation rules to prevent invalid records, duplicate client registration numbers, and account registrations for clients who are not active.

For Assignment 1, transactions are part of the demonstration dataset and are read-only. Transaction creation, processing, and approval functionality are not implemented in this version.

## 3. Technologies Used

| Component | Technology |
|---|---|
| Frontend | Next.js 16.4.0 |
| UI Library | React 19.3.0 |
| Programming Language | TypeScript and JavaScript |
| Backend | Node.js and Express.js 5.2.1 |
| Module System | ES6 Modules |
| Data Storage | JSON files |
| Frontend Styling | CSS |
| API Testing | Postman |
| Dataset Validation | Node.js |
| Package Manager | npm |
| Version Control | Git and GitHub |

## 4. Application Architecture

FinOps Enterprise follows a client-server architecture.

The frontend is a Next.js application responsible for displaying information, accepting user input, navigating between pages, and communicating with the backend.

The backend is an Express.js application organized into separate architectural layers.

The request processing sequence is:

**Frontend → Express Route → Controller → Business Service → Repository → JSON File**

The response is returned through the same layers to the frontend.

### 4.1 Frontend

The frontend uses the Next.js App Router to organize application pages.

The `frontend/src/app/` directory contains the application pages, while `frontend/src/components/` contains reusable UI components.

The `frontend/src/services/` directory handles API communication. These services use the backend base URL and API routes defined in `frontend/config.ts`.

The frontend uses React state and effects to manage input values, asynchronous requests, loading indicators, errors, and user feedback.

### 4.2 Express Routes

The route layer defines the API endpoints and associates each endpoint with its corresponding controller.

Route files are located in `backend/src/routes/`.

For example, `client.routes.js` defines the endpoints for retrieving, creating, and updating corporate clients.

Routes are responsible for routing requests and should not contain the application's business rules.

### 4.3 Controllers

Controllers receive HTTP requests, extract the required parameters or request bodies, call business services, and return HTTP responses.

They also forward errors to the centralized error-handling middleware.

For example, `client.controller.js` calls `createClient()` from the client service when a client registration request is received.

### 4.4 Business Services

Services implement the application's business rules and validation requirements.

They are located in `backend/src/services/`.

For example, `account.service.js` verifies that a corporate client exists and that its status is `Active` before allowing a new financial account to be created.

The service layer also validates supported account types, currencies, and monetary amounts.

### 4.5 Repository Layer

The repository layer is responsible for retrieving and modifying persistent data.

It is located in `backend/src/repositories/`.

The application includes repositories for clients, accounts, and transactions, along with shared JSON storage utilities.

Repositories allow the service layer to access data without directly handling file-system operations.

This separation also allows the storage implementation to be replaced in the future without requiring major changes to the application's routes and controllers.

### 4.6 Middleware

The backend uses middleware for:

- JSON request body parsing
- Cross-origin resource sharing (CORS)
- Request logging
- Unrecognized routes
- Centralized error handling

The middleware is registered in `backend/src/app.js`.

## 5. Project Structure

The main project structure is shown below. Dependency directories, Git metadata, and generated build files are excluded for readability.

```text
finops-enterprise/
├── backend/
│   ├── config.js
│   ├── data/
│   │   ├── clients.json
│   │   ├── accounts.json
│   │   └── transactions.json
│   ├── scripts/
│   │   └── validate-data.js
│   ├── src/
│   │   ├── config/
│   │   │   └── environment.js
│   │   ├── controllers/
│   │   │   ├── client.controller.js
│   │   │   ├── account.controller.js
│   │   │   ├── transaction.controller.js
│   │   │   └── dashboard.controller.js
│   │   ├── middleware/
│   │   │   ├── error.middleware.js
│   │   │   ├── not-found.middleware.js
│   │   │   └── request-logger.middleware.js
│   │   ├── repositories/
│   │   │   ├── json.repository.js
│   │   │   ├── entity.repository.js
│   │   │   ├── client.repository.js
│   │   │   ├── account.repository.js
│   │   │   └── transaction.repository.js
│   │   ├── routes/
│   │   │   ├── index.js
│   │   │   ├── client.routes.js
│   │   │   ├── account.routes.js
│   │   │   ├── transaction.routes.js
│   │   │   └── dashboard.routes.js
│   │   ├── services/
│   │   │   ├── client.service.js
│   │   │   ├── account.service.js
│   │   │   ├── transaction.service.js
│   │   │   └── dashboard.service.js
│   │   ├── utils/
│   │   │   ├── money.js
│   │   │   └── pagination.js
│   │   ├── app.js
│   │   └── server.js
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx
│   │   │   ├── clients/
│   │   │   ├── accounts/
│   │   │   ├── transactions/
│   │   │   ├── layout.tsx
│   │   │   ├── not-found.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   ├── forms/
│   │   │   └── layout/
│   │   └── services/
│   │       ├── clients.ts
│   │       ├── accounts.ts
│   │       ├── transactions.ts
│   │       └── dashboard.ts
│   ├── config.ts
│   ├── package.json
│   └── package-lock.json
├── scripts/
│   └── start.js
├── postman/
│   ├── FinOps_Enterprise_API_Testing.postman_collection.json
│   └── test-results.json
├── .gitignore
├── package.json
└── README.md
```

The `postman/` folder contains the API testing collection and exported test results when these files are added to the repository.

## 6. Installation and Startup Instructions

### 6.1 Requirements

The following software is required:

- Node.js compatible with Next.js 16, version 20.9 or newer
- npm
- Git
- A modern web browser
- Postman for API testing

### 6.2 Clone the Repository

Clone the GitHub repository:

```bash
git clone YOUR_REPOSITORY_URL
```

Navigate to the project directory:

```bash
cd finops-enterprise
```

Replace `YOUR_REPOSITORY_URL` with the actual GitHub repository URL.

### 6.3 Start the Application

From the root directory, execute:

```bash
npm start
```

The root `package.json` automatically performs the following operations through its `prestart` script:

1. Installs backend dependencies.
2. Installs frontend dependencies.
3. Builds the Next.js frontend.
4. Executes `scripts/start.js` to start the backend and frontend.

The applications run on the following addresses:

| Application | Address |
|---|---|
| Frontend | http://localhost:3001 |
| Backend | http://localhost:3000 |
| Backend Health Endpoint | http://localhost:3000/api/v1/health |

The startup script uses Node.js child processes to run both applications through one command.

To stop the applications, press `Ctrl + C` in the terminal.

### 6.4 Start Applications Separately

The applications can also be started separately.

Backend:

```bash
cd backend
npm install
npm start
```

Frontend, in another terminal:

```bash
cd frontend
npm install
npm run build
npm start
```

For frontend development, `npm run dev` can be used instead of building and starting the production server.

## 7. Configuration Requirements

The application provides default configuration values and does not require an `.env` file for local execution when the default ports are available.

### 7.1 Backend Configuration

Backend configuration is defined in `backend/config.js` and accessed through `backend/src/config/environment.js`.

| Environment Variable | Default Value | Description |
|---|---|---|
| PORT | 3000 | Express backend port |
| FRONTEND_ORIGIN | http://localhost:3001 | Allowed frontend origin for CORS |

### 7.2 Frontend Configuration

Frontend configuration is defined in `frontend/config.ts`.

| Environment Variable | Default Value | Description |
|---|---|---|
| NEXT_PUBLIC_API_BASE_URL | http://localhost:3000 | Backend base URL |

Environment variables may be used when different ports or deployment addresses are required.

Actual `.env` files are excluded from Git using `.gitignore`.

Because the default values are already defined in the source code, the application can be started locally without creating environment files.

If configuration values are changed, the backend port, frontend API URL, and allowed frontend origin must remain consistent. The frontend should also be rebuilt when changing its public environment variables for a production build.

## 8. REST API Catalogue

All backend API endpoints use the `/api/v1` prefix.

The backend exposes 13 endpoints.

### 8.1 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/v1/health | Check backend availability |
| GET | /api/v1/dashboard/summary | Retrieve dashboard statistics |
| GET | /api/v1/clients | Retrieve clients with filtering and pagination |
| GET | /api/v1/clients/options | Retrieve client form options |
| GET | /api/v1/clients/:id | Retrieve an individual client and its accounts |
| POST | /api/v1/clients | Register a corporate client |
| PATCH | /api/v1/clients/:id | Update corporate client information |
| GET | /api/v1/accounts | Retrieve financial accounts |
| GET | /api/v1/accounts/options | Retrieve supported account options |
| GET | /api/v1/accounts/:id | Retrieve account details and related transactions |
| POST | /api/v1/accounts | Register a financial account |
| GET | /api/v1/transactions | Retrieve transactions with filtering and pagination |
| GET | /api/v1/transactions/:id | Retrieve individual transaction details |

### 8.2 Supported Query Parameters

The client directory supports:

- `search`
- `status`
- `industry`
- `page`
- `pageSize`

The financial account directory supports:

- `clientId`
- `accountType`
- `currency`
- `status`

The transaction directory supports:

- `search`
- `sourceAccountId`
- `status`
- `dateFrom`
- `dateTo`
- `page`
- `pageSize`

Pagination responses contain a `data` array and a `pagination` object.

### 8.3 HTTP Response Codes

The application uses the following HTTP response codes:

| Status Code | Meaning |
|---|---|
| 200 | Request completed successfully |
| 201 | Resource created successfully |
| 400 | Invalid request or unsupported input |
| 404 | Requested resource does not exist |
| 409 | Duplicate record or business-rule conflict |
| 500 | Internal server or storage error |

For example, attempting to register a client with an existing registration number returns HTTP 409.

Attempting to register a financial account for an inactive or suspended client also returns HTTP 409.

Requests for nonexistent clients, accounts, or transactions return HTTP 404.

## 9. Data Model

The application uses three JSON files for persistent storage.

Each file contains an array of records.

### 9.1 Corporate Clients

Stored in `backend/data/clients.json`.

| Field | Description |
|---|---|
| clientId | Unique client identifier (UUID) |
| companyName | Corporate client name |
| registrationNumber | Unique corporate registration number |
| industry | Industry category |
| country | Country of registration |
| contactEmail | Contact email address |
| contactPhone | Optional contact phone number |
| status | Active, Inactive, or Suspended |
| createdAt | Record creation timestamp |
| updatedAt | Last modification timestamp |

Registration numbers are checked for uniqueness without case sensitivity and with surrounding whitespace removed during comparison.

Client identifiers, registration numbers, and original creation timestamps cannot be modified through the client update operation.

### 9.2 Financial Accounts

Stored in `backend/data/accounts.json`.

| Field | Description |
|---|---|
| accountId | Unique account identifier (UUID) |
| clientId | Identifier of the owning client |
| accountNumber | Unique account number |
| accountType | Operating, Savings, or Investment |
| currency | CAD or USD |
| balanceMinor | Account balance in integer minor units |
| status | Active, Frozen, or Closed |
| createdAt | Account creation timestamp |

Each account belongs to an existing corporate client.

The client must have an Active status when a new financial account is registered.

### 9.3 Transactions

Stored in `backend/data/transactions.json`.

| Field | Description |
|---|---|
| transactionId | Unique transaction identifier (UUID) |
| referenceNumber | Unique transaction reference |
| sourceAccountId | Source financial account |
| destinationAccountId | Destination financial account |
| amountMinor | Transaction amount in integer minor units |
| currency | Transaction currency |
| transactionType | Transfer |
| status | Pending, Completed, or Rejected |
| description | Transaction description |
| createdAt | Transaction creation timestamp |

Transactions reference two existing accounts.

A transaction cannot use the same account as its source and destination, and the transaction currency must match both accounts.

In Assignment 1, transactions are stored as demonstration records and are not created or updated through the API.

### 9.4 Data Relationships

The main relationships are:

- One corporate client can have multiple financial accounts.
- Each financial account belongs to one corporate client.
- A financial account can be associated with multiple transactions.
- Each transaction references one source account and one destination account.

These relationships are implemented using identifiers rather than duplicating complete client or account objects inside other records.

## 10. Demonstration Dataset

The application includes a demonstration dataset to represent a corporate financial environment.

The dataset contains:

| Dataset | Records |
|---|---:|
| Corporate Clients | 10 |
| Financial Accounts | 20 |
| Transactions | 50 |
| Total | 80 |

The dataset includes nine industries, accounts using CAD and USD, different account balances, and multiple account statuses.

### 10.1 Client Data

The dataset contains:

- 10 corporate clients
- 9 represented industries
- 2 clients with Inactive or Suspended status

These records allow testing of client filtering, validation, and account creation restrictions.

### 10.2 Account Data

The dataset contains:

- 20 financial accounts
- Operating, Savings, and Investment accounts
- CAD and USD accounts
- 2 Frozen or Closed accounts
- Clients with multiple accounts

These records support account filtering, client-account relationships, and financial summaries.

### 10.3 Transaction Data

The initial demonstration dataset contains:

| Transaction Status | Count |
|---|---:|
| Pending | 8 |
| Completed | 38 |
| Rejected | 4 |
| Total | 50 |

The transactions include both low-value and high-value transfers.

All demonstration transactions are checked for account references and currency consistency.

These counts describe the original dataset. Registering additional clients or accounts will increase the relevant counts in the JSON files.

## 11. Repository Layer and Data Persistence

The application uses JSON files as its persistent data storage.

The primary storage implementation is located in `backend/src/repositories/json.repository.js`.

This module contains functions for reading and updating JSON data.

### 11.1 Reading Data

The `readJsonFile()` function reads a supported JSON file, parses its contents, and checks that the stored data is an array.

If the file cannot be read or contains invalid JSON, the repository throws a storage error.

### 11.2 Updating Data

The `updateJsonFile()` function performs updates using the following sequence:

1. Waits for previous operations on the same file.
2. Reads the current JSON data.
3. Creates a structured clone of the existing data.
4. Applies the requested changes.
5. Validates the resulting data structure.
6. Writes the updated data to a temporary file.
7. Renames the temporary file to replace the original.

This approach reduces the risk of partially written JSON files.

### 11.3 Concurrent Updates

The repository uses a `Map` containing promise-based queues for individual JSON files.

The `withFileLock()` function ensures that operations on the same file are processed sequentially within the running Node.js application.

For example, if two client registration requests attempt to update `clients.json`, the second operation waits for the first operation to complete.

The duplicate registration number check is also performed inside the repository update operation, ensuring that it uses the latest data available to that process.

This prevents common lost-update problems caused by overlapping read-modify-write operations within one backend process.

The mechanism is not a distributed lock and does not coordinate multiple independent backend processes writing to the same files.

### 11.4 Persistence After Restart

The JSON files are stored on disk instead of being kept only in application memory.

When a new client or financial account is created, the repository writes the updated records to the corresponding JSON file.

The application reads these files again when handling future requests.

Therefore, successful changes remain available after the application is stopped and restarted, provided the same data directory is preserved.

This behavior allows the application to maintain persistent records without using a separate database server.

## 12. Dataset Validation

The project includes a repeatable dataset validation script.

Script location:

`backend/scripts/validate-data.js`

The script checks the structural validity and relationships of the JSON datasets.

### 12.1 Execute Validation

From the project root directory, run:

```bash
npm run validate:data
```

Alternatively, execute the script directly:

```bash
node backend/scripts/validate-data.js
```

### 12.2 Validation Checks

The script verifies:

- JSON files contain valid arrays.
- Minimum dataset counts are satisfied.
- Client, account, and transaction identifiers are unique.
- Corporate registration numbers are unique.
- Required fields have valid values and types.
- Client and account statuses are supported.
- Account balances and transaction amounts use valid integer minor units.
- Accounts reference existing clients.
- Transactions reference existing source and destination accounts.
- Transaction currencies match both referenced accounts.
- Source and destination accounts are different.
- Timestamp values are valid.
- The dataset contains the required variety of industries, currencies, account statuses, and transaction statuses.

### 12.3 Expected Result

For the original demonstration dataset, successful validation displays:

```text
Dataset validation passed.
Corporate clients: 10
Industries: 9
Inactive/Suspended clients: 2
Financial accounts: 20
Frozen/Closed accounts: 2
Transactions: 50
Pending transactions: 8
Completed transactions: 38
Rejected transactions: 4
Referential integrity: Passed
Unique identifiers: Passed
Currency consistency: Passed
```

If validation fails, the script displays a descriptive error and exits with a nonzero exit code.

The validation can be repeated after modifying the demonstration dataset or after performing API operations.

The script verifies the supported structural and relationship constraints. It does not serve as a replacement for a transactional database or a complete automated API test suite.

## 13. Testing Instructions

Testing is divided into backend API testing, dataset verification, and frontend verification.

### 13.1 API Testing with Postman

The Postman collection is located at:

`postman/FinOps_Enterprise_API_Testing.postman_collection.json`

To execute the tests:

1. Start the application using `npm start`.
2. Open Postman.
3. Import the collection JSON file.
4. Configure the collection's `baseUrl` variable as `http://localhost:3000`.
5. Run the collection using Postman's Collection Runner.
6. Review the assertions, HTTP response codes, and any failed requests.

The collection contains requests covering all 13 API endpoints.

Test scenarios include:

- Successful requests
- Invalid request bodies and parameters
- Nonexistent resources
- Duplicate client registration numbers
- Account registration business-rule conflicts
- Filtering and pagination

The expected response code for a negative test can be 400, 404, or 409. These tests pass when the API correctly rejects the invalid operation.

The results can be exported from Postman and saved as:

`postman/test-results.json`

Some tests create or modify records in the JSON datasets. Testing against a separate copy of the demonstration data is recommended when the original records must be preserved.

### 13.2 Frontend Verification

Frontend verification includes checking:

- Navigation between application pages
- Client and account form submissions
- Required field and input validation messages
- Loading indicators during asynchronous requests
- Empty states when no records match a search or filter
- Successful registration and update operations
- Error messages when the backend rejects requests
- Handling of nonexistent resources
- Prevention of duplicate form submissions

The application should be tested at both desktop and tablet viewport widths.

Recommended viewport sizes:

| Viewport | Dimensions |
|---|---|
| Desktop | 1440 × 900 |
| Small Desktop | 1280 × 800 |
| Tablet Landscape | 1024 × 768 |
| Tablet Portrait | 768 × 1024 |

Browser developer tools can be used to adjust viewport dimensions and simulate slower network conditions.

Frontend verification results should record each test's expected behavior, actual behavior, and Pass or Fail status. Screenshots may be included as supporting evidence.

### 13.3 Persistence Verification

To verify persistence:

1. Start the application.
2. Register a new corporate client through the frontend or API.
3. Confirm that the client appears in the Client Directory.
4. Stop the application.
5. Restart the application using `npm start`.
6. Open the Client Directory again.
7. Confirm that the newly registered client still exists.

The record should remain available because the repository stores changes in `backend/data/clients.json`.

The same procedure can be performed for a newly registered financial account.

### 13.4 Repeatable Verification Procedure

The following procedure can be used after cloning the repository:

1. Run `npm run validate:data` to verify dataset structure and relationships.
2. Run `npm start` to build and start both applications.
3. Visit `http://localhost:3000/api/v1/health` and verify the backend responds successfully.
4. Visit `http://localhost:3001` and verify the frontend loads.
5. Execute the Postman collection and inspect the test results.
6. Perform the frontend functional and responsive verification checks.
7. Repeat `npm run validate:data` after API operations to confirm that the stored data remains valid.

The verification results should be recorded rather than assumed to have passed.

## 14. Technical Reflection

### 14.1 How does the layered Express.js architecture separate HTTP handling, business rules, and persistent storage? What happens if business logic is placed directly inside route handlers?

The backend follows a layered architecture with routes, controllers, services, and repositories.

The route files, such as `backend/src/routes/client.routes.js`, define the endpoints and connect requests to the appropriate controllers.

Controllers, such as `client.controller.js`, handle HTTP requests and responses. They extract request parameters, call service functions, return the appropriate status codes, and forward errors to the middleware.

The service layer contains the business rules. For example, `account.service.js` checks whether a client exists and whether the client is Active before allowing an account to be registered.

The repository layer handles data access. For example, `client.repository.js` retrieves and updates client records through the shared JSON repository.

If business logic were implemented directly inside route handlers, the routes would become responsible for validation, data processing, file access, and HTTP responses simultaneously.

This would make the application more difficult to maintain and test. It would also increase code duplication when the same business rule is needed by multiple endpoints.

Separating these responsibilities makes the application more organized and allows individual layers to be changed without rewriting the entire backend.

One important implementation decision was keeping the repository responsible for persistent storage while allowing the service layer to handle business rules.

### 14.2 What problems can occur when multiple asynchronous operations update the same JSON file? How does the application prevent lost updates?

JSON files can experience lost updates when multiple asynchronous operations attempt to modify the same file simultaneously.

For example, two client registration requests might read the same version of `clients.json`. Each request adds a different client and writes the resulting array to disk.

If the operations are not coordinated, one write could overwrite the changes made by the other request.

To address this problem, I used the shared JSON repository in `backend/src/repositories/json.repository.js`.

The repository implements `withFileLock()`, which maintains a promise queue for each JSON file.

The `updateJsonFile()` function uses this queue to serialize read-modify-write operations on the same file.

It also writes the updated data to a temporary file before renaming that file to replace the original.

The combination of serialized updates and temporary-file replacement reduces the risk of lost updates and incomplete JSON writes.

Another important decision was placing the duplicate registration number check inside the repository's update operation. This prevents two overlapping client registration requests within the same process from both passing the uniqueness check using stale data.

The current approach works for a single backend process. If the application were deployed using multiple backend processes or servers, a database with transaction support or a shared locking mechanism would be necessary.

### 14.3 Why are financial amounts represented using integer minor units instead of JavaScript floating-point values? How does the application validate and format monetary amounts?

JavaScript uses floating-point numbers, which can produce precision problems when performing decimal calculations.

For example, adding `0.1` and `0.2` does not produce an exactly represented `0.3` in JavaScript floating-point arithmetic.

For financial applications, small precision errors can create inconsistencies in account balances and transactions.

To avoid these problems, the application stores monetary values using integer minor units.

For example, CAD 125.50 is stored as `12550`, representing cents.

The account service uses `validateMinorUnits()` from `backend/src/utils/money.js` to validate account balances.

This function verifies that the value is a non-negative safe integer.

Transaction validation also checks that transaction amounts are safe integers and greater than zero.

On the frontend, `parseMoney()` in `frontend/src/services/accounts.ts` validates the user's amount as a decimal string with no more than two decimal places. It uses `BigInt` arithmetic to convert the amount into minor units and checks that the result does not exceed JavaScript's safe integer range.

For displaying monetary values, the application uses `Intl.NumberFormat` with the appropriate currency, such as CAD or USD.

The stored amount is divided by 100 for formatting, while the original persisted value remains an integer.

This approach improves the reliability and consistency of financial amount handling.

### 14.4 How does the React application handle asynchronous requests, loading states, failed operations, and form validation? How are duplicate submissions prevented?

The frontend uses React state and asynchronous functions to manage API requests and user interactions.

API communication is separated into service files under `frontend/src/services/`.

For example, `clients.ts` contains the functions used to retrieve, register, and update corporate clients.

The `ClientForm.tsx` component uses `useState` to manage form values, loading states, validation errors, and success messages.

It also uses `useEffect` to load supported industries, countries, and statuses from the backend.

Before submitting the form, the `validate()` function verifies the required fields, input lengths, email format, and supported selections.

If validation fails, an error message is displayed and the request is not sent.

During submission, the component sets `saving` to true and changes the submit button text to `Saving...`.

The submit button is disabled while saving or loading form options, which prevents normal repeated button clicks during processing.

The `try/catch/finally` structure is used to handle the asynchronous request. Successful operations show success feedback and navigate to the relevant client details page. Failed requests display an error message, and the `finally` block resets the saving state.

A challenge in this implementation was keeping frontend validation consistent with the backend rules.

For this reason, supported client options are retrieved from the API rather than maintaining separate hardcoded lists inside the form.

The frontend provides immediate validation and user feedback, while the backend remains responsible for enforcing the business rules.

### 14.5 How would the architecture be extended to support transaction processing and approval workflows in Assignment 2?

The current application already contains the main architectural components required for financial transaction management.

It includes transaction repositories, services, controllers, routes, and frontend pages for reading transaction information.

However, transactions are currently read-only and are provided through the demonstration dataset.

For Assignment 2, I would extend the existing transaction modules to support transaction creation, processing, and approval workflows.

The existing `transaction.routes.js` file could be extended with new endpoints for creating transactions, submitting them for approval, approving or rejecting them, and retrieving their processing history.

The transaction controller would handle the HTTP requests, while `transaction.service.js` would implement the business rules.

These rules could include validating source and destination accounts, checking account statuses, verifying sufficient available funds, checking currency compatibility, and enforcing allowed transaction status changes.

The existing account and transaction repositories could be reused and extended to support balance updates and transaction status changes.

New components would also be necessary, including:

- Transaction registration and approval forms
- Approval and rejection endpoints
- Transaction status transition rules
- Approval history and audit records
- Authorization rules for users responsible for approving transactions
- Additional validation and automated tests

An important architectural improvement would be replacing JSON storage with a transactional database for actual financial processing.

Updating account balances and transaction records involves multiple related changes that must either succeed together or fail together.

The current per-file promise queues do not provide atomic updates across multiple JSON files.

A database transaction would prevent situations where an account balance changes but the corresponding transaction record is not updated successfully.

The existing layered architecture would make this transition easier because the controllers and business services are separated from the storage implementation.

The overall architecture could remain similar, while the repository layer would be modified to use database queries and transaction management.

## 15. ChatGPT Use Acknowledgement

ChatGPT was used as a development assistance tool during the implementation of FinOps Enterprise.

The assistance was used for code generation, project organization, consistency checking, testing preparation, and frontend styling.

The following parts of the project were completed with ChatGPT assistance.

### 15.1 Frontend Styling

ChatGPT was used to generate the CSS styling of the application.

Main styling file:

`frontend/src/app/globals.css`

This includes styling for application layouts, forms, tables, navigation, dashboard components, and other user interface elements.

### 15.2 API Testing

ChatGPT generated the Postman collection JSON file used for API testing.

File:

`postman/postman_collection.json`

The collection contains requests for the application's API endpoints, including successful and unsuccessful request scenarios.

### 15.3 Dataset Validation

ChatGPT generated the Node.js script used to verify the demonstration dataset.

File:

`backend/scripts/validate-data.js`

The script validates the JSON data structures, identifiers, relationships, and other dataset requirements.

### 15.4 Transaction Data Validation

ChatGPT generated the transaction validation logic used to verify valid states and relationships of stored transactions.

File:

`backend/src/services/transaction.service.js`

This includes checks for transaction statuses, identifiers, account relationships, currencies, and other required transaction properties.

### 15.5 Application Startup Script

ChatGPT generated the script that starts the backend and frontend using the same command.

File:

`scripts/start.js`

The script starts both applications as child processes and handles their termination.

### 15.6 Demonstration Dataset Generation

ChatGPT generated the initial demonstration datasets:

| File | Initial Number of Records |
|---|---:|
| `backend/data/clients.json` | 10 |
| `backend/data/accounts.json` | 20 |
| `backend/data/transactions.json` | 50 |

The datasets provide sample records for testing the application's functionality and business rules.

### 15.7 Git Configuration

ChatGPT generated the `.gitignore` configuration file.

File:

`.gitignore`

This file excludes dependencies, generated build files, operating system metadata, environment files, and other files that should not be tracked by Git.

### 15.8 Project Organization and Code Consistency

ChatGPT was also used to assist with maintaining consistency in the project's file structure and source code organization.

This included reviewing:

- Placement of files in the appropriate frontend and backend directories
- Consistency between route, controller, service, and repository layers
- Correct usage of `backend/config.js`
- Correct usage of `frontend/config.ts`
- API base URL and endpoint configuration
- Imports and exports between modules
- General consistency of the project's code structure

The assistance helped identify structural inconsistencies and configuration issues during development.