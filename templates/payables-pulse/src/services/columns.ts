import type { ApprovalEvent } from '../../rayfin/data/ApprovalEvent';
import type { AppUser } from '../../rayfin/data/AppUser';
import type { AuditEvent } from '../../rayfin/data/AuditEvent';
import type { Customer } from '../../rayfin/data/Customer';
import type { DailyOperationalMetric } from '../../rayfin/data/DailyOperationalMetric';
import type { ExceptionAssignment } from '../../rayfin/data/ExceptionAssignment';
import type { ExceptionCategory } from '../../rayfin/data/ExceptionCategory';
import type { ExceptionNote } from '../../rayfin/data/ExceptionNote';
import type { ExceptionStatusHistory } from '../../rayfin/data/ExceptionStatusHistory';
import type { Invoice } from '../../rayfin/data/Invoice';
import type { Payment } from '../../rayfin/data/Payment';
import type { PaymentAttempt } from '../../rayfin/data/PaymentAttempt';
import type { PaymentException } from '../../rayfin/data/PaymentException';
import type { PaymentMethodRule } from '../../rayfin/data/PaymentMethodRule';
import type { ResolutionCategory } from '../../rayfin/data/ResolutionCategory';
import type { ServiceLevelRule } from '../../rayfin/data/ServiceLevelRule';
import type { UserRoleAssignment } from '../../rayfin/data/UserRoleAssignment';
import type { Vendor } from '../../rayfin/data/Vendor';

export const CUSTOMER_COLUMNS = [
  'id',
  'customerCode',
  'name',
  'industry',
  'country',
  'baseCurrency',
  'tier',
  'onboardedAt',
  'isActive',
  'paymentVolume90d',
  'paymentCount90d',
  'paymentSuccessRate',
  'stpRate',
  'avgApprovalHours',
  'avgResolutionHours',
  'exceptionRate',
  'rejectedRate',
  'virtualCardAdoption',
  'estimatedRebate',
  'healthScore',
  'riskLevel',
] as const;

export const VENDOR_COLUMNS = [
  'id',
  'vendorCode',
  'name',
  'category',
  'country',
  'currency',
  'remittanceEmail',
  'preferredPaymentMethod',
  'virtualCardEligible',
  'virtualCardEnrolled',
  'bankDetailsStatus',
  'lastPaymentAt',
  'paymentCount90d',
  'failedPaymentCount',
  'delayedPaymentCount',
  'duplicateInvoiceCount',
  'exceptionCount',
  'avgDaysToPay',
  'exceptionRecurrenceRate',
  'flaggedForReview',
  'reviewNote',
] as const;

export const INVOICE_COLUMNS = [
  'id',
  'invoiceNumber',
  'customer_id',
  'vendor_id',
  'amount',
  'currency',
  'invoiceDate',
  'dueDate',
  'status',
  'poNumber',
  'isDuplicateSuspect',
  'approvalHours',
  'createdAt',
] as const;

export const PAYMENT_COLUMNS = [
  'id',
  'paymentReference',
  'invoice_id',
  'customer_id',
  'vendor_id',
  'amount',
  'currency',
  'amountUsd',
  'paymentMethod',
  'status',
  'initiatedAt',
  'settledAt',
  'country',
  'isCrossBorder',
  'straightThrough',
  'attemptCount',
  'processingHours',
  'rebateEligible',
  'rebateAmount',
  'createdAt',
] as const;

export const PAYMENT_ATTEMPT_COLUMNS = [
  'id',
  'payment_id',
  'attemptNumber',
  'attemptedAt',
  'outcome',
  'responseCode',
  'responseMessage',
  'channel',
  'isSimulatedRetry',
] as const;

export const APPROVAL_EVENT_COLUMNS = [
  'id',
  'invoice_id',
  'stepNumber',
  'stepName',
  'approverName',
  'approverRole',
  'action',
  'occurredAt',
  'elapsedHours',
  'note',
] as const;

export const EXCEPTION_COLUMNS = [
  'id',
  'exceptionCode',
  'customer_id',
  'vendor_id',
  'invoice_id',
  'payment_id',
  'assignedTo_id',
  'resolutionCategory_id',
  'invoiceNumber',
  'paymentReference',
  'amount',
  'currency',
  'amountUsd',
  'paymentMethod',
  'exceptionType',
  'priority',
  'status',
  'slaRisk',
  'country',
  'isCrossBorder',
  'reason',
  'recommendedAction',
  'resolutionNote',
  'slaTargetHours',
  'slaDueAt',
  'createdAt',
  'updatedAt',
  'resolvedAt',
  'retryCount',
  'reopenCount',
  'escalated',
] as const;

export const EXCEPTION_NOTE_COLUMNS = [
  'id',
  'exception_id',
  'customer_id',
  'vendor_id',
  'authorName',
  'authorRole',
  'body',
  'noteType',
  'createdAt',
  'isInternal',
] as const;

export const STATUS_HISTORY_COLUMNS = [
  'id',
  'exception_id',
  'fromStatus',
  'toStatus',
  'changedAt',
  'changedByName',
  'durationHours',
  'note',
] as const;

