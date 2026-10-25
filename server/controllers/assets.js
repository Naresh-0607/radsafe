import mongoose from 'mongoose';
import { z } from 'zod';
import Zone from '../models/Zone.js';
import Sensor from '../models/Sensor.js';
import User from '../models/User.js';
import { RadiationReading, Alert, Inspection, Incident } from '../models/operations.js';
import { text, optionalText, objectId, isoDate } from '../middleware/validate.js';
import { HttpError, ok, requireFound } from '../utils/http.js';
import { listQuery, paged } from '../services/query.js';
import { audit } from '../services/audit.js';
export const assetStatuses = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];
export const zoneSchema = z
  .object({
    name: text(),
    code: text(40),
    description: optionalText(),
    status: z.enum(assetStatuses).default('ACTIVE'),
  })
  .strict();
export const sensorSchema = z
  .object({
    sensorCode: text(60),
    zone: objectId,
    type: text(80),
    status: z.enum(assetStatuses).default('ACTIVE'),
    installedAt: isoDate.refine(
      (v) => new Date(v) <= new Date(),
      'Installation date cannot be in the future',
    ),
  })
  .strict();
export function assetController(Model, kind) {
  const isZone = kind === 'ZONE';
  return {
    list: async (req, res) => {
      const { filter, options } = listQuery(req.query, {
        searchFields: isZone ? ['name', 'code'] : ['sensorCode', 'type'],
        extra: isZone ? [] : ['zone'],
        statuses: assetStatuses,
      });
      ok(res, await paged(Model, filter, options, isZone ? '' : 'zone'));
    },
    get: async (req, res) =>
      ok(res, requireFound(await Model.findById(req.params.id).populate(isZone ? '' : 'zone'))),
    create: async (req, res) => {
      let doc;
      await mongoose.connection.transaction(async (session) => {
        if (!isZone) requireFound(await Zone.findById(req.body.zone).session(session), 'Zone');
        [doc] = await Model.create([req.body], { session });
        await audit(req.user._id, `CREATE_${kind}`, Model.modelName, doc._id, {}, session);
      });
      ok(res, doc, `${Model.modelName} created`, 201);
    },
    update: async (req, res) => {
      let doc;
      await mongoose.connection.transaction(async (session) => {
        doc = requireFound(await Model.findById(req.params.id).session(session));
        if (!isZone) {
          requireFound(await Zone.findById(req.body.zone).session(session), 'Zone');
          if (
            String(doc.zone) !== req.body.zone &&
            (await RadiationReading.exists({ sensor: doc._id }).session(session))
          )
            throw new HttpError(
              409,
              'A sensor with reading history cannot move zones. Create a new sensor instead.',
            );
        }
        doc.set(req.body);
        await doc.save({ session });
        await audit(req.user._id, `UPDATE_${kind}`, Model.modelName, doc._id, {}, session);
      });
      ok(res, doc, `${Model.modelName} updated`);
    },
    remove: async (req, res) => {
      await mongoose.connection.transaction(async (session) => {
        const doc = requireFound(await Model.findById(req.params.id).session(session));
        const dependencies = isZone
          ? [
              [Sensor, 'zone'],
              [RadiationReading, 'zone'],
              [Alert, 'zone'],
              [Inspection, 'zone'],
              [Incident, 'zone'],
              [User, 'assignedZone'],
            ]
          : [
              [RadiationReading, 'sensor'],
              [Alert, 'sensor'],
            ];
        for (const [Other, key] of dependencies)
          if (await Other.exists({ [key]: doc._id }).session(session))
            throw new HttpError(
              409,
              'This record is in use. Set it inactive to preserve its history.',
            );
        await doc.deleteOne({ session });
        await audit(req.user._id, `DELETE_${kind}`, Model.modelName, doc._id, {}, session);
      });
      ok(res, {}, `${Model.modelName} deleted`);
    },
  };
}
