import { Schema, model, Types, Document } from 'mongoose';

export interface IRefreshToken extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  replacedBy?: Types.ObjectId | null;
  revokedAt?: Date | null;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, expires: 0 }, // TTL: auto-delete on expiry
    replacedBy: { type: Schema.Types.ObjectId, ref: 'RefreshToken', default: null },
    revokedAt: { type: Date, default: null },
    userAgent: { type: String },
  },
  { timestamps: true }
);

export const RefreshToken = model<IRefreshToken>('RefreshToken', refreshTokenSchema);
