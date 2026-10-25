import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  RadiationReading,
  Alert,
  Inspection,
  Incident,
  readingStatuses,
  alertStatuses,
  inspectionStatuses,
  incidentStatuses,
} from '../models/operations.js';
import Sensor from '../models/Sensor.js';
import Zone from '../models/Zone.js';
import { objectId, text, optionalText, isoDate } from '../middleware/validate.js';
import { ok, HttpError, requireFound } from '../utils/http.js';
import { listQuery, paged } from '../services/query.js';
import { audit } from '../services/audit.js';
import { classifyReading } from '../services/thresholds.js';
const code = (prefix) => prefix + '-' + randomUUID().slice(0, 8).toUpperCase();
export const readingSchema = z
  .object({
    sensor: objectId,
    zone: objectId,
    value: z.number().finite().min(0).max(1000000),
    unit: z.literal('uSv/h').default('uSv/h'),
    recordedAt: isoDate.refine(
      (v) => new Date(v) <= new Date(),
      'Reading date cannot be in the future',
    ),
  })
  .strict();
const checklistItem = z
  .object({ label: text(200), passed: z.boolean().nullable(), remarks: optionalText(1000) })
  .strict();
export const inspectionSchema = z
  .object({
    zone: objectId,
    checklist: z.array(checklistItem).min(1).max(40),
    remarks: optionalText(),
    correctiveAction: optionalText(),
    status: z.enum(inspectionStatuses).default('PENDING'),
  })
  .strict();
export const incidentSchema = z
  .object({
    title: text(),
    description: text(4000),
    zone: objectId,
    relatedAlert: objectId.nullable().optional(),
    severity: z.enum(['LOW', 'WARNING', 'CRITICAL']),
    status: z.enum(incidentStatuses).default('OPEN'),
    correctiveAction: optionalText(),
    resolutionNotes: optionalText(),
  })
  .strict();
