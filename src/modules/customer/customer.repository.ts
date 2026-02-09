import { CustomerModel, ICustomer } from './customer.model';
import { QueryBuilder, QueryOptions, PaginatedResult } from '../../shared/utils/query-builder';

export class CustomerRepository {
  public async create(data: Partial<ICustomer>): Promise<ICustomer> {
    const entity = new CustomerModel(data);
    return await entity.save();
  }

  public async findById(id: string): Promise<ICustomer | null> {
    return await CustomerModel.findById(id);
  }

  public async findAll(options: QueryOptions): Promise<PaginatedResult<ICustomer>> {
    const queryBuilder = new QueryBuilder<ICustomer>(options);

    const query = CustomerModel.find(queryBuilder.getFilter())
      .sort(queryBuilder.getSort())
      .skip(queryBuilder.getSkip())
      .limit(queryBuilder.getLimit());

    if (queryBuilder.getSelect()) {
      query.select(queryBuilder.getSelect());
    }

    const [data, total] = await Promise.all([
      query.exec(),
      CustomerModel.countDocuments(queryBuilder.getFilter()),
    ]);

    return queryBuilder.buildPaginatedResult(data, total);
  }

  public async update(id: string, updateData: Partial<ICustomer>): Promise<ICustomer | null> {
    return await CustomerModel.findByIdAndUpdate(
      id,
      { $set: updateData, $inc: { version: 1 } },
      { new: true, runValidators: true }
    );
  }

  public async delete(id: string): Promise<boolean> {
    const result = await CustomerModel.findByIdAndDelete(id);
    return result !== null;
  }
}
