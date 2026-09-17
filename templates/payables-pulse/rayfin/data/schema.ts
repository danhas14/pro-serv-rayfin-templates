import { ApprovalEvent } from './ApprovalEvent.js';
import { AppUser } from './AppUser.js';
import { AuditEvent } from './AuditEvent.js';
import { Customer } from './Customer.js';
import { DailyOperationalMetric } from './DailyOperationalMetric.js';
import { ExceptionAssignment } from './ExceptionAssignment.js';
import { ExceptionCategory } from './ExceptionCategory.js';
import { ExceptionNote } from './ExceptionNote.js';
import { ExceptionStatusHistory } from './ExceptionStatusHistory.js';
import { Invoice } from './Invoice.js';
import { Payment } from './Payment.js';
import { PaymentAttempt } from './PaymentAttempt.js';
import { PaymentException } from './PaymentException.js';
import { PaymentMethodRule } from './PaymentMethodRule.js';
import { ResolutionCategory } from './ResolutionCategory.js';
import { ServiceLevelRule } from './ServiceLevelRule.js';
import { UserRoleAssignment } from './UserRoleAssignment.js';
import { Vendor } from './Vendor.js';

/**
 * Entity-name → model-type map consumed by `RayfinClient<PayablesSchema>` so
 * every query and mutation in the app is fully typed.
 */
export type PayablesSchema = {
  ApprovalEvent: ApprovalEvent;
  AppUser: AppUser;
  AuditEvent: AuditEvent;
  Customer: Customer;
  DailyOperationalMetric: DailyOperationalMetric;
  ExceptionAssignment: ExceptionAssignment;
  ExceptionCategory: ExceptionCategory;
  ExceptionNote: ExceptionNote;
  ExceptionStatusHistory: ExceptionStatusHistory;
  Invoice: Invoice;
  Payment: Payment;
  PaymentAttempt: PaymentAttempt;
  PaymentException: PaymentException;
  PaymentMethodRule: PaymentMethodRule;
  ResolutionCategory: ResolutionCategory;
  ServiceLevelRule: ServiceLevelRule;
  UserRoleAssignment: UserRoleAssignment;
  Vendor: Vendor;
};

export const schema = [
  ApprovalEvent,
  AppUser,
  AuditEvent,
  Customer,
  DailyOperationalMetric,
  ExceptionAssignment,
  ExceptionCategory,
  ExceptionNote,
  ExceptionStatusHistory,
  Invoice,
  Payment,
  PaymentAttempt,
  PaymentException,
  PaymentMethodRule,
  ResolutionCategory,
  ServiceLevelRule,
  UserRoleAssignment,
  Vendor,
];
