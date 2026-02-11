import { UserRole } from '@/modules/user/user.model';
import { Permission } from '@/types';

const permissionsMap: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    Permission.USER_CREATE,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.LOAN_CREATE,
    Permission.LOAN_READ,
    Permission.LOAN_UPDATE,
    Permission.LOAN_DELETE,
    Permission.LOAN_APPROVE,
    Permission.LOAN_REJECT,
    Permission.LOAN_DISBURSE,
    Permission.PAYMENT_CREATE,
    Permission.PAYMENT_READ,
    Permission.PAYMENT_UPDATE,
    Permission.REPORT_READ,
  ],

  [UserRole.LOAN_OFFICER]: [
    Permission.USER_READ,
    Permission.LOAN_CREATE,
    Permission.LOAN_READ,
    Permission.LOAN_UPDATE,
    Permission.LOAN_APPROVE,
    Permission.LOAN_REJECT,
    Permission.PAYMENT_READ,
    Permission.REPORT_READ,
  ],

  [UserRole.FINANCE]: [
    Permission.LOAN_READ,
    Permission.LOAN_DISBURSE,
    Permission.PAYMENT_CREATE,
    Permission.PAYMENT_READ,
    Permission.PAYMENT_UPDATE,
    Permission.REPORT_READ,
  ],

  [UserRole.CUSTOMER]: [Permission.LOAN_CREATE, Permission.LOAN_READ, Permission.PAYMENT_READ],
};

export const getPermissionsForRole = (role: UserRole): Permission[] => {
  return permissionsMap[role] ?? [];
};
