export interface LocalGovernment {
  name: string;
  code?: string;
}

export interface State {
  name: string;
  capital: string;
  code: string;
  lgas: LocalGovernment[];
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export enum Role {
  ADMIN = 'admin',
  LOAN_OFFICER = 'loan_officer',
  FINANCE = 'finance',
  APPLICANT = 'applicant',
}

export enum Permission {
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',

  LOAN_CREATE = 'loan:create',
  LOAN_READ = 'loan:read',
  LOAN_UPDATE = 'loan:update',
  LOAN_DELETE = 'loan:delete',
  LOAN_APPROVE = 'loan:approve',
  LOAN_REJECT = 'loan:reject',
  LOAN_DISBURSE = 'loan:disburse',

  PAYMENT_CREATE = 'payment:create',
  PAYMENT_READ = 'payment:read',
  PAYMENT_UPDATE = 'payment:update',

  REPORT_READ = 'report:read',
}
