/**
 * Shared union types for Payables Pulse entities.
 *
 * Kept in one place so the UI, services and seed generator all agree with the
 * `@set()` check constraints generated in the database.
 */

export type PaymentMethod =
  | 'ach'
  | 'check'
  | 'virtual-card'
  | 'wire'
  | 'cross-border';

export type PaymentStatus =
  | 'initiated'
  | 'processing'
  | 'settled'
  | 'failed'
  | 'returned'
  | 'on-hold'
  | 'cancelled';

export type InvoiceStatus =
  | 'received'
  | 'in-approval'
  | 'approved'
  | 'scheduled'
  | 'paid'
  | 'on-hold'
  | 'rejected';

export type AttemptOutcome = 'success' | 'failed' | 'pending' | 'rejected';

export type ApprovalAction =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'escalated'
  | 'pending';

export type ExceptionType =
  | 'duplicate-invoice'
  | 'approval-overdue'
  | 'missing-remittance'
  | 'invalid-bank-details'
  | 'vc-not-enrolled'
  | 'payment-rejected'
  | 'compliance-review'
  | 'currency-mismatch'
  | 'funding-issue'
  | 'suspected-fraud'
  | 'file-validation-failure';

export type ExceptionPriority = 'critical' | 'high' | 'medium' | 'low';

export type ExceptionStatus =
  | 'new'
  | 'investigating'
  | 'waiting-customer'
  | 'waiting-vendor'
  | 'ready-to-retry'
  | 'resolved'
  | 'closed';

export type SlaRisk = 'on-track' | 'at-risk' | 'breached';

export type RiskLevel = 'low' | 'medium' | 'high';

export type AppRole =
  | 'operations-manager'
  | 'payment-operations-specialist'
  | 'customer-success-manager'
  | 'auditor';

export type NoteType =
  | 'operational'
  | 'customer-followup'
  | 'vendor-review'
  | 'resolution'
  | 'escalation';

export type BankDetailsStatus =
  | 'verified'
  | 'incomplete'
  | 'outdated'
  | 'invalid';

export type AuditAction =
  | 'create'
  | 'update'
  | 'assign'
  | 'reassign'
  | 'status-change'
  | 'priority-change'
  | 'note-added'
  | 'retry-simulated'
  | 'escalated'
  | 'resolved'
  | 'closed'
  | 'config-change'
  | 'demo-data-reset';
