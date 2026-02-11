import mongoose, { Schema, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export enum UserRole {
  ADMIN = 'admin',
  LOAN_OFFICER = 'loan_officer',
  FINANCE = 'finance',
  CUSTOMER = 'customer',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

export interface IUser extends Document {
  customerId?: Types.ObjectId;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  password: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  refreshTokens: string[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (value: string) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        },
        message: 'Invalid email format',
      },
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: function (value: string) {
          return /^\+?[1-9]\d{1,14}$/.test(value);
        },
        message: 'Invalid phone number format',
      },
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },

    role: {
      type: String,
      required: true,
      enum: Object.values(UserRole),
      default: UserRole.CUSTOMER,
    },
    permissions: [
      {
        type: String,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
    },
    refreshTokens: [
      {
        type: String,
      },
    ],
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
        const { _id, __v, password, refreshTokens, ...rest } = ret;
        return {
          id: _id.toString(),
          ...rest,
        };
      },
    },
  },
);

// userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error as Error);
  }
});

userSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() as any;

  if (update.password || (update.$set && update.$set.password)) {
    try {
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
      const passwordToHash = update.password || update.$set.password;

      const hashedPassword = await bcrypt.hash(passwordToHash, saltRounds);

      if (update.password) {
        update.password = hashedPassword;
      } else {
        update.$set.password = hashedPassword;
      }

      next();
    } catch (error) {
      next(error as Error);
    }
  } else {
    next();
  }
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

export const UserModel = mongoose.model<IUser>('User', userSchema);
