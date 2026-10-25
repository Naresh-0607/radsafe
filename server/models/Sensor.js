import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    sensorCode: { type: String, required: true, unique: true },
    zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', required: true },
    type: { type: String, required: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'], default: 'ACTIVE' },
    installedAt: { type: Date, required: true },
  },
  { timestamps: true, optimisticConcurrency: true },
);
schema.index({ zone: 1 });
export default mongoose.model('Sensor', schema);
