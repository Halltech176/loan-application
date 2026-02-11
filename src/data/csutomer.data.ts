import { Types } from 'mongoose';
import {
  EmploymentStatus,
  Gender,
  IdentificationType,
  MaritalStatus,
} from '@/modules/customer/customer.model';

const randomNumber = (length: number) =>
  Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');

const randomFromEnum = <T>(enumObj: T): T[keyof T] => {
  const values = Object.values(enumObj as any);
  return values[Math.floor(Math.random() * values.length)] as T[keyof T];
};

const randomPhone = (): string => {
  const firstDigit = [7, 8, 9][Math.floor(Math.random() * 3)];

  const secondDigit = [0, 1][Math.floor(Math.random() * 2)];

  const lastEight = randomNumber(8);

  return `0${firstDigit}${secondDigit}${lastEight}`;
};

const randomDateOfBirth = () => {
  const today = new Date();
  const minAge = 25;
  const maxAge = 45;

  const year = today.getFullYear() - (Math.floor(Math.random() * (maxAge - minAge)) + minAge);

  return new Date(year, 5, 15);
};

export const generateCustomerData = (userId: Types.ObjectId) => {
  const idType = IdentificationType.NIN;

  return {
    userId,

    personalInformation: {
      firstName: 'Auto',
      lastName: 'Generated',
      dateOfBirth: randomDateOfBirth(),
      gender: randomFromEnum(Gender),
      maritalStatus: randomFromEnum(MaritalStatus),
      alternativePhoneNumber: randomPhone(),
    },

    address: {
      street: '12 Admiralty Way',
      city: 'Lekki',
      lga: 'Eti-Osa',
      state: 'Lagos',
      landmark: 'Near Shoprite',
    },

    identification: {
      type: idType,
      number: randomNumber(11), // Valid NIN
      issueDate: new Date('2020-01-01'),
      expiryDate: new Date('2035-01-01'),
    },

    employment: {
      status: EmploymentStatus.EMPLOYED,
      employer: 'Tech Corp Ltd',
      occupation: 'Software Engineer',
      industry: 'Technology',
      employmentDate: new Date('2022-01-01'),
      monthlyIncome: Math.floor(Math.random() * 500000) + 150000,
      officeAddress: 'Victoria Island, Lagos',
      officePhone: randomPhone(),
    },

    bankDetails: {
      accountName: 'AUTO GENERATED',
      accountNumber: randomNumber(10),
      bankName: 'Access Bank',
      bankCode: '044',
      bvn: randomNumber(11),
    },

    nextOfKin: {
      firstName: 'Jane',
      lastName: 'Doe',
      relationship: 'Sister',
      phoneNumber: randomPhone(),
      email: 'janedoe@example.com',
      address: 'Abuja, Nigeria',
    },

    isVerified: true,
    verificationDate: new Date(),
    kycLevel: 3,
  };
};