export const ASSIGNMENT_COLUMNS = [
  'id',
  'exception_id',
  'assignedTo_id',
  'assignedAt',
  'unassignedAt',
  'assignedByName',
  'reason',
  'isCurrent',
] as const;

export const AUDIT_COLUMNS = [
  'id',
  'actingUserName',
  'actingUserEmail',
  'actingUserRole',
  'occurredAt',
  'entityType',
  'entityId',
  'entityLabel',
  'action',
  'fieldName',
  'previousValue',
  'newValue',
  'explanation',
] as const;

export const METRIC_COLUMNS = [
  'id',
  'metricDateKey',
  'metricDate',
  'totalPaymentValue',
  'paymentCount',
  'straightThroughCount',
  'stpRate',
  'exceptionsCreated',
  'exceptionsResolved',
  'openExceptions',
  'highPriorityOpen',
  'slaAtRisk',
  'avgResolutionHours',
  'rebateOpportunity',
  'achValue',
  'checkValue',
  'virtualCardValue',
  'wireValue',
  'crossBorderValue',
  'achCount',
  'checkCount',
  'virtualCardCount',
  'wireCount',
  'crossBorderCount',
  'domesticCount',
] as const;

export const USER_COLUMNS = [
  'id',
  'email',
  'displayName',
  'initials',
  'teamName',
  'primaryRole',
  'isActive',
  'isDemoPersona',
  'createdAt',
] as const;

export const ROLE_ASSIGNMENT_COLUMNS = [
  'id',
  'user_id',
  'target_user_id',
  'role',
  'assignedAt',
  'assignedByName',
  'isActive',
  'reason',
] as const;

export const EXCEPTION_CATEGORY_COLUMNS = [
  'id',
  'code',
  'name',
  'description',
  'defaultPriority',
  'defaultSlaHours',
  'recommendedAction',
  'isActive',
  'sortOrder',
] as const;

export const RESOLUTION_CATEGORY_COLUMNS = [
  'id',
  'code',
  'name',
  'description',
  'requiresNote',
  'isActive',
  'sortOrder',
] as const;

export const SLA_RULE_COLUMNS = [
  'id',
  'name',
  'priority',
  'paymentMethod',
  'targetHours',
  'warningThresholdPct',
  'description',
  'isActive',
] as const;

export const METHOD_RULE_COLUMNS = [
  'id',
  'paymentMethod',
  'displayName',
  'minAmount',
  'maxAmount',
  'cutoffTimeUtc',
  'retryLimit',
  'expectedSettlementHours',
  'rebateRatePct',
  'requiresBankVerification',
  'requiresComplianceReview',
  'isActive',
  'notes',
] as const;

export type CustomerRow = Pick<Customer, (typeof CUSTOMER_COLUMNS)[number]>;
export type VendorRow = Pick<Vendor, (typeof VENDOR_COLUMNS)[number]>;
export type InvoiceRow = Pick<Invoice, (typeof INVOICE_COLUMNS)[number]>;
export type PaymentRow = Pick<Payment, (typeof PAYMENT_COLUMNS)[number]>;
export type PaymentAttemptRow = Pick<
  PaymentAttempt,
  (typeof PAYMENT_ATTEMPT_COLUMNS)[number]
>;
export type ApprovalEventRow = Pick<
  ApprovalEvent,
  (typeof APPROVAL_EVENT_COLUMNS)[number]
>;
export type ExceptionRow = Pick<
  PaymentException,
  (typeof EXCEPTION_COLUMNS)[number]
>;
export type ExceptionNoteRow = Pick<
  ExceptionNote,
  (typeof EXCEPTION_NOTE_COLUMNS)[number]
>;
export type StatusHistoryRow = Pick<
  ExceptionStatusHistory,
  (typeof STATUS_HISTORY_COLUMNS)[number]
>;
export type AssignmentRow = Pick<
  ExceptionAssignment,
  (typeof ASSIGNMENT_COLUMNS)[number]
>;
export type AuditRow = Pick<AuditEvent, (typeof AUDIT_COLUMNS)[number]>;
export type MetricRow = Pick<
  DailyOperationalMetric,
  (typeof METRIC_COLUMNS)[number]
>;
export type UserRow = Pick<AppUser, (typeof USER_COLUMNS)[number]>;
export type RoleAssignmentRow = Pick<
  UserRoleAssignment,
  (typeof ROLE_ASSIGNMENT_COLUMNS)[number]
>;
export type ExceptionCategoryRow = Pick<
  ExceptionCategory,
  (typeof EXCEPTION_CATEGORY_COLUMNS)[number]
>;
export type ResolutionCategoryRow = Pick<
  ResolutionCategory,
  (typeof RESOLUTION_CATEGORY_COLUMNS)[number]
>;
export type SlaRuleRow = Pick<ServiceLevelRule, (typeof SLA_RULE_COLUMNS)[number]>;
export type MethodRuleRow = Pick<
  PaymentMethodRule,
  (typeof METHOD_RULE_COLUMNS)[number]
>;
