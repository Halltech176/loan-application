import {
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
  IsDateString,
  IsString,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';
import { RepaymentFrequency } from '../repayment-schedule.model';

export class CreateRepaymentScheduleDto {
  @IsNotEmpty()
  @IsString()
  loanApplicationId!: Types.ObjectId;

  @IsNotEmpty()
  @IsString()
  disbursementId!: Types.ObjectId;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  principalAmount!: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  interestRate!: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  term!: number;

  @IsNotEmpty()
  @IsEnum(RepaymentFrequency)
  frequency!: RepaymentFrequency;

  @IsOptional()
  @IsDateString()
  startDate!: Date;
}

export class UpdateRepaymentScheduleDto {
  @IsOptional()
  @IsEnum(['active', 'completed', 'defaulted', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsDateString()
  lastPaymentDate?: Date;

  @IsOptional()
  @IsDateString()
  nextPaymentDate?: Date;

  @IsOptional()
  @IsArray()
  installments?: any[];

  @IsOptional()
  summary?: {
    paidAmount?: number;
    outstandingAmount?: number;
    completedInstallments?: number;
    overdueInstallments?: number;
  };
}

export class RecordPaymentDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsNotEmpty()
  @IsString()
  paymentReference!: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class EarlyRepaymentDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  paymentAmount!: number;

  @IsOptional()
  @IsBoolean()
  acceptPenalty?: boolean;
}
