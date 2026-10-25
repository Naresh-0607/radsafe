# RadSafe Phase 1 API

All endpoints are prefixed with `/api`. Except health and login, endpoints require `Authorization: Bearer <token>`.

Successful responses:

```json
{ "success": true, "message": "Operation successful", "data": {} }
```

Errors:

```json
{ "success": false, "message": "Readable error message" }
```

List responses use `data: { items, total, page, pages }`. Status codes: 200 success, 201 creation, 400 invalid input, 401 missing/expired/revoked session or inactive account, 403 wrong role, 404 missing record, 409 uniqueness/dependency/state conflict, 429 excessive login attempts, 500 internal error.

## Route summary

| Method           | Route                          | Access                                      |
| ---------------- | ------------------------------ | ------------------------------------------- |
| GET              | /health                        | Public                                      |
| POST             | /auth/login                    | Public, rate limited                        |
| GET              | /auth/me                       | Both roles                                  |
| POST             | /auth/logout                   | Both roles                                  |
| GET              | /dashboard                     | Both; returns role-specific audit/user data |
| GET              | /settings                      | Both; demonstration thresholds              |
| GET, POST        | /users                         | Admin                                       |
| GET, PUT, DELETE | /users/:id                     | Admin                                       |
| PATCH            | /users/:id/status              | Admin                                       |
| GET              | /zones, /zones/:id             | Both                                        |
| POST             | /zones                         | Admin                                       |
| PUT, DELETE      | /zones/:id                     | Admin                                       |
| GET              | /sensors, /sensors/:id         | Both                                        |
| POST             | /sensors                       | Admin                                       |
| PUT, DELETE      | /sensors/:id                   | Admin                                       |
| GET              | /radiation, /radiation/:id     | Both                                        |
| GET              | /radiation/zone/:zoneId        | Both                                        |
| POST             | /radiation                     | Safety Officer                              |
| GET              | /alerts, /alerts/:id           | Both                                        |
| PATCH            | /alerts/:id/acknowledge        | Safety Officer                              |
| PATCH            | /alerts/:id/resolve            | Safety Officer                              |
| GET              | /inspections, /inspections/:id | Both                                        |
| POST             | /inspections                   | Safety Officer                              |
| PUT              | /inspections/:id               | Safety Officer                              |
| GET              | /incidents, /incidents/:id     | Both                                        |
| POST             | /incidents                     | Safety Officer                              |
| PUT              | /incidents/:id                 | Safety Officer                              |
| GET              | /personnel                     | Safety Officer                              |
| GET              | /reports                       | Both                                        |
| GET              | /audit-logs                    | Admin                                       |

Admin cannot submit readings, mutate alerts, or create/update inspections or incidents. Safety Officers cannot access admin CRUD or audit logs.

## Request shapes

| Operation                 | JSON fields                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| Login                     | `email, password`                                                                                        |
| Create user               | `name, email, employeeId, department, password, assignedZone?`; optional `role` must be `SAFETY_OFFICER` |
| Update user               | Any nonempty subset of `name, email, employeeId, department, password, assignedZone`                     |
| User status               | `active` (boolean)                                                                                       |
| Create/update zone        | `name, code, description?, status?`                                                                      |
| Create/update sensor      | `sensorCode, zone, type, status?, installedAt`                                                           |
| Create reading            | `sensor, zone, value, recordedAt, unit?`                                                                 |
| Acknowledge/resolve alert | Empty JSON object `{}`                                                                                   |
| Create/update inspection  | `zone, checklist, remarks?, correctiveAction?, status?`                                                  |
| Create/update incident    | `title, description, zone, relatedAlert?, severity, status?, correctiveAction?, resolutionNotes?`        |

