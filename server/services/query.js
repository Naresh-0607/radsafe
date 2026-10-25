import mongoose from 'mongoose';
import { z } from 'zod';
import { objectId } from '../middleware/validate.js';
const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().max(120).optional(),
    zone: objectId.optional(),
    sensor: objectId.optional(),
    status: z.string().max(50).optional(),
    severity: z.string().max(50).optional(),
    department: z.string().max(120).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to, 'Start date must not be after end date');
export function listQuery(
  query,
  { dateField = 'createdAt', searchFields = [], extra = [], statuses, severities } = {},
) {
  const parsed = querySchema.parse(query);
  const filter = {};
  for (const key of extra)
    if (parsed[key])
      filter[key] = ['zone', 'sensor'].includes(key)
        ? new mongoose.Types.ObjectId(parsed[key])
        : parsed[key];
  if (parsed.status && statuses) filter.status = z.enum(statuses).parse(parsed.status);
  if (parsed.severity && severities) filter.severity = z.enum(severities).parse(parsed.severity);
  if (parsed.search && searchFields.length) {
    const escaped = parsed.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = searchFields.map((field) => ({
      [field]: mongoose.trusted({ $regex: escaped, $options: 'i' }),
    }));
  }
  if (parsed.from || parsed.to) {
    const range = {};
    if (parsed.from) range.$gte = new Date(parsed.from + 'T00:00:00.000Z');
    if (parsed.to)
      range.$lt = new Date(new Date(parsed.to + 'T00:00:00.000Z').getTime() + 86400000);
    filter[dateField] = mongoose.trusted(range);
  }
  return {
    filter,
    options: { page: parsed.page, limit: parsed.limit, sort: { [dateField]: -1, _id: -1 } },
  };
}
export async function paged(Model, filter, { page, limit, sort }, populate = '') {
  const [items, total] = await Promise.all([
    Model.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(populate),
    Model.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}
