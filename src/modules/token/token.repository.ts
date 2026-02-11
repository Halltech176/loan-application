import { TokenModel, IToken, TokenType } from './token.model';
import { QueryBuilder, QueryOptions, PaginatedResult } from '../../shared/utils/query-builder';

export class TokenRepository {
  public async create(data: Partial<IToken>): Promise<IToken> {
    const entity = new TokenModel(data);
    return await entity.save();
  }

  public async findById(id: string): Promise<IToken | null> {
    return await TokenModel.findById(id);
  }

  public async findByToken(token: string, type: TokenType): Promise<IToken | null> {
    return await TokenModel.findOne({
      token,
      type,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });
  }

  public async findByUserId(userId: string, type: TokenType): Promise<IToken[]> {
    return await TokenModel.find({
      userId,
      type,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });
  }

  public async findAll(options: QueryOptions): Promise<PaginatedResult<IToken>> {
    const queryBuilder = new QueryBuilder<IToken>(options);

    const query = TokenModel.find(queryBuilder.getFilter())
      .sort(queryBuilder.getSort())
      .skip(queryBuilder.getSkip())
      .limit(queryBuilder.getLimit());

    if (queryBuilder.getSelect()) {
      query.select(queryBuilder.getSelect());
    }

    const [data, total] = await Promise.all([
      query.exec(),
      TokenModel.countDocuments(queryBuilder.getFilter()),
    ]);

    return queryBuilder.buildPaginatedResult(data, total);
  }

  public async update(id: string, updateData: Partial<IToken>): Promise<IToken | null> {
    return await TokenModel.findByIdAndUpdate(
      id,
      { $set: updateData, $inc: { version: 1 } },
      { new: true, runValidators: true },
    );
  }

  public async markAsUsed(tokenId: string): Promise<IToken | null> {
    return await TokenModel.findByIdAndUpdate(
      tokenId,
      {
        $set: { isUsed: true, usedAt: new Date() },
        $inc: { version: 1 },
      },
      { new: true },
    );
  }

  public async invalidateUserTokens(userId: string, type: TokenType): Promise<void> {
    await TokenModel.updateMany(
      { userId, type, isUsed: false },
      { $set: { isUsed: true, usedAt: new Date() } },
    );
  }

  public async delete(id: string): Promise<boolean> {
    const result = await TokenModel.findByIdAndDelete(id);
    return result !== null;
  }

  public async deleteExpiredTokens(): Promise<number> {
    const result = await TokenModel.deleteMany({
      expiresAt: { $lt: new Date() },
    });
    return result.deletedCount || 0;
  }
}