const configurations = {
  radiation: {
    Model: RadiationReading,
    statuses: readingStatuses,
    dateField: 'recordedAt',
    populate: 'sensor zone createdBy',
  },
  alerts: {
    Model: Alert,
    statuses: alertStatuses,
    populate: 'sensor zone radiationReading acknowledgedBy resolvedBy',
    searchFields: ['alertCode', 'message'],
    severities: ['WARNING', 'CRITICAL'],
  },
  inspections: {
    Model: Inspection,
    statuses: inspectionStatuses,
    populate: 'zone officer',
    searchFields: ['inspectionCode', 'remarks'],
  },
  incidents: {
    Model: Incident,
    statuses: incidentStatuses,
    populate: 'zone relatedAlert createdBy',
    searchFields: ['incidentCode', 'title'],
    severities: ['LOW', 'WARNING', 'CRITICAL'],
  },
};
export const operationList = (kind) => async (req, res) => {
  const config = configurations[kind];
  const query = req.params.zoneId ? { ...req.query, zone: req.params.zoneId } : req.query;
  const { filter, options } = listQuery(query, {
    ...config,
    extra: ['zone', ...(kind === 'radiation' || kind === 'alerts' ? ['sensor'] : [])],
  });
  ok(res, await paged(config.Model, filter, options, config.populate));
};
export const operationGet = (kind) => async (req, res) => {
  const { Model, populate } = configurations[kind];
  ok(res, requireFound(await Model.findById(req.params.id).populate(populate)));
};
export const createReading = (config) => async (req, res) => {
  let reading, alert;
  await mongoose.connection.transaction(async (session) => {
    alert = null;
    const sensor = requireFound(await Sensor.findById(req.body.sensor).session(session), 'Sensor');
    const zone = requireFound(await Zone.findById(req.body.zone).session(session), 'Zone');
    if (String(sensor.zone) !== req.body.zone)
      throw new HttpError(400, 'Sensor does not belong to the selected zone');
    if (sensor.status !== 'ACTIVE' || zone.status !== 'ACTIVE')
      throw new HttpError(409, 'Demo readings require an active sensor and zone');
    const status = classifyReading(req.body.value, config.thresholds);
    [reading] = await RadiationReading.create(
      [
        {
          ...req.body,
          createdBy: req.user._id,
          status,
          demonstrationThresholds: {
            warning: config.thresholds.warning,
            critical: config.thresholds.critical,
          },
        },
      ],
      { session },
    );
    if (status !== 'NORMAL') {
      [alert] = await Alert.create(
        [
          {
            alertCode: code('ALT'),
            sensor: sensor._id,
            zone: zone._id,
            radiationReading: reading._id,
            severity: status,
            message:
              'Synthetic reading of ' +
              reading.value +
              ' uSv/h reached the demonstration ' +
              status.toLowerCase() +
              ' threshold.',
          },
        ],
        { session },
      );
    }
    await audit(
      req.user._id,
      'CREATE_READING',
      'RadiationReading',
      reading._id,
      { value: reading.value, unit: reading.unit, status },
      session,
    );
    if (alert)
      await audit(req.user._id, 'CREATE_ALERT', 'Alert', alert._id, { severity: status }, session);
  });
  ok(
    res,
    { reading, alert },
    alert ? 'Demo reading saved and alert generated' : 'Demo reading saved',
    201,
  );
};
export const transitionAlert = (action) => async (req, res) => {
  let alert;
  await mongoose.connection.transaction(async (session) => {
    alert = requireFound(await Alert.findById(req.params.id).session(session), 'Alert');
    const expected = action === 'acknowledge' ? 'OPEN' : 'ACKNOWLEDGED';
    if (alert.status !== expected)
      throw new HttpError(
        409,
        action === 'acknowledge'
          ? 'Only open alerts can be acknowledged'
          : 'Acknowledge the alert before resolving it; resolved alerts cannot be reopened',
      );
    const now = new Date();
    if (action === 'acknowledge') {
      alert.status = 'ACKNOWLEDGED';
      alert.acknowledgedBy = req.user._id;
      alert.acknowledgedAt = now;
    } else {
      alert.status = 'RESOLVED';
      alert.resolvedBy = req.user._id;
      alert.resolvedAt = now;
    }
    await alert.save({ session });
    await audit(
      req.user._id,
      action === 'acknowledge' ? 'ACKNOWLEDGE_ALERT' : 'RESOLVE_ALERT',
      'Alert',
      alert._id,
      { status: alert.status },
      session,
    );
  });
  ok(res, alert, 'Alert ' + (action === 'acknowledge' ? 'acknowledged' : 'resolved'));
};
const inspectionTransitions = {
  PENDING: ['PENDING', 'IN_PROGRESS'],
  IN_PROGRESS: ['IN_PROGRESS', 'ACTION_REQUIRED', 'COMPLETED'],
  ACTION_REQUIRED: ['ACTION_REQUIRED', 'IN_PROGRESS', 'COMPLETED'],
  COMPLETED: [],
};
const incidentTransitions = {
  OPEN: ['OPEN', 'INVESTIGATING', 'ACTION_REQUIRED'],
  INVESTIGATING: ['INVESTIGATING', 'ACTION_REQUIRED', 'RESOLVED'],
  ACTION_REQUIRED: ['ACTION_REQUIRED', 'INVESTIGATING', 'RESOLVED'],
  RESOLVED: [],
};
export const saveInspection = (updating) => async (req, res) => {
  let inspection;
  await mongoose.connection.transaction(async (session) => {
    requireFound(await Zone.findById(req.body.zone).session(session), 'Zone');
    const data = req.body;
    if (updating) {
      inspection = requireFound(
        await Inspection.findById(req.params.id).session(session),
        'Inspection',
      );
      if (!inspectionTransitions[inspection.status].includes(data.status))
        throw new HttpError(
          409,
          'Invalid inspection transition. Start a pending inspection before completing it. Completed inspections are immutable.',
        );
      if (String(inspection.zone) !== data.zone)
        throw new HttpError(409, 'An existing inspection cannot change zones');
    } else {
      if (!['PENDING', 'IN_PROGRESS'].includes(data.status))
        throw new HttpError(400, 'Create inspections as pending or in progress');
      inspection = new Inspection({ inspectionCode: code('INS'), officer: req.user._id });
    }
    if (data.status === 'COMPLETED') {
      if (data.checklist.some((item) => item.passed === null))
        throw new HttpError(400, 'Assess every checklist item before completing');
      if (data.checklist.some((item) => item.passed === false) && !data.correctiveAction.trim())
        throw new HttpError(400, 'Record corrective action for failed checklist items');
    }
    if (data.checklist.some((item) => item.passed === false && !item.remarks.trim()))
      throw new HttpError(400, 'Explain each failed checklist item in its remarks');
    inspection.set(data);
    if (data.status !== 'PENDING' && !inspection.startedAt) inspection.startedAt = new Date();
    if (data.status === 'COMPLETED') inspection.completedAt = new Date();
    await inspection.save({ session });
    await audit(
      req.user._id,
      data.status === 'COMPLETED'
        ? 'COMPLETE_INSPECTION'
        : updating
          ? 'UPDATE_INSPECTION'
          : 'CREATE_INSPECTION',
      'Inspection',
      inspection._id,
      { status: inspection.status },
      session,
    );
  });
  ok(res, inspection, 'Inspection saved', updating ? 200 : 201);
};
export const saveIncident = (updating) => async (req, res) => {
  let incident;
  await mongoose.connection.transaction(async (session) => {
    requireFound(await Zone.findById(req.body.zone).session(session), 'Zone');
    const data = req.body;
    if (data.relatedAlert) {
      const alert = requireFound(
        await Alert.findById(data.relatedAlert).session(session),
        'Related alert',
      );
      if (String(alert.zone) !== data.zone)
        throw new HttpError(400, 'Related alert must belong to the selected zone');
    }
    if (updating) {
      incident = requireFound(await Incident.findById(req.params.id).session(session), 'Incident');
      if (!incidentTransitions[incident.status].includes(data.status))
        throw new HttpError(
          409,
          'Invalid incident transition. Investigate before resolving. Resolved incidents are immutable.',
        );
      if (String(incident.zone) !== data.zone)
        throw new HttpError(409, 'An existing incident cannot change zones');
    } else {
      if (data.status !== 'OPEN') throw new HttpError(400, 'New incidents must start open');
      incident = new Incident({ incidentCode: code('INC'), createdBy: req.user._id });
    }
    if (data.status === 'ACTION_REQUIRED' && !data.correctiveAction.trim())
      throw new HttpError(400, 'Describe the required corrective action');
    if (
      data.status === 'RESOLVED' &&
      (!data.resolutionNotes.trim() || !data.correctiveAction.trim())
    )
      throw new HttpError(
        400,
        'Corrective action and resolution notes are required to resolve an incident',
      );
    incident.set(data);
    if (data.status === 'RESOLVED') incident.resolvedAt = new Date();
    await incident.save({ session });
    await audit(
      req.user._id,
      data.status === 'RESOLVED'
        ? 'RESOLVE_INCIDENT'
        : updating
          ? 'UPDATE_INCIDENT'
          : 'CREATE_INCIDENT',
      'Incident',
      incident._id,
      { status: incident.status },
      session,
    );
  });
  ok(res, incident, 'Incident saved', updating ? 200 : 201);
};
