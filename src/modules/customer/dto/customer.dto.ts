import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsDate,
  IsNumber,
  IsBoolean,
  ValidateNested,
  IsObject,
  MinLength,
  MaxLength,
  Matches,
  Min,
  Max,
  IsNotEmpty,
  ValidationOptions,
  registerDecorator,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  Gender,
  MaritalStatus,
  EmploymentStatus,
  IdentificationType,
} from '@modules/customer/customer.model';
import { getLGAsByState, getStateByName } from '@/shared/utils/location';

export function IsValidState(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidState',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (!value) return false;
          return !!getStateByName(value);
        },
        defaultMessage() {
          return 'Invalid Nigerian state';
        },
      },
    });
  };
}

export function IsValidLGA(stateField: string, validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidLGA',
      target: object.constructor,
      propertyName,
      constraints: [stateField],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedStateField] = args.constraints;
          const stateName = (args.object as any)[relatedStateField];

          if (!value || !stateName) return false;

          const lgas = getLGAsByState(stateName);
          return lgas.some((lga) => lga.name.toLowerCase() === value.toLowerCase());
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedStateField] = args.constraints;
          return `Invalid LGA for selected ${relatedStateField}`;
        },
      },
    });
  };
}

export class PersonalInformationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  lastName!: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  middleName?: string;

  @IsDate()
  @Type(() => Date)
  dateOfBirth!: Date;

  @IsEnum(Gender)
  gender!: Gender;

  @IsEnum(MaritalStatus)
  maritalStatus!: MaritalStatus;

  @IsString()
  @IsOptional()
  @Matches(/^(\+234|0)[789][01]\d{8}$/, {
    message: 'Invalid Nigerian phone number format. Use format: +2348012345678 or 08012345678',
  })
  alternativePhoneNumber?: string;
}

export class AddressDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(200)
  street!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  city!: string;

  @IsNotEmpty()
  @IsString()
  @IsValidState({ message: 'State is not a valid Nigerian state' })
  state!: string;

  @IsNotEmpty()
  @IsString()
  @IsValidLGA('state', { message: 'LGA is not valid for the selected state' })
  lga!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  landmark?: string;
}

export class IdentificationDto {
  @IsEnum(IdentificationType)
  type!: IdentificationType;

  @IsString()
  @IsNotEmpty()
  number!: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  issueDate?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  expiryDate?: Date;

  @IsString()
  @IsOptional()
  documentUrl?: string;
}

export class EmploymentDto {
  @IsEnum(EmploymentStatus)
  status!: EmploymentStatus;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  employer?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  occupation?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  industry?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  employmentDate?: Date;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100000000)
  monthlyIncome?: number;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  officeAddress?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(\+234|0)[789][01]\d{8}$/, {
    message: 'Invalid Nigerian phone number format',
  })
  officePhone?: string;
}

export class BankDetailsDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  accountName!: string;

  @IsString()
  @Matches(/^\d{10}$/, {
    message: 'Account number must be exactly 10 digits',
  })
  accountNumber!: string;

  @IsString()
  @IsNotEmpty()
  bankName!: string;

  @IsString()
  @Matches(/^\d{3}$/, {
    message: 'Bank code must be exactly 3 digits',
  })
  bankCode!: string;

  @IsString()
  @Matches(/^\d{11}$/, {
    message: 'BVN must be exactly 11 digits',
  })
  bvn!: string;
}

export class NextOfKinDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  relationship!: string;

  @IsString()
  @Matches(/^(\+234|0)[789][01]\d{8}$/, {
    message: 'Invalid Nigerian phone number format. Use format: +2348012345678 or 08012345678',
  })
  phoneNumber!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  address?: string;
}

export class CreateCustomerDto {
  @IsObject()
  @ValidateNested()
  @Type(() => PersonalInformationDto)
  personalInformation!: PersonalInformationDto;

  @IsObject()
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @IsObject()
  @ValidateNested()
  @Type(() => IdentificationDto)
  identification!: IdentificationDto;

