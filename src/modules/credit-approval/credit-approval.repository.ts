import { Types } from 'mongoose';
import { CreditApprovalModel, ICreditApproval } from './credit-approval.model';

export class CreditApprovalRepository {
  public async create(data: Partial<ICreditApproval>): Promise<ICreditApproval> {
    const approval = new CreditApprovalModel(data);
    return await approval.save();
  }

  public async findById(id: Types.ObjectId): Promise<ICreditApproval | null> {
    return await CreditApprovalModel.findById(id);
  }

  public async findByLoanApplicationId(
    loanApplicationId: Types.ObjectId,
  ): Promise<ICreditApproval | null> {
    return await CreditApprovalModel.findOne({ loanApplicationId });
  }

  public async update(
    id: Types.ObjectId,
    updateData: Partial<ICreditApproval>,
  ): Promise<ICreditApproval | null> {
    return await CreditApprovalModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );
  }
}
