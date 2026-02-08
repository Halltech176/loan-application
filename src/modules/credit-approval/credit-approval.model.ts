import mongoose, { Schema, Document, Types } from 'mongoose';

export enum CreditDecision {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface ICreditApproval extends Document {
  id: string;
  loanApplicationId: Types.ObjectId;
  creditScore: number;
  debtToIncomeRatio: number;
  decision: CreditDecision;
  approvedAmount?: number;
  approvedInterestRate?: number;
  approvedTerm?: number;
  conditions?: string[];
  reviewedBy: Types.ObjectId;
  reviewedAt: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const creditApprovalSchema = new Schema<ICreditApproval>(
  {
    loanApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LoanApplication',
      required: true,
      unique: true,
      index: true,
    },
    creditScore: {
      type: Number,
      required: true,
      min: 300,
      max: 850,
    },
    debtToIncomeRatio: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    decision: {
      type: String,
      enum: Object.values(CreditDecision),
      default: CreditDecision.PENDING,
    },
    approvedAmount: Number,
    approvedInterestRate: Number,
    approvedTerm: Number,
    conditions: [String],
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
      default: Date.now,
    },
    notes: String,
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

export const CreditApprovalModel = mongoose.model<ICreditApproval>(
  'CreditApproval',
  creditApprovalSchema,
);
