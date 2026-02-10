import mongoose, { Schema, Document, Types } from 'mongoose';

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export enum MaritalStatus {
  SINGLE = 'single',
  MARRIED = 'married',
  DIVORCED = 'divorced',
  WIDOWED = 'widowed',
}

export enum EmploymentStatus {
  EMPLOYED = 'employed',
  SELF_EMPLOYED = 'self_employed',
  UNEMPLOYED = 'unemployed',
  STUDENT = 'student',
  RETIRED = 'retired',
}

export enum IdentificationType {
  NIN = 'nin',
  VOTERS_CARD = 'voters_card',
  DRIVERS_LICENSE = 'drivers_license',
  INTERNATIONAL_PASSPORT = 'international_passport',
}

export interface ICustomer extends Document {
  id: string;
  userId: Types.ObjectId;

  personalInformation: {
    firstName: string;
    lastName: string;
    middleName?: string;
    dateOfBirth: Date;
    gender: Gender;
    maritalStatus: MaritalStatus;
    alternativePhoneNumber?: string;
  };

  address: {
    street: string;
    city: string;
    lga: string;
    state: string;
    landmark?: string;
  };

  identification: {
    type: IdentificationType;
    number: string;
    issueDate?: Date;
    expiryDate?: Date;
    documentUrl?: string;
  };

  employment: {
    status: EmploymentStatus;
    employer?: string;
    occupation?: string;
    industry?: string;
    employmentDate?: Date;
    monthlyIncome?: number;
    officeAddress?: string;
    officePhone?: string;
  };

  bankDetails: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    bankCode: string;
    bvn: string;
  };

  nextOfKin: {
    firstName: string;
    lastName: string;
    relationship: string;
    phoneNumber: string;
    email?: string;
    address?: string;
  };

  profilePhoto?: string;
  isVerified: boolean;
  verificationDate?: Date;
  kycLevel: number;

  createdAt: Date;
  updatedAt: Date;
  version: number;
}

