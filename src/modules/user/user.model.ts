import mongoose, { Schema, Document } from 'mongoose';
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
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  status: string;
  emailVerified: boolean;
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
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
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
