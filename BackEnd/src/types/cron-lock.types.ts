import { Document, Types } from 'mongoose';

export interface ICronLock extends Document {
  _id: Types.ObjectId;
  lockName: string;
  acquiredAt: Date;
  expiresAt: Date;
  acquiredBy: string;
}
