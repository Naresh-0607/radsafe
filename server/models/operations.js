import mongoose from 'mongoose';
const { Schema } = mongoose;
const ref = (model, required = true) => ({ type: Schema.Types.ObjectId, ref: model, required });
const options = { timestamps: true, optimisticConcurrency: true };
export const readingStatuses = ['NORMAL', 'WARNING', 'CRITICAL'];
export const alertStatuses = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'];
export const inspectionStatuses = ['PENDING', 'IN_PROGRESS', 'ACTION_REQUIRED', 'COMPLETED'];
export const incidentStatuses = ['OPEN', 'INVESTIGATING', 'ACTION_REQUIRED', 'RESOLVED'];
const readingSchema = new Schema(
  {
    sensor: ref('Sensor'),
    zone: ref('Zone'),
    value: { type: Number, min: 0, required: true },
    unit: { type: String, enum: ['uSv/h'], default: 'uSv/h' },
    recordedAt: { type: Date, required: true },
    createdBy: ref('User'),
    status: { type: String, enum: readingStatuses, required: true },
    demonstrationThresholds: { warning: Number, critical: Number },
  },
  options,
);
readingSchema.index({ zone: 1, recordedAt: -1 });
readingSchema.index({ sensor: 1, recordedAt: -1 });
const alertSchema = new Schema(
  {
    alertCode: { type: String, unique: true, required: true },
    sensor: ref('Sensor'),
    zone: ref('Zone'),
    radiationReading: { ...ref('RadiationReading'), unique: true },
    severity: { type: String, enum: ['WARNING', 'CRITICAL'], required: true },
    message: { type: String, required: true },
    status: { type: String, enum: alertStatuses, default: 'OPEN' },
    acknowledgedBy: ref('User', false),
    acknowledgedAt: Date,
    resolvedBy: ref('User', false),
    resolvedAt: Date,
  },
  options,
);
alertSchema.index({ status: 1, createdAt: -1 });
const inspectionSchema = new Schema(
  {
    inspectionCode: { type: String, unique: true, required: true },
    zone: ref('Zone'),
    officer: ref('User'),
    checklist: [
      {
        label: { type: String, required: true },
        passed: { type: Boolean, default: null },
        remarks: { type: String, default: '' },
      },
    ],
    remarks: { type: String, default: '' },
    correctiveAction: { type: String, default: '' },
    status: { type: String, enum: inspectionStatuses, default: 'PENDING' },
    startedAt: Date,
    completedAt: Date,
  },
  options,
);
const incidentSchema = new Schema(
  {
    incidentCode: { type: String, unique: true, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    zone: ref('Zone'),
    relatedAlert: ref('Alert', false),
    severity: { type: String, enum: ['LOW', 'WARNING', 'CRITICAL'], required: true },
    status: { type: String, enum: incidentStatuses, default: 'OPEN' },
    createdBy: ref('User'),
    correctiveAction: { type: String, default: '' },
    resolutionNotes: { type: String, default: '' },
    resolvedAt: Date,
  },
  options,
);
export const RadiationReading = mongoose.model('RadiationReading', readingSchema);
export const Alert = mongoose.model('Alert', alertSchema);
export const Inspection = mongoose.model('Inspection', inspectionSchema);
export const Incident = mongoose.model('Incident', incidentSchema);
