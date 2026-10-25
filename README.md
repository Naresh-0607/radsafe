# RadSafe - Phase 1

An academic MERN application for synthetic radiation monitoring and safety management. **This software does not control nuclear equipment. All readings and thresholds are demonstration data, not regulatory limits.**

## Local setup

Requires Node.js 22.12+ (tested with Node 24), npm, and a MongoDB Atlas cluster.

Run these commands from the project root. On Windows PowerShell, use `npm.cmd` / `npx.cmd` if execution policy blocks `npm.ps1`.

```powershell
npm.cmd install
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

Edit `server/.env` before starting. Configure an Atlas database user with read/write access to your application's database, add your development machine's public IP to the project's IP access list, and copy the Node.js driver connection string from Atlas. Include a database name such as `radsafe` in the URI, and URL-encode special characters in database credentials. See the [official Atlas connection guide](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).

The application always uses the configured MongoDB connection. There is no fallback database or browser-only data store.

## Environment variables

| Variable                | Required           | Description                                                          |
| ----------------------- | ------------------ | -------------------------------------------------------------------- |
| `MONGO_URI`             | Yes                | Your MongoDB Atlas URI; never commit credentials                     |
| `JWT_SECRET`            | Yes                | Random secret of at least 32 characters                              |
| `JWT_EXPIRES_IN`        | No                 | Duration such as `1d`, `8h`, or `30m`; defaults to `1d`              |
| `PORT`                  | No                 | API port; defaults to `5000`                                         |
| `CLIENT_URL`            | No                 | Allowed frontend origin; defaults to `http://localhost:5173`         |
| `NODE_ENV`              | No                 | `development` locally                                                |
| `DEMO_WARNING_LEVEL`    | Yes                | Positive, arbitrary demonstration warning threshold                  |
| `DEMO_CRITICAL_LEVEL`   | Yes                | Demonstration critical threshold, greater than warning               |
| `SEED_ADMIN_NAME`       | For seeding        | Initial administrator's full name                                    |
| `SEED_ADMIN_EMAIL`      | For seeding        | Initial administrator's email                                        |
| `SEED_ADMIN_PASSWORD`   | For seeding        | Your chosen password: at least 12 characters, at most 72 UTF-8 bytes |
| `SEED_OFFICER_NAME`     | Optional demo seed | Optional demonstration officer's name                                |
| `SEED_OFFICER_EMAIL`    | Optional demo seed | Optional demonstration officer's email                               |
| `SEED_OFFICER_PASSWORD` | Optional demo seed | Optional officer password, same requirements                         |
| `VITE_API_URL`          | Client, optional   | Defaults to `/api`; Vite proxies to `http://127.0.0.1:5000`          |

Generate a JWT secret locally, then paste its output into `server/.env`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

The example threshold values (`2.5` and `5` uSv/h) are arbitrary coursework settings. They are explicitly labeled **Demonstration thresholds** in the interface. They are not derived from nuclear safety standards.

## Seed and create test credentials

There is no hardcoded/default password and no public registration endpoint.

1. Set all three `SEED_ADMIN_*` variables in `server/.env`.
2. Run:

```powershell
npm.cmd run seed
```

3. Sign in with the email and password **you configured**.
4. Open **User management > Add Safety Officer** to create an officer with a unique email and employee ID.
5. Sign out and sign in with the new officer credentials to exercise the safety workflow.

The admin seed is idempotent: existing admins are left unchanged, including their passwords. It refuses to repurpose an existing officer account. It reserves employee ID `ADMIN-001`.

For optional, manually imported fixtures:

```powershell
npm.cmd run seed:demo
```

This imports five academic zones, five demo sensors, and seven historical synthetic readings per sensor. It uses the configured admin. Set all three `SEED_OFFICER_*` variables to also create an officer (employee ID `SO-DEMO-001`). Repeated imports preserve existing accounts and sensor history. This is an explicit one-time fixture command, not an automatic simulator. Do not use the `DEMO-*` asset-code prefix for your own records.

## Run locally

Both processes:

```powershell
npm.cmd run dev
```

Or in separate terminals:

```powershell
# Backend
npm.cmd run dev:server

# Frontend
npm.cmd run dev:client
```

Open `http://localhost:5173`. The API listens on port 5000. If you change the API port, update the proxy target in `client/vite.config.js`.

Production client build and backend start:

```powershell
npm.cmd run build
npm.cmd start
```

The client build is in `client/dist`. Express serves the API only. For a hosted deployment, serve the client from a static web host with SPA fallback, proxy `/api` to Express, and set `CLIENT_URL` to the hosted origin. For a local build preview, use `npm.cmd run preview -w client`; the preview proxy also targets port 5000. HTTPS is appropriate when deploying beyond localhost.

## Tests

```powershell
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:ui
npm.cmd run build
npm.cmd run format:check
```

Backend tests use Supertest and a disposable **real MongoDB replica set** started by `mongodb-memory-server`, so transactions, uniqueness, Mongoose queries, and authentication are exercised against MongoDB. No Atlas credentials are needed for automated tests. The first run may download a MongoDB binary. Tests do not connect to, reset, or modify your Atlas database.

Browser tests use installed Microsoft Edge on Windows when available; otherwise install Playwright Chromium with the command above. Set RADSAFE_TEST_CHANNEL to override the browser channel.

