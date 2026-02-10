import mongoose, { Schema, Document, HydratedDocument, Types } from 'mongoose';

export enum LoanPurpose {
  BUSINESS = 'business',
  PERSONAL = 'personal',
  EDUCATION = 'education',
  MEDICAL = 'medical',
  HOME_IMPROVEMENT = 'home_improvement',
  DEBT_CONSOLIDATION = 'debt_consolidation',
  OTHER = 'other',
}

export enum LoanStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DISBURSED = 'disbursed',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  DEFAULTED = 'defaulted',
  CLOSED = 'closed',
}

export interface ILoanApplication extends Document {
  id: string;
  applicantId: Types.ObjectId;
  amount: number;
  purpose: LoanPurpose;
  term: number;
  debtToIncomeRatio: number;
  interestRate: number;
  status: LoanStatus;
  statusHistory: Array<{
    status: LoanStatus;
    changedBy: Types.ObjectId;
    changedAt: Date;
    reason?: string;
  }>;
  creditScore: number;
  employmentDetails?: {
    employer: string;
    position: string;
    monthlyIncome: number;
    yearsEmployed: number;
  };
  collateral?: {
    type: string;
    value: number;
    description: string;
  };
  documents: Array<{
    type: string;
    url: string;
    uploadedAt: Date;
  }>;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectedBy?: Types.ObjectId;
  rejectedAt?: Date;
  rejectionReason?: string;
  disbursedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

const loanApplicationSchema = new Schema<ILoanApplication>(
  {
    applicantId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: 'User',
    },
    amount: {
      type: Number,
      required: true,
      min: 1000,
      max: 100000,
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
      enum: Object.values(LoanPurpose),
    },
    term: {
      type: Number,
      required: true,
      min: 1,
      max: 3,
    },
    debtToIncomeRatio: {
      type: Number,
      min: 0,
      max: 100,
    },
    interestRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: Object.values(LoanStatus),
      default: LoanStatus.DRAFT,
      index: true,
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: Object.values(LoanStatus),
          required: true,
        },
        changedBy: {
          type: Types.ObjectId,
          required: true,
          ref: 'User',
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
        reason: String,
      },
    ],
    creditScore: {
      type: Number,
      min: 300,
      max: 850,
    },
    employmentDetails: {
      employer: String,
      position: String,
      monthlyIncome: Number,
      yearsEmployed: Number,
    },
    collateral: {
      type: {
        type: String,
      },
      value: Number,
      description: String,
    },
    documents: [
      {
        type: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    reviewedBy: {
      type: Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: Date,
    reviewNotes: String,
    approvedBy: {
      type: Types.ObjectId,
      ref: 'User',
    },
    approvedAt: Date,
    rejectedBy: {
      type: Types.ObjectId,
      ref: 'User',
    },
    rejectedAt: Date,
    rejectionReason: String,
    disbursedAt: Date,
    version: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_: HydratedDocument<ILoanApplication>, ret: Record<string, any>) => {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  },
);

loanApplicationSchema.index({ applicantId: 1, status: 1 });
loanApplicationSchema.index({ status: 1, createdAt: -1 });

export const LoanApplicationModel = mongoose.model<ILoanApplication>(
  'LoanApplication',
  loanApplicationSchema,
);
