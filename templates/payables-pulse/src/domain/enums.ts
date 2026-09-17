import type {
  ApprovalAction,
  AppRole,
  AttemptOutcome,
  BankDetailsStatus,
  ExceptionPriority,
  ExceptionStatus,
  ExceptionType,
  InvoiceStatus,
  NoteType,
  PaymentMethod,
  PaymentStatus,
  RiskLevel,
  SlaRisk,
} from '../../rayfin/data/enums';

export type {
  ApprovalAction,
  AppRole,
  AttemptOutcome,
  BankDetailsStatus,
  ExceptionPriority,
  ExceptionStatus,
  ExceptionType,
  InvoiceStatus,
  NoteType,
  PaymentMethod,
  PaymentStatus,
  RiskLevel,
  SlaRisk,
};

export const PAYMENT_METHODS: PaymentMethod[] = [
  'ach',
  'check',
  'virtual-card',
  'wire',
  'cross-border',
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  ach: 'ACH',
  check: 'Check',
  'virtual-card': 'Virtual card',
  wire: 'Wire',
  'cross-border': 'Cross-border',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  initiated: 'Initiated',
  processing: 'Processing',
  settled: 'Settled',
  failed: 'Failed',
  returned: 'Returned',
  'on-hold': 'On hold',
  cancelled: 'Cancelled',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  received: 'Received',
  'in-approval': 'In approval',
  approved: 'Approved',
  scheduled: 'Scheduled',
  paid: 'Paid',
  'on-hold': 'On hold',
  rejected: 'Rejected',
};

export const ATTEMPT_OUTCOME_LABELS: Record<AttemptOutcome, string> = {
  success: 'Succeeded',
  failed: 'Failed',
  pending: 'Pending',
  rejected: 'Rejected',
};

export const APPROVAL_ACTION_LABELS: Record<ApprovalAction, string> = {
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  returned: 'Returned',
  escalated: 'Escalated',
  pending: 'Pending',
};

export const EXCEPTION_TYPES: ExceptionType[] = [
  'duplicate-invoice',
  'approval-overdue',
  'missing-remittance',
  'invalid-bank-details',
  'vc-not-enrolled',
  'payment-rejected',
  'compliance-review',
  'currency-mismatch',
  'funding-issue',
  'suspected-fraud',
  'file-validation-failure',
];

export const EXCEPTION_TYPE_LABELS: Record<ExceptionType, string> = {
  'duplicate-invoice': 'Duplicate invoice suspected',
  'approval-overdue': 'Approval overdue',
  'missing-remittance': 'Missing remittance information',
  'invalid-bank-details': 'Invalid bank details',
  'vc-not-enrolled': 'Vendor not enrolled for virtual card',
  'payment-rejected': 'Payment rejected',
  'compliance-review': 'Sanctions or compliance review required',
  'currency-mismatch': 'Currency mismatch',
  'funding-issue': 'Funding issue',
  'suspected-fraud': 'Possible fraudulent behaviour',
  'file-validation-failure': 'Payment file validation failure',
};

export const EXCEPTION_TYPE_SHORT_LABELS: Record<ExceptionType, string> = {
  'duplicate-invoice': 'Duplicate invoice',
  'approval-overdue': 'Approval overdue',
  'missing-remittance': 'Missing remittance',
  'invalid-bank-details': 'Invalid bank details',
  'vc-not-enrolled': 'VC not enrolled',
  'payment-rejected': 'Payment rejected',
  'compliance-review': 'Compliance review',
  'currency-mismatch': 'Currency mismatch',
  'funding-issue': 'Funding issue',
  'suspected-fraud': 'Suspected fraud',
  'file-validation-failure': 'File validation',
};

export const PRIORITIES: ExceptionPriority[] = [
  'critical',
  'high',
  'medium',
  'low',
];

export const PRIORITY_LABELS: Record<ExceptionPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/** Lower is more severe — used for queue ordering. */
export const PRIORITY_RANK: Record<ExceptionPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const EXCEPTION_STATUSES: ExceptionStatus[] = [
  'new',
  'investigating',
  'waiting-customer',
  'waiting-vendor',
  'ready-to-retry',
  'resolved',
  'closed',
];

export const OPEN_STATUSES: ExceptionStatus[] = [
  'new',
  'investigating',
  'waiting-customer',
  'waiting-vendor',
  'ready-to-retry',
];

export const EXCEPTION_STATUS_LABELS: Record<ExceptionStatus, string> = {
  new: 'New',
  investigating: 'Investigating',
  'waiting-customer': 'Waiting on customer',
  'waiting-vendor': 'Waiting on vendor',
  'ready-to-retry': 'Ready to retry',
  resolved: 'Resolved',
  closed: 'Closed',
};

/** Allowed forward transitions used by the detail page workflow control. */
export const STATUS_TRANSITIONS: Record<ExceptionStatus, ExceptionStatus[]> = {
  new: ['investigating', 'waiting-customer', 'waiting-vendor', 'closed'],
  investigating: [
    'waiting-customer',
    'waiting-vendor',
    'ready-to-retry',
    'resolved',
    'closed',
  ],
  'waiting-customer': ['investigating', 'ready-to-retry', 'resolved', 'closed'],
  'waiting-vendor': ['investigating', 'ready-to-retry', 'resolved', 'closed'],
  'ready-to-retry': ['investigating', 'resolved', 'closed'],
  resolved: ['closed', 'investigating'],
  closed: ['investigating'],
};

export const SLA_RISK_LABELS: Record<SlaRisk, string> = {
  'on-track': 'On track',
  'at-risk': 'At risk',
  breached: 'Breached',
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: 'Low risk',
  medium: 'Watch',
  high: 'High risk',
};

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  operational: 'Operational note',
  'customer-followup': 'Customer follow-up',
  'vendor-review': 'Vendor review',
  resolution: 'Resolution',
  escalation: 'Escalation',
};

export const BANK_DETAILS_LABELS: Record<BankDetailsStatus, string> = {
  verified: 'Verified',
  incomplete: 'Incomplete',
  outdated: 'Outdated',
  invalid: 'Invalid',
};

export const ROLES: AppRole[] = [
  'operations-manager',
  'payment-operations-specialist',
  'customer-success-manager',
  'auditor',
];

export const ROLE_LABELS: Record<AppRole, string> = {
  'operations-manager': 'Operations Manager',
  'payment-operations-specialist': 'Payment Operations Specialist',
  'customer-success-manager': 'Customer Success Manager',
  auditor: 'Auditor',
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  'operations-manager':
    'Full operational control: monitors volume and service levels, assigns work and manages configuration.',
  'payment-operations-specialist':
    'Works an assigned exception queue: investigates, notes, retries and resolves exceptions.',
  'customer-success-manager':
    'Reads customer payment health and adds customer follow-up notes. Cannot edit payment records.',
  auditor:
    'Read-only access to payments, decisions, notes, status history and the audit trail.',
};
