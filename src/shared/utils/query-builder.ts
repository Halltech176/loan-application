import { FilterQuery, SortOrder } from 'mongoose';

export interface QueryOptions {
  page?: number;
  limit?: number;
  sort?: string;
  fields?: string;
  search?: string;
  filters?: Record<string, any>;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export class QueryBuilder<T> {
  private query: FilterQuery<T> = {};
  private sortOptions: { [key: string]: SortOrder } = {};
  private selectFields: string = '';
  private pageNum: number = 1;
  private limitNum: number = 10;

  constructor(private options: QueryOptions) {
    this.buildQuery();
  }

  private buildQuery(): void {
    if (this.options.filters) {
      this.query = { ...this.query, ...this.options.filters };
    }

    if (this.options.search) {
      this.query = { ...this.query };
    }

    if (this.options.sort) {
      const sortFields = this.options.sort.split(',');
      sortFields.forEach(field => {
        const order = field.startsWith('-') ? -1 : 1;
        const fieldName = field.replace('-', '');
        this.sortOptions[fieldName] = order;
      });
    } else {
      this.sortOptions = { createdAt: -1 };
    }

    if (this.options.fields) {
      this.selectFields = this.options.fields.split(',').join(' ');
    }

    if (this.options.page) {
      this.pageNum = Math.max(1, this.options.page);
    }

    if (this.options.limit) {
      this.limitNum = Math.min(100, Math.max(1, this.options.limit));
    }
  }

  public getFilter(): FilterQuery<T> {
    return this.query;
  }

  public getSort(): { [key: string]: SortOrder } {
    return this.sortOptions;
  }

  public getSelect(): string {
    return this.selectFields;
  }

  public getSkip(): number {
    return (this.pageNum - 1) * this.limitNum;
  }

  public getLimit(): number {
    return this.limitNum;
  }

  public getPage(): number {
    return this.pageNum;
  }

  public buildPaginatedResult(data: T[], total: number): PaginatedResult<T> {
    const totalPages = Math.ceil(total / this.limitNum);

    return {
      data,
      meta: {
        total,
        page: this.pageNum,
        limit: this.limitNum,
        totalPages,
        hasNextPage: this.pageNum < totalPages,
        hasPrevPage: this.pageNum > 1,
      },
    };
  }
}
