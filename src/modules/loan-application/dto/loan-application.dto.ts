import { IsNumber, IsString, IsOptional, IsEnum, Min, Max, IsObject } from 'class-validator';
import { LoanPurpose } from '../loan-application.model';

export class CreateLoanApplicationDto {
  @IsNumber()
  @Min(1000)
  amount!: number;

  @IsString()
  @IsEnum(LoanPurpose)
  purpose!: LoanPurpose;

  @IsNumber()
  @Min(1)
  @Max(360)
  term!: number;

  @IsObject()
  @IsOptional()
  employmentDetails?: {
    employer: string;
    position: string;
    monthlyIncome: number;
    yearsEmployed: number;
  };

  @IsObject()
  @IsOptional()
  collateral?: {
    type: string;
    value: number;
    description: string;
  };
}

export class UpdateLoanApplicationDto {
  @IsNumber()
  @IsOptional()
  @Min(1000)
  amount?: number;

  @IsOptional()
  @IsEnum(LoanPurpose)
  purpose?: LoanPurpose;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(360)
  term?: number;

  @IsObject()
  @IsOptional()
  employmentDetails?: {
    employer: string;
    position: string;
    monthlyIncome: number;
    yearsEmployed: number;
  };

  @IsObject()
  @IsOptional()
  collateral?: {
    type: string;
    value: number;
    description: string;
  };
}

export class SubmitLoanApplicationDto {
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ReviewLoanApplicationDto {
  @IsString()
  reviewNotes!: string;

  @IsEnum(['approve', 'reject'])
  decision!: string;

  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
