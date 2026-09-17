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
} from '../../domain/enums';

/* ------------------------------------------------------------ primitives */

/** Deterministic PRNG so the demo dataset is identical on every reset. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY_MS = 86_400_000;

export const FX_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.74,
  MXN: 0.058,
  AUD: 0.66,
  SGD: 0.74,
  INR: 0.012,
  JPY: 0.0067,
  BRL: 0.19,
};

const COUNTRY_CURRENCY: Record<string, string> = {
  'United States': 'USD',
  Canada: 'CAD',
  Mexico: 'MXN',
  'United Kingdom': 'GBP',
  Germany: 'EUR',
  France: 'EUR',
  Netherlands: 'EUR',
  Ireland: 'EUR',
  India: 'INR',
  Japan: 'JPY',
  Singapore: 'SGD',
  Australia: 'AUD',
  Brazil: 'BRL',
};

/* ---------------------------------------------------------------- shapes */

export interface SeedUser {
  key: string;
  email: string;
  displayName: string;
  initials: string;
  teamName: string;
  primaryRole: AppRole;
  isActive: boolean;
  isDemoPersona: boolean;
  createdAt: Date;
}

export interface SeedCustomer {
  key: string;
  customerCode: string;
  name: string;
  industry: string;
  country: string;
  baseCurrency: string;
  tier: string;
  onboardedAt: Date;
  isActive: boolean;
  paymentVolume90d: number;
  paymentCount90d: number;
  paymentSuccessRate: number;
  stpRate: number;
  avgApprovalHours: number;
  avgResolutionHours: number;
  exceptionRate: number;
  rejectedRate: number;
  virtualCardAdoption: number;
  estimatedRebate: number;
  healthScore: number;
  riskLevel: RiskLevel;
}

export interface SeedVendor {
  key: string;
  vendorCode: string;
  name: string;
  category: string;
  country: string;
  currency: string;
  remittanceEmail?: string;
  preferredPaymentMethod: PaymentMethod;
  virtualCardEligible: boolean;
  virtualCardEnrolled: boolean;
  bankDetailsStatus: BankDetailsStatus;
  lastPaymentAt?: Date;
  paymentCount90d: number;
  failedPaymentCount: number;
  delayedPaymentCount: number;
  duplicateInvoiceCount: number;
  exceptionCount: number;
  avgDaysToPay: number;
  exceptionRecurrenceRate: number;
  flaggedForReview: boolean;
  reviewNote?: string;
}

export interface SeedInvoice {
  key: string;
  customerKey: string;
  vendorKey: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  invoiceDate: Date;
  dueDate: Date;
  status: InvoiceStatus;
  poNumber?: string;
  isDuplicateSuspect: boolean;
  approvalHours: number;
  createdAt: Date;
}

export interface SeedPayment {
  key: string;
  invoiceKey: string;
  customerKey: string;
  vendorKey: string;
  paymentReference: string;
  amount: number;
  currency: string;
  amountUsd: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  initiatedAt: Date;
  settledAt?: Date;
  country: string;
  isCrossBorder: boolean;
  straightThrough: boolean;
  attemptCount: number;
  processingHours: number;
  rebateEligible: boolean;
  rebateAmount: number;
  createdAt: Date;
}

export interface SeedAttempt {
  paymentKey: string;
  attemptNumber: number;
  attemptedAt: Date;
  outcome: AttemptOutcome;
  responseCode: string;
  responseMessage: string;
  channel: string;
  isSimulatedRetry: boolean;
}

export interface SeedApproval {
  invoiceKey: string;
  stepNumber: number;
  stepName: string;
  approverName: string;
  approverRole: string;
  action: ApprovalAction;
  occurredAt: Date;
  elapsedHours: number;
  note?: string;
}

export interface SeedException {
  key: string;
  exceptionCode: string;
  customerKey: string;
  vendorKey?: string;
  invoiceKey?: string;
  paymentKey?: string;
  assigneeKey?: string;
  invoiceNumber: string;
  paymentReference?: string;
  amount: number;
  currency: string;
  amountUsd: number;
  paymentMethod: PaymentMethod;
  exceptionType: ExceptionType;
  priority: ExceptionPriority;
  status: ExceptionStatus;
  slaRisk: 'on-track' | 'at-risk' | 'breached';
  country: string;
  isCrossBorder: boolean;
  reason: string;
  recommendedAction: string;
  resolutionNote?: string;
  slaTargetHours: number;
  slaDueAt: Date;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  retryCount: number;
  reopenCount: number;
  escalated: boolean;
}

export interface SeedNote {
  exceptionKey?: string;
  customerKey?: string;
  vendorKey?: string;
  authorName: string;
  authorRole: string;
  body: string;
  noteType: NoteType;
  createdAt: Date;
  isInternal: boolean;
}

export interface SeedHistory {
  exceptionKey: string;
  fromStatus: ExceptionStatus;
  toStatus: ExceptionStatus;
  changedAt: Date;
  changedByName: string;
  durationHours: number;
  note?: string;
}

export interface SeedAssignment {
  exceptionKey: string;
  assigneeKey: string;
  assignedAt: Date;
  unassignedAt?: Date;
  assignedByName: string;
  reason?: string;
  isCurrent: boolean;
}

export interface SeedMetric {
  metricDateKey: string;
  metricDate: Date;
  totalPaymentValue: number;
  paymentCount: number;
  straightThroughCount: number;
  stpRate: number;
  exceptionsCreated: number;
  exceptionsResolved: number;
  openExceptions: number;
  highPriorityOpen: number;
  slaAtRisk: number;
  avgResolutionHours: number;
  rebateOpportunity: number;
  achValue: number;
  checkValue: number;
  virtualCardValue: number;
  wireValue: number;
  crossBorderValue: number;
  achCount: number;
  checkCount: number;
  virtualCardCount: number;
  wireCount: number;
  crossBorderCount: number;
  domesticCount: number;
}

export interface SeedExceptionCategory {
  code: ExceptionType;
  name: string;
  description: string;
  defaultPriority: ExceptionPriority;
  defaultSlaHours: number;
  recommendedAction: string;
  isActive: boolean;
  sortOrder: number;
}

