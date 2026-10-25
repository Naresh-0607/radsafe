import AuditLog from '../models/AuditLog.js';
// Callers supply only controlled metadata, never request bodies or credentials.
export async function audit(user, action, entityType, entityId, metadata = {}, session = null) {
  const safe = Object.fromEntries(
    Object.entries(metadata).filter(([key]) =>
      ['status', 'severity', 'value', 'unit', 'fields', 'active'].includes(key),
    ),
  );
  await AuditLog.create([{ user, action, entityType, entityId, metadata: safe }], { session });
}
