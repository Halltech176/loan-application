import { RepaymentModel, IRepayment } from './repayment.model';
import { QueryBuilder, QueryOptions, PaginatedResult } from '../../shared/utils/query-builder';

export class RepaymentRepository {
  public async create(data: Partial<IRepayment>): Promise<IRepayment> {
    const repayment = new RepaymentModel(data);
    return await repayment.save();
  }

  public async findById(id: string): Promise<IRepayment | null> {
    return await RepaymentModel.findById(id);
  }

  public async findByLoanApplicationId(loanApplicationId: string, options: QueryOptions): Promise<PaginatedResult<IRepayment>> {
    const queryBuilder = new QueryBuilder<IRepayment>({
      ...options,
      filters: { ...options.filters, loanApplicationId },
    });

    const query = RepaymentModel.find(queryBuilder.getFilter())
      .sort(queryBuilder.getSort())
      .skip(queryBuilder.getSkip())
      .limit(queryBuilder.getLimit());

    const [data, total] = await Promise.all([
      query.exec(),
      RepaymentModel.countDocuments(queryBuilder.getFilter()),
    ]);

    return queryBuilder.buildPaginatedResult(data, total);
  }

  public async update(id: string, updateData: Partial<IRepayment>): Promise<IRepayment | null> {
    return await RepaymentModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
  }
}
