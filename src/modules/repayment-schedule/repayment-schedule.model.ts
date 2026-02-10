import mongoose, { Schema, Document, Types } from 'mongoose';

export enum RepaymentFrequency {
  WEEKLY = 'weekly',
  BI_WEEKLY = 'bi_weekly',
  MONTHLY = 'monthly',
}

export enum ScheduleStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  DEFAULTED = 'defaulted',
  CANCELLED = 'cancelled',
}

export interface IScheduleInstallment {
  installmentNumber: number;
  dueDate: Date;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: 'pending' | 'paid' | 'overdue' | 'partially_paid';
  paidDate?: Date;
  paymentReference?: string;
}

export interface IRepaymentSchedule extends Document {
  id: string;
  loanApplicationId: Types.ObjectId;
  disbursementId: Types.ObjectId;
  userId: Types.ObjectId;

  loanDetails: {
    principalAmount: number;
    interestRate: number;
    term: number;
    frequency: RepaymentFrequency;
  };

  installments: IScheduleInstallment[];

  summary: {
    totalPrincipal: number;
    totalInterest: number;
    totalAmount: number;
    paidAmount: number;
    outstandingAmount: number;
    numberOfInstallments: number;
    completedInstallments: number;
    overdueInstallments: number;
  };

  status: ScheduleStatus;
  startDate: Date;
  endDate: Date;
  lastPaymentDate?: Date;
  nextPaymentDate?: Date;

  earlyRepayment: {
    isEarlyRepayment: boolean;
    earlyRepaymentDate?: Date;
    earlyRepaymentAmount?: number;
    penaltyAmount?: number;
  };

  createdAt: Date;
  updatedAt: Date;
  version: number;
}

const scheduleInstallmentSchema = new Schema<IScheduleInstallment>(
  {
    installmentNumber: {
      type: Number,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    principalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    interestAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    outstandingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue', 'partially_paid'],
      default: 'pending',
    },
    paidDate: Date,
    paymentReference: String,
  },
  { _id: false },
);

const repaymentScheduleSchema = new Schema<IRepaymentSchedule>(
  {
    loanApplicationId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
      ref: 'LoanApplication',
    },
    disbursementId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: 'Disbursement',
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: 'User',
    },
    loanDetails: {
      principalAmount: {
        type: Number,
        required: true,
        min: 0,
      },
      interestRate: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },
      term: {
        type: Number,
        required: true,
        min: 1,
      },
      frequency: {
        type: String,
        enum: Object.values(RepaymentFrequency),
        required: true,
      },
    },
    installments: [scheduleInstallmentSchema],
    summary: {
      totalPrincipal: {
        type: Number,
        required: true,
        min: 0,
      },
      totalInterest: {
        type: Number,
        required: true,
        min: 0,
      },
      totalAmount: {
        type: Number,
        required: true,
        min: 0,
      },
      paidAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
      outstandingAmount: {
        type: Number,
        required: true,
        min: 0,
      },
      numberOfInstallments: {
        type: Number,
        required: true,
        min: 1,
      },
      completedInstallments: {
        type: Number,
        default: 0,
        min: 0,
      },
      overdueInstallments: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    status: {
      type: String,
      enum: Object.values(ScheduleStatus),
      default: ScheduleStatus.ACTIVE,
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    lastPaymentDate: Date,
    nextPaymentDate: Date,
    earlyRepayment: {
      isEarlyRepayment: {
        type: Boolean,
        default: false,
      },
      earlyRepaymentDate: Date,
      earlyRepaymentAmount: Number,
      penaltyAmount: Number,
    },
    version: {
      type: Number,
      default: 0,
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

repaymentScheduleSchema.index({ userId: 1, status: 1 });
repaymentScheduleSchema.index({ 'installments.dueDate': 1, 'installments.status': 1 });
repaymentScheduleSchema.index({ nextPaymentDate: 1 });

repaymentScheduleSchema.virtual('isOverdue').get(function () {
  return this.summary.overdueInstallments > 0;
});

repaymentScheduleSchema.virtual('completionPercentage').get(function () {
  if (this.summary.numberOfInstallments === 0) return 0;
  return (this.summary.completedInstallments / this.summary.numberOfInstallments) * 100;
});

export const RepaymentScheduleModel = mongoose.model<IRepaymentSchedule>(
  'RepaymentSchedule',
  repaymentScheduleSchema,
);
