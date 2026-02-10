import { UserModel, IUser } from './user.model';
import { QueryBuilder, QueryOptions, PaginatedResult } from '../../shared/utils/query-builder';
import { PopulateOptions, Query } from 'mongoose';

export type PopulateOption = string | PopulateOptions | (string | PopulateOptions)[];

export interface ExtendedQueryOptions extends QueryOptions {
  populate?: PopulateOption;
}

export class UserRepository {
  private applyPopulate<T>(query: Query<T, any>, populate?: PopulateOption): Query<T, any> {
    if (!populate) return query;

    if (Array.isArray(populate)) {
      return query.populate(populate);
    }

    return query.populate(populate as any);
  }

  public async create(userData: Partial<IUser>): Promise<IUser> {
    const user = new UserModel(userData);
    return await user.save();
  }

  public async findById(id: string, populate?: PopulateOption): Promise<IUser | null> {
    const query = UserModel.findById(id);
    return await this.applyPopulate(query, populate).exec();
  }

  public async findByEmail(email: string, populate?: PopulateOption): Promise<IUser | null> {
    const query = UserModel.findOne({ email: email.toLowerCase() });
    return await this.applyPopulate(query, populate).exec();
  }

  public async findAll(options: ExtendedQueryOptions): Promise<PaginatedResult<IUser>> {
    const queryBuilder = new QueryBuilder<IUser>(options);

    let query = UserModel.find(queryBuilder.getFilter())
      .sort(queryBuilder.getSort())
      .skip(queryBuilder.getSkip())
      .limit(queryBuilder.getLimit());

    if (queryBuilder.getSelect()) {
      query.select(queryBuilder.getSelect());
    }

    query = this.applyPopulate(query, options.populate) as any;

    const [data, total] = await Promise.all([
      query.exec(),
      UserModel.countDocuments(queryBuilder.getFilter()),
    ]);

    return queryBuilder.buildPaginatedResult(data, total);
  }

  public async update(
    id: string,
    updateData: Partial<IUser>,
    populate?: PopulateOption,
  ): Promise<IUser | null> {
    const query = UserModel.findByIdAndUpdate(
      id,
      { $set: updateData, $inc: { version: 1 } },
      { new: true, runValidators: true },
    );

    return await this.applyPopulate(query, populate).exec();
  }

  public async delete(id: string): Promise<boolean> {
    const result = await UserModel.findByIdAndDelete(id);
    return result !== null;
  }

  public async addRefreshToken(userId: string, token: string): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $push: { refreshTokens: token },
    });
  }

  public async removeRefreshToken(userId: string, token: string): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $pull: { refreshTokens: token },
    });
  }

  public async removeAllRefreshTokens(userId: string): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $set: { refreshTokens: [] },
    });
  }

  public async incrementFailedLoginAttempts(userId: string): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $inc: { failedLoginAttempts: 1 },
    });
  }

  public async resetFailedLoginAttempts(userId: string): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $set: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  public async lockAccount(userId: string, until: Date): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $set: { lockedUntil: until },
    });
  }

  public async updateLastLogin(userId: string): Promise<void> {
    await UserModel.findByIdAndUpdate(userId, {
      $set: { lastLoginAt: new Date() },
    });
  }
}