Browser tests start an isolated API and Vite instance on ports 5000 and 5173. Stop local dev servers on those ports first. Test accounts and JWT secrets are generated for each run; no reusable test password is committed. Browser tests cover the full admin-to-officer workflow, frontend role protection, login errors, mobile navigation, and logout.

Screenshots and failure traces are placed in ignored `test-results/`. Automated Atlas connectivity cannot be verified until you supply your own connection configuration.

## Final folder structure

```text
RadSafe/
  client/
    public/favicon.svg
    src/
      components/        Shared forms, tables, dialogs, route guards, charts
      context/           Authentication and toast providers
      hooks/             API loading and paginated reference data
      layouts/           Role-specific dashboard navigation
      pages/
        admin/           User, zone, sensor management and audit logs
        officer/         Radiation, alerts, inspections, incidents, personnel
        Dashboard.jsx
        Login.jsx
        Reports.jsx
      services/api.js    Axios transport and session handling
      App.jsx
      main.jsx
      styles.css
    .env.example
    index.html
    package.json
    vite.config.js
  server/
    config/              Validated environment and Atlas connection
    controllers/         Auth, CRUD, workflows, analytics
    middleware/          JWT protection, RBAC, validation, errors
    models/              Mongoose schemas and indexes
    routes/              Express auth and application routes
    services/            Audit logging, queries, demo classification
    utils/               HTTP responses and errors
    seed/                Idempotent administrator and optional demo fixtures
    tests/               API integration tests and browser-test server
    .env.example
    app.js
    server.js
    package.json
  tests/e2e/             Playwright browser workflows
  docs/API.md            Endpoint and workflow contract
  .gitignore
  .prettierignore
  .prettierrc.json
  package.json
  package-lock.json
  playwright.config.js
  README.md
```

## Phase 1 checklist

- [x] MongoDB Atlas / Mongoose, Express / Node, React / Vite
- [x] JWT login, authenticated profile, logout and session revocation
- [x] bcrypt password hashing; admin seed reads credentials from environment
- [x] Backend `protect` and `authorize(...roles)`
- [x] Frontend `AuthContext`, `ProtectedRoute`, `RoleRoute`
- [x] Distinct admin and Safety Officer layouts and protected route trees
- [x] Admin dashboard: all requested counts, radiation chart, alerts, audit activity
- [x] User CRUD, search, activation/deactivation and unique account identifiers
- [x] Zone CRUD and sensor CRUD; officer read-only asset inventory
- [x] Safety dashboard: facility demo status, counts, zone status, trends, readings
- [x] Manual/demo radiation entry, history, sensor/zone/date filters
- [x] Configurable demonstration thresholds and automatic alert creation
- [x] Alert investigation, acknowledgment and resolution
- [x] Inspections with checklist results, failed-item remarks and corrective actions
- [x] Incidents linked to alerts, investigation and validated resolution
- [x] Personnel profiles, department search/filter, assigned zone
- [x] Radiation, alert, inspection and incident reports with full filtered totals
- [x] Read-only report details and paginated records for both roles
- [x] Admin audit log access and automatic action logging
- [x] Responsive tables/charts, loading/empty/error states, dialogs and toasts
- [x] Helmet, configured CORS, login rate limit, request validation, centralized errors
- [x] Backend integration tests and browser workflow tests

Phase 2 features are excluded: no Worker login/dashboard, Socket.IO, WebSockets, sensor streaming, automatic simulator, IoT integration, PWA, service worker, offline sync, push notifications, AI, or real facility integration.

## Behavior and implementation notes

- Session tokens are stored in browser `sessionStorage` and sent as Bearer tokens. Expiry is handled in the UI and always enforced by the API. Logout revokes all current sessions for that account. Account status changes and password changes revoke previous sessions.
- Roles are immutable through user management. Admin can create Safety Officers; admins are provisioned by the seed. Admin accounts cannot be deactivated or deleted, preventing accidental lockout.
- Deleting an officer retains historical document identifiers; deleted actors display as `Deleted account`. Zones and sensors referenced by history cannot be deleted. Sensors with reading history cannot change zones.
- Record mutations and audit writes use transactions. Reading submission, optional alert creation, and their audit entries commit together. MongoDB Atlas supports this replica-set transaction design; a standalone local MongoDB process is not sufficient. See [Mongoose transactions](https://mongoosejs.com/docs/transactions.html).
- Dashboards refresh on page load or explicit refresh. Zone status shows the latest historical reading; it is not a claim of live sensor health. Overall demo status reflects unresolved alerts; no readings yields `NO_DATA`.
- Reading classifications retain the demonstration threshold values in effect at submission. Later config changes do not silently rewrite history.
- Dates are stored as UTC. Date-range filters are inclusive calendar days in UTC. Entry forms and displayed timestamps use browser local time. Future readings and future sensor installation dates are rejected.
- Reports aggregate all matching records rather than only the visible page. Tables default to 20 rows, cap requests at 100, and support pagination. Reference selectors load all pages.
- Audit metadata uses a controlled allowlist and never stores raw request bodies, passwords, hashes, or tokens.
- For Phase 2, add `WORKER` deliberately to the user enum and introduce its authorized routes. It is not a valid login role in Phase 1.
- Styling uses Tailwind's official [Vite integration](https://tailwindcss.com/docs/installation/using-vite) plus shared CSS for the monitoring dashboard.

See [docs/API.md](docs/API.md) for the route summary and state transitions.
