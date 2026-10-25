import { Router } from 'express';
import { z } from 'zod';
import { authorize } from '../middleware/auth.js';
import { validate, validateId } from '../middleware/validate.js';
import {
  createUserSchema,
  updateUserSchema,
  usersList,
  userGet,
  userCreate,
  userUpdate,
  userStatus,
  userDelete,
} from '../controllers/users.js';
import { assetController, zoneSchema, sensorSchema } from '../controllers/assets.js';
import Zone from '../models/Zone.js';
import Sensor from '../models/Sensor.js';
import {
  operationList,
  operationGet,
  readingSchema,
  createReading,
  transitionAlert,
  inspectionSchema,
  saveInspection,
  incidentSchema,
  saveIncident,
} from '../controllers/operations.js';
import { dashboard, reports, personnel, auditLogs } from '../controllers/analytics.js';
import { ok } from '../utils/http.js';
export default function apiRoutes(config) {
  const r = Router();
  const admin = authorize('ADMIN');
  const officer = authorize('SAFETY_OFFICER');
  const both = authorize('ADMIN', 'SAFETY_OFFICER');
  r.use(both);
  r.get('/settings', (req, res) =>
    ok(res, { thresholds: config.thresholds, mode: 'academic-simulation' }),
  );
  r.get('/dashboard', dashboard(config));
  r.get('/users', admin, usersList);
  r.get('/users/:id', admin, validateId, userGet);
  r.post('/users', admin, validate(createUserSchema), userCreate);
  r.put('/users/:id', admin, validateId, validate(updateUserSchema), userUpdate);
  r.patch(
    '/users/:id/status',
    admin,
    validateId,
    validate(z.object({ active: z.boolean() }).strict()),
    userStatus,
  );
  r.delete('/users/:id', admin, validateId, userDelete);
  for (const [path, Model, kind, schema] of [
    ['zones', Zone, 'ZONE', zoneSchema],
    ['sensors', Sensor, 'SENSOR', sensorSchema],
  ]) {
    const c = assetController(Model, kind);
    r.get('/' + path, c.list);
    r.get('/' + path + '/:id', validateId, c.get);
    r.post('/' + path, admin, validate(schema), c.create);
    r.put('/' + path + '/:id', admin, validateId, validate(schema), c.update);
    r.delete('/' + path + '/:id', admin, validateId, c.remove);
  }
  r.get('/radiation/zone/:zoneId', validateId, operationList('radiation'));
  for (const kind of ['radiation', 'alerts', 'inspections', 'incidents']) {
    r.get('/' + kind, operationList(kind));
    r.get('/' + kind + '/:id', validateId, operationGet(kind));
  }
  r.post('/radiation', officer, validate(readingSchema), createReading(config));
  r.patch(
    '/alerts/:id/acknowledge',
    officer,
    validateId,
    validate(z.object({}).strict()),
    transitionAlert('acknowledge'),
  );
  r.patch(
    '/alerts/:id/resolve',
    officer,
    validateId,
    validate(z.object({}).strict()),
    transitionAlert('resolve'),
  );
  r.post('/inspections', officer, validate(inspectionSchema), saveInspection(false));
  r.put('/inspections/:id', officer, validateId, validate(inspectionSchema), saveInspection(true));
  r.post('/incidents', officer, validate(incidentSchema), saveIncident(false));
  r.put('/incidents/:id', officer, validateId, validate(incidentSchema), saveIncident(true));
  r.get('/personnel', officer, personnel);
  r.get('/reports', reports(config));
  r.get('/audit-logs', admin, auditLogs);
  return r;
}