export interface SeedResolutionCategory {
  code: string;
  name: string;
  description: string;
  requiresNote: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface SeedSlaRule {
  name: string;
  priority: ExceptionPriority;
  paymentMethod: 'all' | PaymentMethod;
  targetHours: number;
  warningThresholdPct: number;
  description: string;
  isActive: boolean;
}

export interface SeedMethodRule {
  paymentMethod: PaymentMethod;
  displayName: string;
  minAmount: number;
  maxAmount: number;
  cutoffTimeUtc: string;
  retryLimit: number;
  expectedSettlementHours: number;
  rebateRatePct: number;
  requiresBankVerification: boolean;
  requiresComplianceReview: boolean;
  isActive: boolean;
  notes: string;
}

export interface DemoDataset {
  users: SeedUser[];
  customers: SeedCustomer[];
  vendors: SeedVendor[];
  invoices: SeedInvoice[];
  payments: SeedPayment[];
  attempts: SeedAttempt[];
  approvals: SeedApproval[];
  exceptions: SeedException[];
  notes: SeedNote[];
  history: SeedHistory[];
  assignments: SeedAssignment[];
  metrics: SeedMetric[];
  exceptionCategories: SeedExceptionCategory[];
  resolutionCategories: SeedResolutionCategory[];
  slaRules: SeedSlaRule[];
  methodRules: SeedMethodRule[];
}

/* ------------------------------------------------------------ static data */

export const EXCEPTION_CATEGORY_SEED: SeedExceptionCategory[] = [
  {
    code: 'suspected-fraud',
    name: 'Possible fraudulent behaviour',
    description:
      'Payment instructions or behaviour match a known fraud pattern such as a late bank-detail change.',
    defaultPriority: 'critical',
    defaultSlaHours: 4,
    recommendedAction:
      'Freeze the payment, confirm the change through a known vendor contact, then escalate to fraud operations.',
    isActive: true,
    sortOrder: 1,
  },
  {
    code: 'compliance-review',
    name: 'Sanctions or compliance review required',
    description:
      'A screening hit requires manual review before the payment can be released.',
    defaultPriority: 'critical',
    defaultSlaHours: 8,
    recommendedAction:
      'Collect the screening evidence and route to compliance for a release or reject decision.',
    isActive: true,
    sortOrder: 2,
  },
  {
    code: 'invalid-bank-details',
    name: 'Invalid bank details',
    description:
      'The account or routing details failed validation at the receiving institution.',
    defaultPriority: 'high',
    defaultSlaHours: 12,
    recommendedAction:
      'Request re-verified bank details from the vendor, then re-validate before retrying.',
    isActive: true,
    sortOrder: 3,
  },
  {
    code: 'payment-rejected',
    name: 'Payment rejected',
    description: 'The payment was rejected downstream and requires triage.',
    defaultPriority: 'high',
    defaultSlaHours: 12,
    recommendedAction:
      'Review the rejection code, correct the underlying data, then retry the payment.',
    isActive: true,
    sortOrder: 4,
  },
  {
    code: 'duplicate-invoice',
    name: 'Duplicate invoice suspected',
    description:
      'An invoice matches an existing record on vendor, amount and reference.',
    defaultPriority: 'high',
    defaultSlaHours: 24,
    recommendedAction:
      'Compare against the matching invoice and cancel the duplicate before payment is released.',
    isActive: true,
    sortOrder: 5,
  },
  {
    code: 'funding-issue',
    name: 'Funding issue',
    description:
      'The funding account did not cover the scheduled disbursement.',
    defaultPriority: 'high',
    defaultSlaHours: 8,
    recommendedAction:
      'Confirm the funding position with the customer and reschedule the disbursement.',
    isActive: true,
    sortOrder: 6,
  },
  {
    code: 'approval-overdue',
    name: 'Approval overdue',
    description:
      'An invoice has been waiting on an approver beyond the agreed window.',
    defaultPriority: 'medium',
    defaultSlaHours: 24,
    recommendedAction:
      'Nudge the current approver and offer to reroute to the backup approver.',
    isActive: true,
    sortOrder: 7,
  },
  {
    code: 'file-validation-failure',
    name: 'Payment file validation failure',
    description:
      'A payment file failed schema or control-total validation on ingestion.',
    defaultPriority: 'medium',
    defaultSlaHours: 12,
    recommendedAction:
      'Review the rejected records, correct the file and resubmit the batch.',
    isActive: true,
    sortOrder: 8,
  },
  {
    code: 'currency-mismatch',
    name: 'Currency mismatch',
    description:
      'The invoice currency does not match the vendor payment profile.',
    defaultPriority: 'medium',
    defaultSlaHours: 24,
    recommendedAction:
      'Confirm the settlement currency with the vendor and align the payment profile.',
    isActive: true,
    sortOrder: 9,
  },
  {
    code: 'missing-remittance',
    name: 'Missing remittance information',
    description:
      'The payment cannot be applied because remittance detail is absent.',
    defaultPriority: 'low',
    defaultSlaHours: 48,
    recommendedAction:
      'Attach the remittance advice and resend it to the vendor contact on file.',
    isActive: true,
    sortOrder: 10,
  },
  {
    code: 'vc-not-enrolled',
    name: 'Vendor not enrolled for virtual card',
    description:
      'A virtual-card eligible spend is being paid by a lower-value method.',
    defaultPriority: 'low',
    defaultSlaHours: 72,
    recommendedAction:
      'Route the vendor to card enrolment and quantify the rebate opportunity.',
    isActive: true,
    sortOrder: 11,
  },
];

export const RESOLUTION_CATEGORY_SEED: SeedResolutionCategory[] = [
  {
    code: 'paid-after-correction',
    name: 'Paid after correction',
    description: 'Underlying data was corrected and the payment settled.',
    requiresNote: false,
    isActive: true,
    sortOrder: 1,
  },
  {
    code: 'duplicate-cancelled',
    name: 'Duplicate cancelled',
    description: 'The duplicate invoice was cancelled before disbursement.',
    requiresNote: true,
    isActive: true,
    sortOrder: 2,
  },
  {
    code: 'vendor-updated-details',
    name: 'Vendor updated payment details',
    description: 'Vendor supplied re-verified payment instructions.',
    requiresNote: false,
    isActive: true,
    sortOrder: 3,
  },
  {
    code: 'customer-approved',
    name: 'Customer completed approval',
    description: 'The outstanding approval was completed by the customer.',
    requiresNote: false,
    isActive: true,
    sortOrder: 4,
  },
  {
    code: 'compliance-cleared',
    name: 'Compliance cleared',
    description: 'Screening review completed and the payment was released.',
    requiresNote: true,
    isActive: true,
    sortOrder: 5,
  },
  {
    code: 'rerouted-method',
    name: 'Rerouted to another payment method',
    description: 'Payment re-issued on a different rail.',
    requiresNote: false,
    isActive: true,
    sortOrder: 6,
  },
  {
    code: 'no-action-required',
    name: 'No action required',
    description: 'Reviewed and confirmed as a false positive.',
    requiresNote: true,
    isActive: true,
    sortOrder: 7,
  },
  {
    code: 'written-off',
    name: 'Cancelled or written off',
    description: 'Payment cancelled and removed from the disbursement run.',
    requiresNote: true,
    isActive: true,
    sortOrder: 8,
  },
];

export const SLA_RULE_SEED: SeedSlaRule[] = [
  {
    name: 'Critical — all methods',
    priority: 'critical',
    paymentMethod: 'all',
    targetHours: 4,
    warningThresholdPct: 60,
    description:
      'Fraud and compliance exceptions must reach a decision within four hours.',
    isActive: true,
  },
  {
    name: 'High — all methods',
    priority: 'high',
    paymentMethod: 'all',
    targetHours: 12,
    warningThresholdPct: 70,
    description: 'High-priority exceptions resolve within half a business day.',
    isActive: true,
  },
  {
    name: 'High — cross-border',
    priority: 'high',
    paymentMethod: 'cross-border',
    targetHours: 24,
    warningThresholdPct: 70,
    description:
      'Cross-border corridors allow an extra day for correspondent responses.',
    isActive: true,
  },
  {
    name: 'Medium — all methods',
    priority: 'medium',
    paymentMethod: 'all',
    targetHours: 24,
    warningThresholdPct: 75,
    description: 'Standard operational exceptions resolve within one day.',
    isActive: true,
  },
  {
    name: 'Medium — check',
    priority: 'medium',
    paymentMethod: 'check',
    targetHours: 48,
    warningThresholdPct: 75,
    description: 'Check exceptions allow for print and mail cycles.',
    isActive: true,
  },
  {
    name: 'Low — all methods',
    priority: 'low',
    paymentMethod: 'all',
    targetHours: 72,
    warningThresholdPct: 80,
    description: 'Enablement and remittance follow-ups resolve within 3 days.',
    isActive: true,
  },
];

export const METHOD_RULE_SEED: SeedMethodRule[] = [
  {
    paymentMethod: 'ach',
    displayName: 'ACH',
    minAmount: 1,
    maxAmount: 2_000_000,
    cutoffTimeUtc: '21:00',
    retryLimit: 2,
    expectedSettlementHours: 24,
    rebateRatePct: 0,
    requiresBankVerification: true,
    requiresComplianceReview: false,
    isActive: true,
    notes: 'Domestic batch rail. Same-day window closes at 17:00 local.',
  },
  {
    paymentMethod: 'check',
    displayName: 'Check',
    minAmount: 1,
    maxAmount: 250_000,
    cutoffTimeUtc: '18:00',
    retryLimit: 1,
    expectedSettlementHours: 96,
    rebateRatePct: 0,
    requiresBankVerification: false,
    requiresComplianceReview: false,
    isActive: true,
    notes: 'Print and mail. Reissue requires a stop-payment confirmation.',
  },
  {
    paymentMethod: 'virtual-card',
    displayName: 'Virtual card',
    minAmount: 25,
    maxAmount: 100_000,
    cutoffTimeUtc: '23:00',
    retryLimit: 3,
    expectedSettlementHours: 4,
    rebateRatePct: 1.35,
    requiresBankVerification: false,
    requiresComplianceReview: false,
    isActive: true,
    notes: 'Highest rebate rail. Requires vendor card enrolment.',
  },
  {
    paymentMethod: 'wire',
    displayName: 'Wire',
    minAmount: 1_000,
    maxAmount: 10_000_000,
    cutoffTimeUtc: '20:00',
    retryLimit: 1,
    expectedSettlementHours: 8,
    rebateRatePct: 0,
    requiresBankVerification: true,
    requiresComplianceReview: true,
    isActive: true,
    notes: 'High-value rail. Dual approval required above 250,000 USD.',
  },
  {
    paymentMethod: 'cross-border',
    displayName: 'Cross-border',
    minAmount: 100,
    maxAmount: 5_000_000,
    cutoffTimeUtc: '16:00',
    retryLimit: 2,
    expectedSettlementHours: 48,
    rebateRatePct: 0,
    requiresBankVerification: true,
    requiresComplianceReview: true,
    isActive: true,
    notes:
      'Correspondent rail with sanctions screening on every payment instruction.',
  },
];

const DEMO_USERS: Omit<SeedUser, 'createdAt'>[] = [
  {
    key: 'u-manager',
    email: 'r.okafor@payablespulse.demo',
    displayName: 'Rachel Okafor',
    initials: 'RO',
    teamName: 'Payment Operations',
    primaryRole: 'operations-manager',
    isActive: true,
    isDemoPersona: true,
  },
  {
    key: 'u-spec-1',
    email: 'd.moreau@payablespulse.demo',
    displayName: 'Diane Moreau',
    initials: 'DM',
    teamName: 'Exceptions Desk A',
    primaryRole: 'payment-operations-specialist',
    isActive: true,
    isDemoPersona: true,
  },
  {
    key: 'u-spec-2',
    email: 'k.tanaka@payablespulse.demo',
    displayName: 'Kenji Tanaka',
    initials: 'KT',
    teamName: 'Exceptions Desk A',
    primaryRole: 'payment-operations-specialist',
    isActive: true,
    isDemoPersona: true,
  },
  {
    key: 'u-spec-3',
    email: 'p.alvarez@payablespulse.demo',
    displayName: 'Paula Alvarez',
    initials: 'PA',
    teamName: 'Exceptions Desk B',
    primaryRole: 'payment-operations-specialist',
    isActive: true,
    isDemoPersona: true,
  },
  {
    key: 'u-spec-4',
    email: 's.nkemdirim@payablespulse.demo',
    displayName: 'Samuel Nkemdirim',
    initials: 'SN',
    teamName: 'Exceptions Desk B',
    primaryRole: 'payment-operations-specialist',
    isActive: true,
    isDemoPersona: true,
  },
  {
    key: 'u-csm-1',
    email: 'l.bergstrom@payablespulse.demo',
    displayName: 'Lena Bergström',
    initials: 'LB',
    teamName: 'Customer Success',
    primaryRole: 'customer-success-manager',
    isActive: true,
    isDemoPersona: true,
  },
  {
    key: 'u-csm-2',
    email: 'a.haddad@payablespulse.demo',
    displayName: 'Amir Haddad',
    initials: 'AH',
    teamName: 'Customer Success',
    primaryRole: 'customer-success-manager',
    isActive: true,
    isDemoPersona: true,
  },
  {
    key: 'u-auditor',
    email: 'g.whitfield@payablespulse.demo',
    displayName: 'Grace Whitfield',
    initials: 'GW',
    teamName: 'Internal Audit',
    primaryRole: 'auditor',
    isActive: true,
    isDemoPersona: true,
  },
];

const CUSTOMER_SEED: {
  name: string;
  industry: string;
  country: string;
  tier: string;
}[] = [
  { name: 'Northwind Logistics Group', industry: 'Transportation', country: 'United States', tier: 'Enterprise' },
  { name: 'Beacon Health Partners', industry: 'Healthcare', country: 'United States', tier: 'Enterprise' },
  { name: 'Calderon Foods International', industry: 'Food & Beverage', country: 'Mexico', tier: 'Enterprise' },
  { name: 'Halcyon Manufacturing', industry: 'Industrial', country: 'United States', tier: 'Mid-market' },
  { name: 'Bridgewater Utilities', industry: 'Utilities', country: 'United Kingdom', tier: 'Enterprise' },
  { name: 'Verdant Agritech', industry: 'Agriculture', country: 'Brazil', tier: 'Mid-market' },
  { name: 'Ashford Retail Holdings', industry: 'Retail', country: 'United Kingdom', tier: 'Enterprise' },
  { name: 'Meridian Construction Co.', industry: 'Construction', country: 'Canada', tier: 'Mid-market' },
  { name: 'Portside Marine Services', industry: 'Marine', country: 'Netherlands', tier: 'Mid-market' },
  { name: 'Kestrel Aerospace Supply', industry: 'Aerospace', country: 'United States', tier: 'Enterprise' },
  { name: 'Lumen Education Trust', industry: 'Education', country: 'Ireland', tier: 'Mid-market' },
  { name: 'Sable River Hospitality', industry: 'Hospitality', country: 'United States', tier: 'Mid-market' },
  { name: 'Tessellate Software', industry: 'Technology', country: 'Germany', tier: 'Growth' },
  { name: 'Ironbark Mining Services', industry: 'Mining', country: 'Australia', tier: 'Enterprise' },
  { name: 'Corva Pharmaceuticals', industry: 'Pharmaceutical', country: 'Singapore', tier: 'Enterprise' },
  { name: 'Willowmere Property Group', industry: 'Real Estate', country: 'Canada', tier: 'Mid-market' },
  { name: 'Hollis & Grange Insurance', industry: 'Insurance', country: 'United States', tier: 'Mid-market' },
  { name: 'Anvara Chemicals', industry: 'Chemicals', country: 'India', tier: 'Growth' },
  { name: 'Fjord Energy Systems', industry: 'Energy', country: 'France', tier: 'Enterprise' },
  { name: 'Cobblestone Media Networks', industry: 'Media', country: 'United States', tier: 'Growth' },
];

const VENDOR_PREFIX = [
  'Alder', 'Brightmoor', 'Cedarline', 'Dunmore', 'Eastgate', 'Fallbrook',
  'Granite', 'Harborview', 'Ivywell', 'Juniper', 'Kingsmere', 'Larkfield',
  'Marlowe', 'Northcott', 'Oakhurst', 'Pinebrook', 'Quarrydale', 'Rosemont',
  'Stonebridge', 'Thornbury', 'Umberton', 'Vantage', 'Westmill', 'Yarrow',
  'Zephyr',
];

const VENDOR_SUFFIX = [
  'Supply Co.', 'Industrial', 'Services Ltd.', 'Partners', 'Technologies',
  'Freight', 'Components', 'Solutions', 'Holdings', 'Works',
];

const VENDOR_CATEGORIES = [
  'Facilities',
  'Freight & Logistics',
  'IT & Software',
  'Professional Services',
  'Raw Materials',
  'Maintenance',
  'Marketing',
  'Travel',
  'Packaging',
  'Equipment',
];

const APPROVER_NAMES = [
  'M. Ellery',
  'J. Duarte',
  'C. Fenwick',
  'A. Ramaswamy',
  'T. Lindgren',
  'N. Osei',
  'B. Castellanos',
  'H. Ferreira',
];

const METHOD_PROFILE: Record<
  PaymentMethod,
  { successRate: number; stpRate: number; hours: number; share: number }
> = {
  ach: { successRate: 0.965, stpRate: 0.93, hours: 22, share: 0.42 },
  check: { successRate: 0.93, stpRate: 0.71, hours: 88, share: 0.14 },
  'virtual-card': { successRate: 0.985, stpRate: 0.96, hours: 3.5, share: 0.18 },
  wire: { successRate: 0.972, stpRate: 0.86, hours: 7, share: 0.14 },
  'cross-border': { successRate: 0.885, stpRate: 0.63, hours: 46, share: 0.12 },
};

/* --------------------------------------------------------------- builder */

export function generateDemoDataset(now = new Date()): DemoDataset {
  const rand = mulberry32(20260904);
  const pick = <T,>(items: readonly T[]): T =>
    items[Math.floor(rand() * items.length)];
  const between = (min: number, max: number) => min + rand() * (max - min);
  const intBetween = (min: number, max: number) =>
    Math.floor(between(min, max + 1));

  const horizonStart = new Date(now.getTime() - 90 * DAY_MS);

  const users: SeedUser[] = DEMO_USERS.map((u) => ({
    ...u,
    createdAt: new Date(horizonStart.getTime() - 200 * DAY_MS),
  }));
  const specialists = users.filter(
    (u) => u.primaryRole === 'payment-operations-specialist'
  );

  /* customers */
  const customers: SeedCustomer[] = CUSTOMER_SEED.map((c, i) => ({
    key: `c-${i}`,
    customerCode: `CUS-${String(1001 + i)}`,
    name: c.name,
    industry: c.industry,
    country: c.country,
    baseCurrency: COUNTRY_CURRENCY[c.country] ?? 'USD',
    tier: c.tier,
    onboardedAt: new Date(
      now.getTime() - intBetween(200, 1800) * DAY_MS
    ),
    isActive: true,
    paymentVolume90d: 0,
    paymentCount90d: 0,
    paymentSuccessRate: 0,
    stpRate: 0,
    avgApprovalHours: 0,
    avgResolutionHours: 0,
    exceptionRate: 0,
    rejectedRate: 0,
    virtualCardAdoption: 0,
    estimatedRebate: 0,
    healthScore: 0,
    riskLevel: 'low',
  }));

  // Customers with a deliberate approval bottleneck.
  const bottleneckCustomers = new Set(['c-2', 'c-7', 'c-13']);

  /* vendors */
  const vendorCountries = Object.keys(COUNTRY_CURRENCY);
  const vendors: SeedVendor[] = Array.from({ length: 100 }, (_, i) => {
    const country = i < 62 ? 'United States' : pick(vendorCountries);
    const currency = COUNTRY_CURRENCY[country] ?? 'USD';
    const eligible = rand() < 0.55;
    const name = `${VENDOR_PREFIX[i % VENDOR_PREFIX.length]}${
      i >= VENDOR_PREFIX.length ? ` ${Math.floor(i / VENDOR_PREFIX.length) + 1}` : ''
    } ${VENDOR_SUFFIX[i % VENDOR_SUFFIX.length]}`;
    return {
      key: `v-${i}`,
      vendorCode: `VEN-${String(2001 + i)}`,
      name,
      category: VENDOR_CATEGORIES[i % VENDOR_CATEGORIES.length],
      country,
      currency,
      remittanceEmail:
        rand() < 0.88
          ? `ar@${name.toLowerCase().replace(/[^a-z]+/g, '')}.demo`
          : undefined,
      preferredPaymentMethod: weightedMethod(rand(), country),
      virtualCardEligible: eligible,
      virtualCardEnrolled: eligible && rand() < 0.42,
      bankDetailsStatus: bankStatus(rand()),
      paymentCount90d: 0,
      failedPaymentCount: 0,
      delayedPaymentCount: 0,
      duplicateInvoiceCount: 0,
      exceptionCount: 0,
      avgDaysToPay: 0,
      exceptionRecurrenceRate: 0,
      flaggedForReview: false,
    };
  });

  // Three vendors carry a recurring failure pattern the Vendor Insights page surfaces.
  const problemVendors = ['v-3', 'v-17', 'v-46'];
  for (const key of problemVendors) {
    const vendor = vendors.find((v) => v.key === key);
    if (vendor) {
      vendor.bankDetailsStatus = key === 'v-17' ? 'invalid' : 'outdated';
      vendor.preferredPaymentMethod =
        key === 'v-46' ? 'cross-border' : vendor.preferredPaymentMethod;
    }
  }

  /* invoices */
  const invoices: SeedInvoice[] = [];
  const approvals: SeedApproval[] = [];

  for (let i = 0; i < 1520; i += 1) {
    const customer = customers[Math.floor(rand() * customers.length)];
    const problemKey = pick(problemVendors);
    const vendor =
      rand() < 0.09
        ? (vendors.find((v) => v.key === problemKey) ??
          vendors[Math.floor(rand() * vendors.length)])
        : vendors[Math.floor(rand() * vendors.length)];

    const ageDays = Math.floor(Math.pow(rand(), 0.85) * 90);
    const invoiceDate = new Date(now.getTime() - ageDays * DAY_MS);
    const currency = vendor.currency;
    const magnitude = rand();
    const amount = round2(
      magnitude < 0.6
        ? between(250, 12_000)
        : magnitude < 0.92
          ? between(12_000, 90_000)
          : between(90_000, 620_000)
    );

    const bottleneck = bottleneckCustomers.has(customer.key);
    const approvalHours = round2(
      bottleneck ? between(28, 140) : between(1.5, 34)
    );
    const isDuplicate = rand() < 0.018;

    const invoice: SeedInvoice = {
      key: `i-${i}`,
      customerKey: customer.key,
      vendorKey: vendor.key,
      invoiceNumber: `INV-${String(480000 + i)}`,
      amount,
      currency,
      invoiceDate,
      dueDate: new Date(invoiceDate.getTime() + intBetween(14, 45) * DAY_MS),
      status: 'received',
      poNumber: rand() < 0.72 ? `PO-${intBetween(70000, 99999)}` : undefined,
      isDuplicateSuspect: isDuplicate,
      approvalHours,
      createdAt: invoiceDate,
    };
    invoices.push(invoice);

    // Approval trails are generated for the slower/interesting invoices only —
    // enough to make every exception detail page meaningful without writing a
    // row for all 1,500 invoices.
    if (bottleneck || approvalHours > 26 || rand() < 0.12) {
      const steps = intBetween(2, 4);
      let cursor = invoiceDate.getTime();
      for (let s = 1; s <= steps; s += 1) {
        const elapsed = between(0.5, approvalHours / steps + 6);
        cursor += elapsed * 3_600_000;
        const last = s === steps;
        approvals.push({
          invoiceKey: invoice.key,
          stepNumber: s,
          stepName:
            s === 1
              ? 'Submitted for approval'
              : last
                ? 'Final approval'
                : `Approval level ${s}`,
          approverName: pick(APPROVER_NAMES),
          approverRole: s === 1 ? 'Requester' : last ? 'Controller' : 'Manager',
          action: s === 1 ? 'submitted' : last && approvalHours > 90 ? 'pending' : 'approved',
          occurredAt: new Date(cursor),
          elapsedHours: round2(elapsed),
          note:
            last && approvalHours > 90
              ? 'Awaiting controller sign-off beyond the agreed window.'
              : undefined,
        });
      }
    }
  }

  /* payments */
  const payments: SeedPayment[] = [];
  const attempts: SeedAttempt[] = [];

  const payableInvoices = invoices.filter((inv) => !inv.isDuplicateSuspect);
  const paymentTargets = payableInvoices.slice(0, 1260);

  paymentTargets.forEach((invoice, i) => {
    const vendor = vendors.find((v) => v.key === invoice.vendorKey)!;
    const customer = customers.find((c) => c.key === invoice.customerKey)!;
    const method = choosePaymentMethod(rand(), vendor, invoice.amount);
    const profile = METHOD_PROFILE[method];

    const isProblemVendor = problemVendors.includes(vendor.key);
    const successChance = isProblemVendor
      ? profile.successRate - 0.34
      : profile.successRate;

    const initiatedAt = new Date(
      invoice.invoiceDate.getTime() +
        (invoice.approvalHours + between(1, 20)) * 3_600_000
    );
    if (initiatedAt.getTime() > now.getTime()) {
      initiatedAt.setTime(now.getTime() - between(0, 6) * 3_600_000);
    }

    const roll = rand();
    const succeeded = roll < successChance;
    const processingHours = round2(
      profile.hours * between(0.55, 1.7) + (isProblemVendor ? 18 : 0)
    );
    const settledAt = succeeded
      ? new Date(initiatedAt.getTime() + processingHours * 3_600_000)
      : undefined;

    const status: PaymentStatus = succeeded
      ? settledAt && settledAt.getTime() > now.getTime()
        ? 'processing'
        : 'settled'
      : roll < successChance + 0.035
        ? 'returned'
        : 'failed';

    const straightThrough =
      succeeded && rand() < (isProblemVendor ? 0.4 : profile.stpRate);
    const attemptCount = succeeded ? (straightThrough ? 1 : intBetween(1, 2)) : intBetween(1, 3);
    const rebateEligible = method === 'virtual-card';
    const amountUsd = round2(invoice.amount * (FX_TO_USD[invoice.currency] ?? 1));

    const payment: SeedPayment = {
      key: `p-${i}`,
      invoiceKey: invoice.key,
      customerKey: customer.key,
      vendorKey: vendor.key,
      paymentReference: `PMT-${String(910000 + i)}`,
      amount: invoice.amount,
      currency: invoice.currency,
      amountUsd,
      paymentMethod: method,
      status,
      initiatedAt,
      settledAt: status === 'settled' ? settledAt : undefined,
      country: vendor.country,
      isCrossBorder: vendor.country !== customer.country,
      straightThrough,
      attemptCount,
      processingHours,
      rebateEligible,
      rebateAmount: rebateEligible ? round2(amountUsd * 0.0135) : 0,
      createdAt: initiatedAt,
    };
    payments.push(payment);

    invoice.status =
      status === 'settled'
        ? 'paid'
        : status === 'processing'
          ? 'scheduled'
          : status === 'failed' || status === 'returned'
            ? 'on-hold'
            : 'approved';

    if (attemptCount > 1 || !succeeded) {
      for (let a = 1; a <= attemptCount; a += 1) {
        const isLast = a === attemptCount;
        const outcome: AttemptOutcome = isLast
          ? succeeded
            ? 'success'
            : status === 'returned'
              ? 'rejected'
              : 'failed'
          : 'failed';
        attempts.push({
          paymentKey: payment.key,
          attemptNumber: a,
          attemptedAt: new Date(
            initiatedAt.getTime() + (a - 1) * between(4, 30) * 3_600_000
          ),
          outcome,
          responseCode: responseCodeFor(outcome, method),
          responseMessage: responseMessageFor(outcome, method),
          channel: method === 'check' ? 'print-and-mail' : 'payment-gateway',
          isSimulatedRetry: false,
        });
      }
    } else {
      attempts.push({
        paymentKey: payment.key,
        attemptNumber: 1,
        attemptedAt: initiatedAt,
        outcome: 'success',
        responseCode: 'ACK-00',
        responseMessage: 'Accepted by the receiving institution.',
        channel: method === 'check' ? 'print-and-mail' : 'payment-gateway',
        isSimulatedRetry: false,
      });
    }
  });

  /* exceptions */
  const exceptions: SeedException[] = [];
  const notes: SeedNote[] = [];
  const history: SeedHistory[] = [];
  const assignments: SeedAssignment[] = [];

  const failedPayments = payments.filter(
    (p) => p.status === 'failed' || p.status === 'returned'
  );
  const duplicateInvoices = invoices.filter((i) => i.isDuplicateSuspect);
  const slowInvoices = invoices.filter((i) => i.approvalHours > 60);

  const candidates: { type: ExceptionType; payment?: SeedPayment; invoice?: SeedInvoice }[] = [];

  for (const p of failedPayments.slice(0, 110)) {
    const vendor = vendors.find((v) => v.key === p.vendorKey)!;
    candidates.push({
      type:
        vendor.bankDetailsStatus === 'invalid'
          ? 'invalid-bank-details'
          : p.status === 'returned'
            ? 'payment-rejected'
            : p.isCrossBorder
              ? 'compliance-review'
              : 'funding-issue',
      payment: p,
      invoice: invoices.find((i) => i.key === p.invoiceKey),
    });
  }

  for (const inv of duplicateInvoices.slice(0, 30)) {
    candidates.push({ type: 'duplicate-invoice', invoice: inv });
  }

  for (const inv of slowInvoices.slice(0, 60)) {
    candidates.push({ type: 'approval-overdue', invoice: inv });
  }

  const extraTypes: ExceptionType[] = [
    'missing-remittance',
    'currency-mismatch',
    'vc-not-enrolled',
    'file-validation-failure',
    'suspected-fraud',
  ];
  for (let i = 0; i < 105; i += 1) {
    const p = payments[Math.floor(rand() * payments.length)];
    candidates.push({
      type: extraTypes[i % extraTypes.length],
      payment: p,
      invoice: invoices.find((inv) => inv.key === p.invoiceKey),
    });
  }

  const categoryByCode = new Map(
    EXCEPTION_CATEGORY_SEED.map((c) => [c.code, c])
  );

  candidates.forEach((candidate, i) => {
    const invoice =
      candidate.invoice ??
      invoices.find((inv) => inv.key === candidate.payment?.invoiceKey);
    if (!invoice) return;

    const payment = candidate.payment;
    const customer = customers.find((c) => c.key === invoice.customerKey)!;
    const vendor = vendors.find((v) => v.key === invoice.vendorKey)!;
    const category = categoryByCode.get(candidate.type)!;

    const priority = escalatePriority(category.defaultPriority, rand());
    const slaTargetHours = slaTargetFor(priority, payment?.paymentMethod ?? 'ach');

    // Exception volume ramps up across the horizon — the story the dashboard
    // tells is a growing backlog — and whether one is still open is a function
    // of how long ago it arrived. That gives a populated trend line plus a
    // realistic mix of fresh work and an aged, breached tail.
    const ageHours = 0.2 + Math.pow(rand(), 2.1) * (89.5 * 24 - 0.2);
    const ageDays = ageHours / 24;
    const openChance =
      ageDays < 1
        ? 0.92
        : ageDays < 3
          ? 0.7
          : ageDays < 10
            ? 0.3
            : ageDays < 30
              ? 0.1
              : 0.035;
    const isOpen = rand() < openChance;

    const createdAt = new Date(now.getTime() - ageHours * 3_600_000);
    const slaDueAt = new Date(createdAt.getTime() + slaTargetHours * 3_600_000);

    const lifecycleRoll = rand();
    const status: ExceptionStatus = isOpen
      ? lifecycleRoll < 0.22
        ? 'new'
        : lifecycleRoll < 0.52
          ? 'investigating'
          : lifecycleRoll < 0.7
            ? 'waiting-vendor'
            : lifecycleRoll < 0.88
              ? 'waiting-customer'
              : 'ready-to-retry'
      : lifecycleRoll < 0.78
        ? 'resolved'
        : 'closed';

    const resolvedAt = isOpen
      ? undefined
      : new Date(
          Math.min(
            now.getTime(),
            createdAt.getTime() + between(1, slaTargetHours * 1.6) * 3_600_000
          )
        );

    const slaRisk = !isOpen
      ? 'on-track'
      : now.getTime() > slaDueAt.getTime()
        ? 'breached'
        : now.getTime() >
            createdAt.getTime() + slaTargetHours * 3_600_000 * 0.5
          ? 'at-risk'
          : 'on-track';

    const assignee =
      status === 'new' && rand() < 0.55
        ? undefined
        : specialists[Math.floor(rand() * specialists.length)];

    const amountUsd = round2(invoice.amount * (FX_TO_USD[invoice.currency] ?? 1));

    const exception: SeedException = {
      key: `e-${i}`,
      exceptionCode: `EXC-${String(30100 + i)}`,
      customerKey: customer.key,
      vendorKey: vendor.key,
      invoiceKey: invoice.key,
      paymentKey: payment?.key,
      assigneeKey: assignee?.key,
      invoiceNumber: invoice.invoiceNumber,
      paymentReference: payment?.paymentReference,
      amount: invoice.amount,
      currency: invoice.currency,
      amountUsd,
      paymentMethod: payment?.paymentMethod ?? vendor.preferredPaymentMethod,
      exceptionType: candidate.type,
      priority,
      status,
      slaRisk,
      country: vendor.country,
      isCrossBorder: payment?.isCrossBorder ?? vendor.country !== customer.country,
      reason: reasonFor(candidate.type, vendor.name, invoice.invoiceNumber),
      recommendedAction: category.recommendedAction,
      resolutionNote: isOpen
        ? undefined
        : 'Corrected and confirmed with the counterparty.',
      slaTargetHours,
      slaDueAt,
      createdAt,
      updatedAt: new Date(
        Math.min(now.getTime(), createdAt.getTime() + between(0.5, ageHours) * 3_600_000)
      ),
      resolvedAt,
      retryCount: payment && rand() < 0.3 ? 1 : 0,
      reopenCount: rand() < 0.07 ? 1 : 0,
      escalated: priority === 'critical' && rand() < 0.5,
    };
    exceptions.push(exception);

    vendor.exceptionCount += 1;
    if (candidate.type === 'duplicate-invoice') vendor.duplicateInvoiceCount += 1;

    /* status history */
    let cursor = createdAt;
    let previous: ExceptionStatus = 'new';
    const path = statusPathTo(status);
    for (const next of path) {
      const step = between(0.5, Math.max(1, slaTargetHours / 2));
      const changedAt = new Date(
        Math.min(now.getTime(), cursor.getTime() + step * 3_600_000)
      );
      history.push({
        exceptionKey: exception.key,
        fromStatus: previous,
        toStatus: next,
        changedAt,
        changedByName: assignee?.displayName ?? 'Rachel Okafor',
        durationHours: round2(step),
        note: next === 'resolved' ? 'Resolution recorded.' : undefined,
      });
      previous = next;
      cursor = changedAt;
    }

    /* assignment */
    if (assignee) {
      assignments.push({
        exceptionKey: exception.key,
        assigneeKey: assignee.key,
        assignedAt: new Date(createdAt.getTime() + between(0.2, 4) * 3_600_000),
        assignedByName: 'Rachel Okafor',
        reason: 'Queue balancing across the exceptions desk.',
        isCurrent: true,
      });
    }

    /* notes */
    const noteCount = intBetween(1, 3);
    for (let n = 0; n < noteCount; n += 1) {
      notes.push({
        exceptionKey: exception.key,
        authorName: assignee?.displayName ?? 'Rachel Okafor',
        authorRole: assignee
          ? 'Payment Operations Specialist'
          : 'Operations Manager',
        body: noteBodyFor(candidate.type, n, vendor.name, customer.name),
        noteType: n === noteCount - 1 && !isOpen ? 'resolution' : 'operational',
        createdAt: new Date(
          Math.min(
            now.getTime(),
            createdAt.getTime() + (n + 1) * between(1, 8) * 3_600_000
          )
        ),
        isInternal: true,
      });
    }
  });

  /* customer + vendor follow-up notes */
  for (const key of ['c-2', 'c-7', 'c-13']) {
    const customer = customers.find((c) => c.key === key)!;
    notes.push({
      customerKey: key,
      authorName: 'Lena Bergström',
      authorRole: 'Customer Success Manager',
      body: `Reviewed the approval backlog with ${customer.name}. They are consolidating approvers and will confirm a revised routing matrix next week.`,
      noteType: 'customer-followup',
      createdAt: new Date(now.getTime() - intBetween(2, 20) * DAY_MS),
      isInternal: true,
    });
  }

  for (const key of problemVendors) {
    const vendor = vendors.find((v) => v.key === key)!;
    vendor.flaggedForReview = true;
    vendor.reviewNote =
      'Recurring payment failures — payment instructions are being re-verified.';
    notes.push({
      vendorKey: key,
      authorName: 'Diane Moreau',
      authorRole: 'Payment Operations Specialist',
      body: `${vendor.name} has failed multiple disbursements in the last 90 days. Re-verification requested through the vendor portal.`,
      noteType: 'vendor-review',
      createdAt: new Date(now.getTime() - intBetween(1, 25) * DAY_MS),
      isInternal: true,
    });
  }

  /* roll-ups */
  computeVendorRollups(vendors, payments, exceptions);
  computeCustomerRollups(customers, payments, exceptions, invoices);
  const metrics = computeDailyMetrics(now, payments, exceptions);

  return {
    users,
    customers,
    vendors,
    invoices,
    payments,
    attempts,
    approvals,
    exceptions,
    notes,
    history,
    assignments,
    metrics,
    exceptionCategories: EXCEPTION_CATEGORY_SEED,
    resolutionCategories: RESOLUTION_CATEGORY_SEED,
    slaRules: SLA_RULE_SEED,
    methodRules: METHOD_RULE_SEED,
  };
}

/* --------------------------------------------------------------- helpers */

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function weightedMethod(roll: number, country: string): PaymentMethod {
  if (country !== 'United States') return roll < 0.7 ? 'cross-border' : 'wire';
  if (roll < 0.45) return 'ach';
  if (roll < 0.65) return 'virtual-card';
  if (roll < 0.85) return 'check';
  return 'wire';
}

function bankStatus(roll: number): BankDetailsStatus {
  if (roll < 0.82) return 'verified';
  if (roll < 0.91) return 'incomplete';
  if (roll < 0.97) return 'outdated';
  return 'invalid';
}

function choosePaymentMethod(
  roll: number,
  vendor: SeedVendor,
  amount: number
): PaymentMethod {
  if (vendor.country !== 'United States') {
    return amount > 250_000 ? 'wire' : 'cross-border';
  }
  if (vendor.virtualCardEnrolled && amount < 100_000 && roll < 0.7) {
    return 'virtual-card';
  }
  if (amount > 250_000) return 'wire';
  if (roll < 0.62) return 'ach';
  if (roll < 0.82) return 'check';
  return 'wire';
}

function escalatePriority(
  base: ExceptionPriority,
  roll: number
): ExceptionPriority {
  if (base === 'critical') return 'critical';
  if (roll < 0.18) {
    return base === 'high' ? 'critical' : base === 'medium' ? 'high' : 'medium';
  }
  return base;
}

function slaTargetFor(
  priority: ExceptionPriority,
  method: PaymentMethod
): number {
  const base = { critical: 4, high: 12, medium: 24, low: 72 }[priority];
  if (method === 'cross-border' && priority === 'high') return 24;
  if (method === 'check' && priority === 'medium') return 48;
  return base;
}

function statusPathTo(status: ExceptionStatus): ExceptionStatus[] {
  switch (status) {
    case 'new':
      return [];
    case 'investigating':
      return ['investigating'];
    case 'waiting-customer':
      return ['investigating', 'waiting-customer'];
    case 'waiting-vendor':
      return ['investigating', 'waiting-vendor'];
    case 'ready-to-retry':
      return ['investigating', 'ready-to-retry'];
    case 'resolved':
      return ['investigating', 'resolved'];
    case 'closed':
      return ['investigating', 'resolved', 'closed'];
    default:
      return [];
  }
}

function responseCodeFor(outcome: AttemptOutcome, method: PaymentMethod): string {
  if (outcome === 'success') return 'ACK-00';
  if (outcome === 'rejected') return method === 'ach' ? 'R03' : 'REJ-14';
  return method === 'cross-border' ? 'XB-27' : 'DEC-05';
}

function responseMessageFor(
  outcome: AttemptOutcome,
  method: PaymentMethod
): string {
  if (outcome === 'success') return 'Accepted by the receiving institution.';
  if (outcome === 'rejected') {
    return method === 'ach'
      ? 'No account or unable to locate account at the receiving bank.'
      : 'Rejected by the receiving institution — beneficiary details do not match.';
  }
  return method === 'cross-border'
    ? 'Correspondent bank held the instruction pending additional detail.'
    : 'Declined by the processor — retry after correcting the instruction.';
}

function reasonFor(
  type: ExceptionType,
  vendorName: string,
  invoiceNumber: string
): string {
  switch (type) {
    case 'duplicate-invoice':
      return `${invoiceNumber} matches an existing ${vendorName} invoice on amount, date and reference.`;
    case 'approval-overdue':
      return `${invoiceNumber} has been waiting on approval beyond the agreed window.`;
    case 'missing-remittance':
      return `${vendorName} cannot apply the payment — remittance detail was not attached.`;
    case 'invalid-bank-details':
      return `The account details on file for ${vendorName} failed validation at the receiving bank.`;
    case 'vc-not-enrolled':
      return `${vendorName} is card-eligible but is still being paid by a lower-value method.`;
    case 'payment-rejected':
      return `The disbursement to ${vendorName} was rejected downstream and needs triage.`;
    case 'compliance-review':
      return `Screening returned a possible match on the ${vendorName} instruction — manual review required.`;
    case 'currency-mismatch':
      return `${invoiceNumber} is denominated differently from the ${vendorName} payment profile.`;
    case 'funding-issue':
      return `The funding account did not cover the scheduled disbursement for ${invoiceNumber}.`;
    case 'suspected-fraud':
      return `Bank details for ${vendorName} changed shortly before disbursement — verification required.`;
    case 'file-validation-failure':
      return `The payment file containing ${invoiceNumber} failed control-total validation on ingestion.`;
    default:
      return `Exception raised on ${invoiceNumber}.`;
  }
}

function noteBodyFor(
  type: ExceptionType,
  index: number,
  vendorName: string,
  customerName: string
): string {
  const opening = [
    `Picked up from the queue. Confirmed the exception against the ${vendorName} record.`,
    `Reached out to ${customerName} accounts payable for confirmation.`,
    `Reviewed the payment history for ${vendorName} — this is the second occurrence this quarter.`,
  ];
  const followUp = [
    'Awaiting a response from the counterparty contact on file.',
    'Evidence attached to the case and shared with the desk lead.',
    'Cleared for retry once the corrected details are confirmed.',
  ];
  if (index === 0) return opening[type.length % opening.length];
  return followUp[index % followUp.length];
}

function computeVendorRollups(
  vendors: SeedVendor[],
  payments: SeedPayment[],
  exceptions: SeedException[]
): void {
  const byVendor = new Map<string, SeedPayment[]>();
  for (const p of payments) {
    const list = byVendor.get(p.vendorKey) ?? [];
    list.push(p);
    byVendor.set(p.vendorKey, list);
  }

  for (const vendor of vendors) {
    const list = byVendor.get(vendor.key) ?? [];
    const failed = list.filter(
      (p) => p.status === 'failed' || p.status === 'returned'
    );
    const delayed = list.filter((p) => p.processingHours > 72);
    const settled = list.filter((p) => p.status === 'settled');
    const vendorExceptions = exceptions.filter((e) => e.vendorKey === vendor.key);

    vendor.paymentCount90d = list.length;
    vendor.failedPaymentCount = failed.length;
    vendor.delayedPaymentCount = delayed.length;
    vendor.avgDaysToPay = round2(
      settled.length
        ? settled.reduce((sum, p) => sum + p.processingHours, 0) /
            settled.length /
            24
        : 0
    );
    vendor.exceptionCount = vendorExceptions.length;
    vendor.exceptionRecurrenceRate = round2(
      list.length ? (vendorExceptions.length / list.length) * 100 : 0
    );
    const latest = list.reduce<Date | undefined>(
      (acc, p) => (!acc || p.initiatedAt > acc ? p.initiatedAt : acc),
      undefined
    );
    vendor.lastPaymentAt = latest;
  }
}

function computeCustomerRollups(
  customers: SeedCustomer[],
  payments: SeedPayment[],
  exceptions: SeedException[],
  invoices: SeedInvoice[]
): void {
  for (const customer of customers) {
    const list = payments.filter((p) => p.customerKey === customer.key);
    const custInvoices = invoices.filter((i) => i.customerKey === customer.key);
    const custExceptions = exceptions.filter(
      (e) => e.customerKey === customer.key
    );

    const succeeded = list.filter(
      (p) => p.status === 'settled' || p.status === 'processing'
    );
    const rejected = list.filter(
      (p) => p.status === 'failed' || p.status === 'returned'
    );
    const stp = list.filter((p) => p.straightThrough);
    const card = list.filter((p) => p.paymentMethod === 'virtual-card');
    const resolved = custExceptions.filter((e) => e.resolvedAt);

    customer.paymentCount90d = list.length;
    customer.paymentVolume90d = round2(
      list.reduce((sum, p) => sum + p.amountUsd, 0)
    );
    customer.paymentSuccessRate = pct(succeeded.length, list.length);
    customer.stpRate = pct(stp.length, list.length);
    customer.rejectedRate = pct(rejected.length, list.length);
    customer.virtualCardAdoption = pct(card.length, list.length);
    customer.estimatedRebate = round2(
      list
        .filter((p) => p.rebateEligible)
        .reduce((sum, p) => sum + p.rebateAmount, 0) +
        list
          .filter((p) => !p.rebateEligible && p.amountUsd < 100_000)
          .reduce((sum, p) => sum + p.amountUsd * 0.0135, 0) *
          0.35
    );
    customer.avgApprovalHours = round2(
      custInvoices.length
        ? custInvoices.reduce((s, i) => s + i.approvalHours, 0) /
            custInvoices.length
        : 0
    );
    customer.avgResolutionHours = round2(
      resolved.length
        ? resolved.reduce(
            (s, e) =>
              s +
              (e.resolvedAt!.getTime() - e.createdAt.getTime()) / 3_600_000,
            0
          ) / resolved.length
        : 0
    );
    customer.exceptionRate = pct(custExceptions.length, list.length);

    const score =
      customer.paymentSuccessRate * 0.4 +
      customer.stpRate * 0.25 +
      Math.max(0, 100 - customer.exceptionRate * 6) * 0.2 +
      Math.max(0, 100 - customer.avgApprovalHours) * 0.15;
    customer.healthScore = Math.max(1, Math.min(100, Math.round(score)));
    customer.riskLevel =
      customer.healthScore >= 78
        ? 'low'
        : customer.healthScore >= 62
          ? 'medium'
          : 'high';
  }
}

function pct(part: number, total: number): number {
  return round2(total ? (part / total) * 100 : 0);
}

function computeDailyMetrics(
  now: Date,
  payments: SeedPayment[],
  exceptions: SeedException[]
): SeedMetric[] {
  const metrics: SeedMetric[] = [];

  for (let dayOffset = 89; dayOffset >= 0; dayOffset -= 1) {
    const day = new Date(now.getTime() - dayOffset * DAY_MS);
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day.getTime() + DAY_MS);

    const dayPayments = payments.filter(
      (p) => p.initiatedAt >= day && p.initiatedAt < nextDay
    );
    const created = exceptions.filter(
      (e) => e.createdAt >= day && e.createdAt < nextDay
    );
    const resolved = exceptions.filter(
      (e) => e.resolvedAt && e.resolvedAt >= day && e.resolvedAt < nextDay
    );
    const openAtEnd = exceptions.filter(
      (e) => e.createdAt < nextDay && (!e.resolvedAt || e.resolvedAt >= nextDay)
    );

    const byMethod = (m: PaymentMethod) =>
      dayPayments.filter((p) => p.paymentMethod === m);
    const sum = (list: SeedPayment[]) =>
      round2(list.reduce((s, p) => s + p.amountUsd, 0));

    const stpCount = dayPayments.filter((p) => p.straightThrough).length;

    metrics.push({
      metricDateKey: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`,
      metricDate: day,
      totalPaymentValue: sum(dayPayments),
      paymentCount: dayPayments.length,
      straightThroughCount: stpCount,
      stpRate: pct(stpCount, dayPayments.length),
      exceptionsCreated: created.length,
      exceptionsResolved: resolved.length,
      openExceptions: openAtEnd.length,
      highPriorityOpen: openAtEnd.filter(
        (e) => e.priority === 'critical' || e.priority === 'high'
      ).length,
      slaAtRisk: openAtEnd.filter((e) => e.slaRisk !== 'on-track').length,
      avgResolutionHours: round2(
        resolved.length
          ? resolved.reduce(
              (s, e) =>
                s + (e.resolvedAt!.getTime() - e.createdAt.getTime()) / 3_600_000,
              0
            ) / resolved.length
          : 0
      ),
      rebateOpportunity: round2(
        dayPayments
          .filter((p) => !p.rebateEligible && p.amountUsd < 100_000)
          .reduce((s, p) => s + p.amountUsd * 0.0135, 0)
      ),
      achValue: sum(byMethod('ach')),
      checkValue: sum(byMethod('check')),
      virtualCardValue: sum(byMethod('virtual-card')),
      wireValue: sum(byMethod('wire')),
      crossBorderValue: sum(byMethod('cross-border')),
      achCount: byMethod('ach').length,
      checkCount: byMethod('check').length,
      virtualCardCount: byMethod('virtual-card').length,
      wireCount: byMethod('wire').length,
      crossBorderCount: dayPayments.filter((p) => p.isCrossBorder).length,
      domesticCount: dayPayments.filter((p) => !p.isCrossBorder).length,
    });
  }

  return metrics;
}
