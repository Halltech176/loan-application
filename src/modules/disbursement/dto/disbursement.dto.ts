import { IsNumber, IsObject, Min, IsMongoId } from 'class-validator';
import { Types } from 'mongoose';

export class CreateDisbursementDto {
  @IsMongoId()
  loanApplicationId!: Types.ObjectId;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsObject()
  recipientAccount!: {
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankCode: string;
  };
}
