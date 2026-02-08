import { Types } from 'mongoose';
import { DisbursementModel, IDisbursement } from './disbursement.model';

export class DisbursementRepository {
  public async create(data: Partial<IDisbursement>): Promise<IDisbursement> {
    const disbursement = new DisbursementModel(data);
    return await disbursement.save();
  }

  public async findById(id: Types.ObjectId): Promise<IDisbursement | null> {
    return await DisbursementModel.findById(id);
  }

  public async findByLoanApplicationId(
    loanApplicationId: Types.ObjectId,
  ): Promise<IDisbursement | null> {
    return await DisbursementModel.findOne({ loanApplicationId });
  }

  public async update(
    id: Types.ObjectId,
    updateData: Partial<IDisbursement>,
  ): Promise<IDisbursement | null> {
    return await DisbursementModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );
  }
}
