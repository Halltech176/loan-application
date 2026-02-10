import mongoose, { Schema, Document } from 'mongoose';

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  BANK_TRANSFER = 'bank_transfer',
}

export interface IRepayment extends Document {
  id: string;
  loanApplicationId: string;
  amount: number;
  principalAmount: number;
  interestAmount: number;
  dueDate: Date;
  paidDate?: Date;
  status: PaymentStatus;
  paymentMethod?: PaymentMethod;
  transactionReference?: string;
  paidBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const repaymentSchema = new Schema<IRepayment>(
  {
    loanApplicationId: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
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
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    paidDate: Date,
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      default: PaymentMethod.BANK_TRANSFER,
    },
    transactionReference: String,
    paidBy: String,
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

export const RepaymentModel = mongoose.model<IRepayment>('Repayment', repaymentSchema);
