import {
  CUSTOMER_COLUMNS,
  EXCEPTION_CATEGORY_COLUMNS,
  METHOD_RULE_COLUMNS,
  RESOLUTION_CATEGORY_COLUMNS,
  ROLE_ASSIGNMENT_COLUMNS,
  SLA_RULE_COLUMNS,
  USER_COLUMNS,
  VENDOR_COLUMNS,
  type CustomerRow,
  type ExceptionCategoryRow,
  type MethodRuleRow,
  type ResolutionCategoryRow,
  type RoleAssignmentRow,
  type SlaRuleRow,
  type UserRow,
  type VendorRow,
} from './columns';
import { db, MAX_ROWS } from './dataUtils';

export async function listCustomers(): Promise<CustomerRow[]> {
  return db()
    .Customer.select([...CUSTOMER_COLUMNS])
    .orderBy({ name: 'asc' })
    .first(500)
    .execute();
}

export async function listVendors(): Promise<VendorRow[]> {
  return db()
    .Vendor.select([...VENDOR_COLUMNS])
    .orderBy({ name: 'asc' })
    .first(MAX_ROWS)
    .execute();
}

export async function listUsers(): Promise<UserRow[]> {
  return db()
    .AppUser.select([...USER_COLUMNS])
    .orderBy({ displayName: 'asc' })
    .first(500)
    .execute();
}

export async function listRoleAssignments(): Promise<RoleAssignmentRow[]> {
  return db()
    .UserRoleAssignment.select([...ROLE_ASSIGNMENT_COLUMNS])
    .orderBy({ assignedAt: 'desc' })
    .first(500)
    .execute();
}

export async function listExceptionCategories(): Promise<
  ExceptionCategoryRow[]
> {
  return db()
    .ExceptionCategory.select([...EXCEPTION_CATEGORY_COLUMNS])
    .orderBy({ sortOrder: 'asc' })
    .first(100)
    .execute();
}

export async function listResolutionCategories(): Promise<
  ResolutionCategoryRow[]
> {
  return db()
    .ResolutionCategory.select([...RESOLUTION_CATEGORY_COLUMNS])
    .orderBy({ sortOrder: 'asc' })
    .first(100)
    .execute();
}

export async function listServiceLevelRules(): Promise<SlaRuleRow[]> {
  return db()
    .ServiceLevelRule.select([...SLA_RULE_COLUMNS])
    .orderBy({ targetHours: 'asc' })
    .first(100)
    .execute();
}

export async function listPaymentMethodRules(): Promise<MethodRuleRow[]> {
  return db()
    .PaymentMethodRule.select([...METHOD_RULE_COLUMNS])
    .orderBy({ displayName: 'asc' })
    .first(100)
    .execute();
}
