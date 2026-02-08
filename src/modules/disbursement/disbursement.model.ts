import mongoose, { Schema, Document, Types } from 'mongoose';

export enum DisbursementStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface IDisbursement extends Document {
  id: string;
  loanApplicationId: Types.ObjectId;
  amount: number;
  recipientAccount: {
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankCode: string;
  };
  status: DisbursementStatus;
  transactionReference?: string;
  disbursedBy: string;
  disbursedAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const disbursementSchema = new Schema<IDisbursement>(
  {
    loanApplicationId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
      ref: 'LoanApplication',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    recipientAccount: {
      accountNumber: {
        type: String,
        required: true,
      },
      accountName: {
        type: String,
        required: true,
      },
      bankName: {
        type: String,
        required: true,
      },
      bankCode: {
        type: String,
        required: true,
      },
    },
    status: {
      type: String,
      enum: Object.values(DisbursementStatus),
      default: DisbursementStatus.PENDING,
    },
    transactionReference: String,
    disbursedBy: {
      type: String,
      required: true,
    },
    disbursedAt: Date,
    failureReason: String,
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

export const DisbursementModel = mongoose.model<IDisbursement>('Disbursement', disbursementSchema);
