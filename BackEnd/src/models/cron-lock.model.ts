import mongoose, { Schema } from 'mongoose';
import { ICronLock } from '../types/cron-lock.types';

const cronLockSchema = new Schema<ICronLock>(
  {
    lockName: {
      type: String,
      required: true,
      unique: true,
    },
    acquiredAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    acquiredBy: {
      type: String,
      required: true,
    },
  },
  { collection: 'cronLocks' }
);

// TTL index: Mongo deletes documents when expiresAt < now.
// The TTL monitor runs ~every 60s, so cleanup may lag by up to a minute.
cronLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CronLock = mongoose.model<ICronLock>('CronLock', cronLockSchema);
