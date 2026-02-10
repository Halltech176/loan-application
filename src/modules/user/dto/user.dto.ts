import {
  IsEmail,
  IsString,
  IsBoolean,
  IsArray,
  IsOptional,
  MinLength,
  IsEnum,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^(\+234|0)[789][01]\d{8}$/, {
    message: 'Invalid Nigerian phone number format. Use format: +2348012345678 or 08012345678',
  })
  phoneNumber!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(['admin', 'loan_officer', 'finance', 'applicant'])
  role!: string;

  @IsArray()
  @IsOptional()
  permissions?: string[];
}

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEnum(['admin', 'loan_officer', 'finance', 'applicant'])
  @IsOptional()
  role?: string;

  @IsArray()
  @IsOptional()
  permissions?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
