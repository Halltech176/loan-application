import { LoanApplicationModel, ILoanApplication, LoanStatus } from './loan-application.model';
import { QueryBuilder, QueryOptions, PaginatedResult } from '../../shared/utils/query-builder';
import { Types } from 'mongoose';

export class LoanApplicationRepository {
  public async create(data: Partial<ILoanApplication>): Promise<ILoanApplication> {
    const loan = new LoanApplicationModel(data);
    return await loan.save();
  }

  public async findById(id: Types.ObjectId): Promise<ILoanApplication | null> {
    return await LoanApplicationModel.findById(id);
  }

  public async findByApplicantId(
    applicantId: Types.ObjectId,
    options: QueryOptions,
  ): Promise<PaginatedResult<ILoanApplication>> {
    const queryBuilder = new QueryBuilder<ILoanApplication>({
      ...options,
      filters: { ...options.filters, applicantId },
    });

    const query = LoanApplicationModel.find(queryBuilder.getFilter())
      .sort(queryBuilder.getSort())
      .skip(queryBuilder.getSkip())
      .limit(queryBuilder.getLimit());

    const [data, total] = await Promise.all([
      query.exec(),
      LoanApplicationModel.countDocuments(queryBuilder.getFilter()),
    ]);

    return queryBuilder.buildPaginatedResult(data, total);
  }

  public async findAll(options: QueryOptions): Promise<PaginatedResult<ILoanApplication>> {
    const queryBuilder = new QueryBuilder<ILoanApplication>(options);

    const query = LoanApplicationModel.find(queryBuilder.getFilter())
      .sort(queryBuilder.getSort())
      .skip(queryBuilder.getSkip())
      .limit(queryBuilder.getLimit());

    const [data, total] = await Promise.all([
      query.exec(),
      LoanApplicationModel.countDocuments(queryBuilder.getFilter()),
    ]);

    return queryBuilder.buildPaginatedResult(data, total);
  }

  public async update(
    id: Types.ObjectId,
    updateData: Partial<ILoanApplication>,
  ): Promise<ILoanApplication | null> {
    return await LoanApplicationModel.findByIdAndUpdate(
      id,
      { $set: updateData, $inc: { version: 1 } },
      { new: true, runValidators: true },
    );
  }

  public async updateStatus(
    id: Types.ObjectId,
    status: LoanStatus,
    changedBy: Types.ObjectId,
    reason?: string,
  ): Promise<ILoanApplication | null> {
    return await LoanApplicationModel.findByIdAndUpdate(
      id,
      {
        $set: { status },
        $push: {
          statusHistory: {
            status,
            changedBy,
            changedAt: new Date(),
            reason,
          },
        },
        $inc: { version: 1 },
      },
      { new: true, runValidators: true },
    );
  }

  public async delete(id: Types.ObjectId): Promise<boolean> {
    const result = await LoanApplicationModel.findByIdAndDelete(id);
    return result !== null;
  }

  public async countByStatus(status: LoanStatus): Promise<number> {
    return await LoanApplicationModel.countDocuments({ status });
  }
}
