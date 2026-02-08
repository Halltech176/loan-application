import { UserModel, IUser } from './user.model';
import { QueryBuilder, QueryOptions, PaginatedResult } from '../../shared/utils/query-builder';

export class UserRepository {
  public async create(userData: Partial<IUser>): Promise<IUser> {
    const user = new UserModel(userData);
    return await user.save();
  }

  public async findById(id: string): Promise<IUser | null> {
    return await UserModel.findById(id);
  }

  public async findByEmail(email: string): Promise<IUser | null> {
    return await UserModel.findOne({ email: email.toLowerCase() });
  }

  public async findAll(options: QueryOptions): Promise<PaginatedResult<IUser>> {
    const queryBuilder = new QueryBuilder<IUser>(options);

    const query = UserModel.find(queryBuilder.getFilter())
      .sort(queryBuilder.getSort())
      .skip(queryBuilder.getSkip())
      .limit(queryBuilder.getLimit());

    if (queryBuilder.getSelect()) {
      query.select(queryBuilder.getSelect());
    }

    const [data, total] = await Promise.all([
      query.exec(),
      UserModel.countDocuments(queryBuilder.getFilter()),
    ]);

    return queryBuilder.buildPaginatedResult(data, total);
  }

  public async update(id: string, updateData: Partial<IUser>): Promise<IUser | null> {
    return await UserModel.findByIdAndUpdate(
      id,
      { $set: updateData, $inc: { version: 1 } },
      { new: true, runValidators: true }
    );
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
