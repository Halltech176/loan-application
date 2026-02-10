import { RepaymentScheduleModel, IRepaymentSchedule } from './repayment-schedule.model';
import { QueryBuilder, QueryOptions, PaginatedResult } from '../../shared/utils/query-builder';

export class RepaymentScheduleRepository {
  public async create(data: Partial<IRepaymentSchedule>): Promise<IRepaymentSchedule> {
    const entity = new RepaymentScheduleModel(data);
    return await entity.save();
  }

  public async findById(id: string): Promise<IRepaymentSchedule | null> {
    return await RepaymentScheduleModel.findById(id);
  }

  public async findAll(options: QueryOptions): Promise<PaginatedResult<IRepaymentSchedule>> {
    const queryBuilder = new QueryBuilder<IRepaymentSchedule>(options);

    const query = RepaymentScheduleModel.find(queryBuilder.getFilter())
      .sort(queryBuilder.getSort())
      .skip(queryBuilder.getSkip())
      .limit(queryBuilder.getLimit());

    if (queryBuilder.getSelect()) {
      query.select(queryBuilder.getSelect());
    }

    const [data, total] = await Promise.all([
      query.exec(),
      RepaymentScheduleModel.countDocuments(queryBuilder.getFilter()),
    ]);

    return queryBuilder.buildPaginatedResult(data, total);
  }

  public async findByLoanApplicationId(
    loanApplicationId: string,
  ): Promise<IRepaymentSchedule | null> {
    return await RepaymentScheduleModel.findOne({ loanApplicationId });
  }

  public async findOverdueSchedules(): Promise<IRepaymentSchedule[]> {
    const now = new Date();
    return await RepaymentScheduleModel.find({
      'installments.dueDate': { $lt: now },
      'installments.status': { $in: ['pending', 'partially_paid'] },
    });
  }

  public async findUpcomingSchedules(daysAhead: number): Promise<IRepaymentSchedule[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    return await RepaymentScheduleModel.find({
      'installments.dueDate': { $gte: now, $lte: futureDate },
      'installments.status': 'pending',
    });
  }

  public async findDueTodaySchedules(): Promise<IRepaymentSchedule[]> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    return await RepaymentScheduleModel.find({
      'installments.dueDate': { $gte: startOfDay, $lt: endOfDay },
      'installments.status': 'pending',
    });
  }

  public async findUpcomingPayments(daysAhead: number): Promise<IRepaymentSchedule[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    return await RepaymentScheduleModel.find({
      'installments.dueDate': { $gte: now, $lte: futureDate },
      'installments.status': { $in: ['pending', 'partially_paid'] },
    });
  }

  public async update(
    id: string,
    updateData: Partial<IRepaymentSchedule>,
  ): Promise<IRepaymentSchedule | null> {
    return await RepaymentScheduleModel.findByIdAndUpdate(
      id,
      { $set: updateData, $inc: { version: 1 } },
      { new: true, runValidators: true },
    );
  }

  public async delete(id: string): Promise<boolean> {
    const result = await RepaymentScheduleModel.findByIdAndDelete(id);
    return result !== null;
  }
}
