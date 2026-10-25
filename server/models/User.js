import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['ADMIN', 'SAFETY_OFFICER'], required: true },
    employeeId: { type: String, required: true, unique: true, trim: true },
    department: { type: String, default: '' },
    assignedZone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', default: null },
    active: { type: Boolean, default: true },
    sessionVersion: { type: Number, default: 0, select: false },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.sessionVersion;
        delete ret.__v;
        return ret;
      },
    },
  },
);
export default mongoose.model('User', schema);
