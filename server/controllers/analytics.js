import mongoose from 'mongoose';
import { z } from 'zod';
import User from '../models/User.js';
import Zone from '../models/Zone.js';
import Sensor from '../models/Sensor.js';
import AuditLog from '../models/AuditLog.js';
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
import { listQuery, paged } from '../services/query.js';
import { ok } from '../utils/http.js';
export const dashboard = (config) => async (req, res) => {
  const admin = req.user.role === 'ADMIN';
  const since = new Date(Date.now() - 7 * 86400000);
  const [
    totalUsers,
    totalOfficers,
    totalZones,
    activeSensors,
    inactiveSensors,
    maintenanceSensors,
    openAlerts,
    openIncidents,
    pendingInspections,
    recentAlerts,
    recentReadings,
    zoneRows,
    recentAudit,
    trend,
    severity,
  ] = await Promise.all([
    admin ? User.countDocuments() : 0,
    admin ? User.countDocuments({ role: 'SAFETY_OFFICER' }) : 0,
    Zone.countDocuments(),
    Sensor.countDocuments({ status: 'ACTIVE' }),
    Sensor.countDocuments({ status: 'INACTIVE' }),
    Sensor.countDocuments({ status: 'MAINTENANCE' }),
    Alert.countDocuments({ status: mongoose.trusted({ $ne: 'RESOLVED' }) }),
    Incident.countDocuments({ status: mongoose.trusted({ $ne: 'RESOLVED' }) }),
    Inspection.countDocuments({ status: mongoose.trusted({ $ne: 'COMPLETED' }) }),
    Alert.find().sort({ createdAt: -1 }).limit(5).populate('zone sensor'),
    RadiationReading.find().sort({ recordedAt: -1 }).limit(5).populate('zone sensor'),
    Zone.aggregate([
      { $sort: { name: 1 } },
      {
        $lookup: {
          from: 'radiationreadings',
          let: { zoneId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$zone', '$$zoneId'] } } },
            { $sort: { recordedAt: -1, _id: -1 } },
            { $limit: 1 },
          ],
          as: 'latest',
        },
      },
      { $lookup: { from: 'sensors', localField: '_id', foreignField: 'zone', as: 'sensors' } },
      {
        $project: {
          name: 1,
          code: 1,
          status: 1,
          latest: { $arrayElemAt: ['$latest', 0] },
          sensorCount: { $size: '$sensors' },
        },
      },
    ]),
    admin ? AuditLog.find().sort({ createdAt: -1 }).limit(5).populate('user', 'name role') : [],
    RadiationReading.aggregate([
      { $match: { recordedAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%dT%H:00:00Z', date: '$recordedAt' } },
          average: { $avg: '$value' },
          maximum: { $max: '$value' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Alert.aggregate([
      { $match: { status: { $ne: 'RESOLVED' } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),
  ]);
  const overallStatus = severity.some((s) => s._id === 'CRITICAL')
    ? 'CRITICAL'
    : openAlerts
      ? 'WARNING'
      : recentReadings.length
        ? 'NORMAL'
        : 'NO_DATA';
  ok(res, {
    counts: {
      totalUsers,
      totalOfficers,
      totalZones,
      activeSensors,
      inactiveSensors,
      maintenanceSensors,
      openAlerts,
      openIncidents,
      pendingInspections,
    },
    overallStatus,
    recentAlerts,
    recentReadings,
    zones: zoneRows,
    recentAudit,
    trend,
    thresholds: config.thresholds,
    generatedAt: new Date(),
  });
};
export const reports = (config) => async (req, res) => {
  const { kind = 'radiation', ...query } = req.query;
  z.enum(['radiation', 'alerts', 'inspections', 'incidents']).parse(kind);
  const configs = {
    radiation: [RadiationReading, readingStatuses, 'recordedAt'],
    alerts: [Alert, alertStatuses, 'createdAt'],
    inspections: [Inspection, inspectionStatuses, 'createdAt'],
    incidents: [Incident, incidentStatuses, 'createdAt'],
  };
  const [Model, statuses, dateField] = configs[kind];
  const { filter } = listQuery(query, {
    extra: ['zone', ...(kind === 'radiation' ? ['sensor'] : [])],
    statuses,
    dateField,
  });
  const [summary] = await Model.aggregate([
    { $match: filter },
    {
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              average: { $avg: '$value' },
              maximum: { $max: '$value' },
              minimum: { $min: '$value' },
            },
          },
        ],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
        byZone: [
          {
            $group: {
              _id: '$zone',
              count: { $sum: 1 },
              average: { $avg: '$value' },
              maximum: { $max: '$value' },
            },
          },
          { $lookup: { from: 'zones', localField: '_id', foreignField: '_id', as: 'zone' } },
          { $unwind: { path: '$zone', preserveNullAndEmptyArrays: true } },
          { $sort: { count: -1 } },
        ],
        daily: [
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$' + dateField } },
              count: { $sum: 1 },
              average: { $avg: '$value' },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]);
  ok(res, {
    kind,
    ...summary,
    totals: summary.totals[0] || { count: 0, average: null, maximum: null, minimum: null },
    thresholds: config.thresholds,
    generatedAt: new Date(),
  });
};
export async function personnel(req, res) {
  const { filter, options } = listQuery(req.query, {
    searchFields: ['name', 'email', 'employeeId'],
    extra: ['department'],
  });
  const [data, departments] = await Promise.all([
    paged(User, filter, options, 'assignedZone'),
    User.distinct('department'),
  ]);
  // Only profile fields, with no authentication internals, are returned by User's serializer.
  ok(res, { ...data, departments: departments.filter(Boolean).sort() });
}
export async function auditLogs(req, res) {
  const { filter, options } = listQuery(req.query, { searchFields: ['action', 'entityType'] });
  ok(res, await paged(AuditLog, filter, options, { path: 'user', select: 'name employeeId role' }));
}
