import { IsEmail, IsString, IsBoolean, IsArray, IsOptional, MinLength, IsEnum } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

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