const customerSchema = new Schema<ICustomer>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
      ref: 'User',
    },

    personalInformation: {
      firstName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50,
      },
      lastName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50,
      },
      middleName: {
        type: String,
        trim: true,
        maxlength: 50,
      },
      dateOfBirth: {
        type: Date,
        required: true,
        validate: {
          validator: function (value: Date) {
            const today = new Date();
            const age = today.getFullYear() - value.getFullYear();
            const monthDiff = today.getMonth() - value.getMonth();
            const dayDiff = today.getDate() - value.getDate();

            let actualAge = age;
            if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
              actualAge--;
            }

            return actualAge >= 18 && actualAge <= 100;
          },
          message: 'Customer must be between 18 and 100 years old',
        },
      },
      gender: {
        type: String,
        required: true,
        enum: Object.values(Gender),
      },
      maritalStatus: {
        type: String,
        required: true,
        enum: Object.values(MaritalStatus),
      },

      alternativePhoneNumber: {
        type: String,
        validate: {
          validator: function (value: string) {
            if (!value) return true;
            return /^(\+234|0)[789][01]\d{8}$/.test(value);
          },
          message: 'Invalid Nigerian phone number format',
        },
      },
    },

    address: {
      street: {
        type: String,
        required: true,
        trim: true,
        minlength: 5,
        maxlength: 200,
      },
      city: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50,
      },
      lga: {
        type: String,
        required: true,
        trim: true,
      },
      state: {
        type: String,
        required: true,
        trim: true,
      },
      country: {
        type: String,
        default: 'Nigeria',
      },
      landmark: {
        type: String,
        trim: true,
        maxlength: 100,
      },
    },

    identification: {
      type: {
        type: String,
        required: true,
        enum: Object.values(IdentificationType),
      },
      number: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        validate: {
          validator: function (value: string) {
            const doc = this as any;
            const idType = doc.identification?.type;

            if (idType === IdentificationType.NIN) {
              return /^\d{11}$/.test(value);
            }
            if (idType === IdentificationType.VOTERS_CARD) {
              return /^[A-Z0-9]{19}$/.test(value);
            }
            if (idType === IdentificationType.DRIVERS_LICENSE) {
              return /^[A-Z]{3}\s?[A-Z0-9]{6,12}$/.test(value);
            }
            if (idType === IdentificationType.INTERNATIONAL_PASSPORT) {
              return /^[A-Z]\d{8}$/.test(value);
            }
            return true;
          },
          message: 'Invalid identification number format',
        },
      },
      issueDate: Date,
      expiryDate: {
        type: Date,
        validate: {
          validator: function (value: Date) {
            if (!value) return true;
            return value > new Date();
          },
          message: 'Identification document has expired',
        },
      },
      documentUrl: String,
    },

    employment: {
      status: {
        type: String,
        required: true,
        enum: Object.values(EmploymentStatus),
      },
      employer: {
        type: String,
        trim: true,
        maxlength: 100,
      },
      occupation: {
        type: String,
        trim: true,
        maxlength: 100,
      },
      industry: {
        type: String,
        trim: true,
        maxlength: 50,
      },
      employmentDate: Date,
      monthlyIncome: {
        type: Number,
        min: 0,
        validate: {
          validator: function (value: number) {
            if (!value) return true;
            return value >= 0 && value <= 100000000;
          },
          message: 'Monthly income must be a reasonable amount',
        },
      },
      officeAddress: {
        type: String,
        trim: true,
        maxlength: 200,
      },
      officePhone: {
        type: String,
        validate: {
          validator: function (value: string) {
            if (!value) return true;
            return /^(\+234|0)[789][01]\d{8}$/.test(value);
          },
          message: 'Invalid Nigerian phone number format',
        },
      },
    },

    bankDetails: {
      accountName: {
        type: String,
        required: true,
        trim: true,
        uppercase: true,
        minlength: 3,
        maxlength: 100,
      },
      accountNumber: {
        type: String,
        required: true,
        validate: {
          validator: function (value: string) {
            return /^\d{10}$/.test(value);
          },
          message: 'Account number must be 10 digits',
        },
      },
      bankName: {
        type: String,
        required: true,
        trim: true,
      },
      bankCode: {
        type: String,
        required: true,
        validate: {
          validator: function (value: string) {
            return /^\d{3}$/.test(value);
          },
          message: 'Bank code must be 3 digits',
        },
      },
      bvn: {
        type: String,
        required: true,
        unique: true,
        validate: {
          validator: function (value: string) {
            return /^\d{11}$/.test(value);
          },
          message: 'BVN must be 11 digits',
        },
      },
    },

    nextOfKin: {
      firstName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50,
      },
      lastName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50,
      },
      relationship: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50,
      },
      phoneNumber: {
        type: String,
        required: true,
        validate: {
          validator: function (value: string) {
            return /^(\+234|0)[789][01]\d{8}$/.test(value);
          },
          message: 'Invalid Nigerian phone number format',
        },
      },
      email: {
        type: String,
        lowercase: true,
        trim: true,
        validate: {
          validator: function (value: string) {
            if (!value) return true;
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
          },
          message: 'Invalid email format',
        },
      },
      address: {
        type: String,
        trim: true,
        maxlength: 200,
      },
    },

    profilePhoto: String,

    isVerified: {
      type: Boolean,
      default: true,
      index: true,
    },

    verificationDate: Date,

    kycLevel: {
      type: Number,
      default: 3,
      min: 0,
      max: 3,
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

customerSchema.index({ userId: 1, isVerified: 1 });
customerSchema.index({ createdAt: -1 });

customerSchema.virtual('age').get(function () {
  const today = new Date();
  const birthDate = new Date(this.personalInformation.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
});

customerSchema.virtual('fullName').get(function () {
  const { firstName, middleName, lastName } = this.personalInformation;
  return middleName ? `${firstName} ${middleName} ${lastName}` : `${firstName} ${lastName}`;
});

export const CustomerModel = mongoose.model<ICustomer>('Customer', customerSchema);
