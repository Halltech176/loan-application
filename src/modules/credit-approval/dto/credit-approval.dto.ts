import { IsNumber, IsString, IsEnum, IsArray, IsOptional, Min, Max } from 'class-validator';
import { CreditDecision } from '../credit-approval.model';
import { Types } from 'mongoose';

export class CreateCreditApprovalDto {
  @IsString()
  loanApplicationId!: Types.ObjectId;

  @IsNumber()
  @Min(300)
  @Max(850)
  creditScore!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  debtToIncomeRatio!: number;

  @IsEnum(CreditDecision)
  decision!: CreditDecision;

  @IsNumber()
  @IsOptional()
  approvedAmount?: number;

  @IsNumber()
  @IsOptional()
  approvedInterestRate?: number;

  @IsNumber()
  @IsOptional()
  approvedTerm?: number;

  @IsArray()
  @IsOptional()
  conditions?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}
