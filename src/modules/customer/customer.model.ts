import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICustomer extends Document {
  id: string;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

const customerSchema = new Schema<ICustomer>(
  {
    version: {
      type: Number,
      default: 0,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
      ref: 'User',
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

// Add indexes here
// customerSchema.index({ fieldName: 1 });

export const CustomerModel = mongoose.model<ICustomer>('Customer', customerSchema);