  @IsObject()
  @ValidateNested()
  @Type(() => EmploymentDto)
  employment!: EmploymentDto;

  @IsObject()
  @ValidateNested()
  @Type(() => BankDetailsDto)
  bankDetails!: BankDetailsDto;

  @IsObject()
  @ValidateNested()
  @Type(() => NextOfKinDto)
  nextOfKin!: NextOfKinDto;

  @IsString()
  @IsOptional()
  profilePhoto?: string;
}

export class UpdatePersonalInformationDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  lastName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  middleName?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  dateOfBirth?: Date;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsEnum(MaritalStatus)
  @IsOptional()
  maritalStatus?: MaritalStatus;

  @IsString()
  @IsOptional()
  @Matches(/^(\+234|0)[789][01]\d{8}$/, {
    message: 'Invalid Nigerian phone number format',
  })
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(\+234|0)[789][01]\d{8}$/, {
    message: 'Invalid Nigerian phone number format',
  })
  alternativePhoneNumber?: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}

export class UpdateAddressDto {
  @IsString()
  @IsOptional()
  @MinLength(5)
  @MaxLength(200)
  street?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  city?: string;

  @IsString()
  @IsOptional()
  @IsValidState({ message: 'State is not a valid Nigerian state' })
  state?: string;

  @IsString()
  @IsOptional()
  @IsValidLGA('state', { message: 'LGA is not valid for the selected state' })
  lga?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  landmark?: string;
}

export class UpdateIdentificationDto {
  @IsEnum(IdentificationType)
  @IsOptional()
  type?: IdentificationType;

  @IsString()
  @IsOptional()
  number?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  issueDate?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  expiryDate?: Date;

  @IsString()
  @IsOptional()
  documentUrl?: string;
}

export class UpdateEmploymentDto {
  @IsEnum(EmploymentStatus)
  @IsOptional()
  status?: EmploymentStatus;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  employer?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  occupation?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  industry?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  employmentDate?: Date;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100000000)
  monthlyIncome?: number;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  officeAddress?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(\+234|0)[789][01]\d{8}$/, {
    message: 'Invalid Nigerian phone number format',
  })
  officePhone?: string;
}

export class UpdateBankDetailsDto {
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(100)
  accountName?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{10}$/, {
    message: 'Account number must be exactly 10 digits',
  })
  accountNumber?: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{3}$/, {
    message: 'Bank code must be exactly 3 digits',
  })
  bankCode?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{11}$/, {
    message: 'BVN must be exactly 11 digits',
  })
  bvn?: string;
}

export class UpdateNextOfKinDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  lastName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  relationship?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(\+234|0)[789][01]\d{8}$/, {
    message: 'Invalid Nigerian phone number format',
  })
  phoneNumber?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  address?: string;
}

export class UpdateCustomerDto {
  @IsObject()
  @ValidateNested()
  @Type(() => UpdatePersonalInformationDto)
  @IsOptional()
  personalInformation?: UpdatePersonalInformationDto;

  @IsObject()
  @ValidateNested()
  @Type(() => UpdateAddressDto)
  @IsOptional()
  address?: UpdateAddressDto;

  @IsObject()
  @ValidateNested()
  @Type(() => UpdateIdentificationDto)
  @IsOptional()
  identification?: UpdateIdentificationDto;

  @IsObject()
  @ValidateNested()
  @Type(() => UpdateEmploymentDto)
  @IsOptional()
  employment?: UpdateEmploymentDto;

  @IsObject()
  @ValidateNested()
  @Type(() => UpdateBankDetailsDto)
  @IsOptional()
  bankDetails?: UpdateBankDetailsDto;

  @IsObject()
  @ValidateNested()
  @Type(() => UpdateNextOfKinDto)
  @IsOptional()
  nextOfKin?: UpdateNextOfKinDto;

  @IsString()
  @IsOptional()
  profilePhoto?: string;
}

export class VerifyCustomerDto {
  @IsBoolean()
  isVerified!: boolean;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  verificationDate?: Date;

  @IsNumber()
  @Min(0)
  @Max(3)
  kycLevel!: number;
}