Reference values are MongoDB ObjectId strings; optional assignments/related alerts can be null. Unknown body fields are rejected. Sensor/zone and alert/zone relationships are validated. Radiation `value` must be a finite number between 0 and 1,000,000. Unit is always `uSv/h`. Dates in writes use ISO 8601 with a timezone. `createdBy`, officer ownership, codes, and workflow timestamps are assigned by the server, not accepted from clients.

Zone/sensor status: `ACTIVE | INACTIVE | MAINTENANCE`.
Reading demo status: `NORMAL | WARNING | CRITICAL`.
Alert severity: `WARNING | CRITICAL`.
Incident severity: `LOW | WARNING | CRITICAL`.

## Filters

Lists accept `page` (default 1), `limit` (default 20, maximum 100), and relevant filters:

| List        | Supported useful filters                                        |
| ----------- | --------------------------------------------------------------- |
| Users       | search (name/email/employeeId), department                      |
| Zones       | search (name/code), status                                      |
| Sensors     | search (sensorCode/type), zone, status                          |
| Radiation   | zone, sensor, status, from, to                                  |
| Alerts      | search (code/message), zone, sensor, severity, status, from, to |
| Inspections | search (code/remarks), zone, status, from, to                   |
| Incidents   | search (code/title), zone, severity, status, from, to           |
| Personnel   | search (name/email/employeeId), department                      |
| Audit logs  | search (action/entityType), from, to                            |
| Reports     | kind, zone, status, from, to; sensor for radiation              |

`from` and `to` use YYYY-MM-DD and inclusive UTC calendar days. Radiation dates refer to `recordedAt`; workflow dates refer to `createdAt`. Invalid dates, date order, ObjectIds, enums, and unknown query keys are rejected.

Reports `kind`: `radiation | alerts | inspections | incidents`. Returns `totals, byStatus, byZone, daily, thresholds, generatedAt`. Radiation totals include average, minimum, and maximum values.

## Validated workflows

### Readings

Active sensor in an active matching zone -> save synthetic reading -> compare configured demonstration thresholds -> create WARNING/CRITICAL alert if applicable -> write audit entries -> commit transaction.

A value equal to a configured threshold is in that threshold's category. Each reading stores a threshold snapshot.

### Alerts

`OPEN -> ACKNOWLEDGED -> RESOLVED`

Only Safety Officers can perform transitions. Repeated or backward transitions return 409. Acknowledgment and resolution record the actor and server time. Use a linked incident to document investigation.

### Inspections

Create as `PENDING` or `IN_PROGRESS`.

- `PENDING -> IN_PROGRESS`
- `IN_PROGRESS -> ACTION_REQUIRED | COMPLETED`
- `ACTION_REQUIRED -> IN_PROGRESS | COMPLETED`
- Same-state edits are allowed before completion.
- Completed inspections are immutable.

A checklist contains 1-40 items: `{ label, passed: true | false | null, remarks }`. Null means not assessed. A failed item requires explanatory remarks. Completion requires all items to be assessed and corrective action when any item failed. Starting and completing assign server timestamps. Existing records cannot change zones.

### Incidents

Create as `OPEN`.

- `OPEN -> INVESTIGATING | ACTION_REQUIRED`
- `INVESTIGATING -> ACTION_REQUIRED | RESOLVED`
- `ACTION_REQUIRED -> INVESTIGATING | RESOLVED`
- Same-state edits are allowed before resolution.
- Resolved incidents are immutable.

Action-required status requires corrective action. Resolution requires corrective action plus resolution notes and sets `resolvedAt`. Linked alerts must belong to the incident zone. Existing incidents cannot change zones.

## Security and history

Passwords are bcrypt hashed and excluded from serialization and population. JWTs use HS256 with issuer/audience validation and a database session version. Logout, password change, deactivation, and reactivation revoke earlier tokens. An inactive or deleted user cannot reuse a token.

Audit entries capture successful changes only. IDs remain in history when officer accounts are deleted. Deletion of referenced zones/sensors is rejected to preserve records. Audit-log endpoints are read-only and admin-only.
