import { IsString, IsNumber, IsDate, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRepaymentDto {
  @IsString()
  loanApplicationId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsNumber()
  @Min(0)
  principalAmount!: number;

  @IsNumber()
  @Min(0)
  interestAmount!: number;

  @IsDate()
  @Type(() => Date)
  dueDate!: Date;
}

export class RecordPaymentDto {
  @IsString()
  loanApplicationId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  @IsOptional()
  transactionReference?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
