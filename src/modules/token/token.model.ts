import mongoose, { Schema, Document, Types } from 'mongoose';

export enum TokenType {
  PASSWORD_RESET = 'password_reset',
  EMAIL_VERIFICATION = 'email_verification',
  PHONE_VERIFICATION = 'phone_verification',
}

export interface IToken extends Document {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  userId: Types.ObjectId;
  token: string;
  type: TokenType;
  expiresAt: Date;
  isUsed: boolean;
  usedAt?: Date;
}

const tokenSchema = new Schema<IToken>(
  {
    version: {
      type: Number,
      default: 0,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: 'User',
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(TokenType),
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
      index: true,
    },
    usedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        const { _id, __v, ...rest } = ret;
        return {
          ...rest,
          id: _id.toString(),
        };
      },
    },
  },
);

tokenSchema.index({ userId: 1, type: 1 });
tokenSchema.index({ token: 1, type: 1 });
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TokenModel = mongoose.model<IToken>('Token', tokenSchema);
