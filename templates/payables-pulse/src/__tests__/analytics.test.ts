import { describe, expect, it } from 'vitest';

import {
  computeKpis,
  filterExceptions,
  filterPayments,
  geoBreakdown,
  methodBreakdown,
  topUrgentExceptions,
} from '@/domain/analytics';
import type { ExceptionRow, PaymentRow } from '@/services/columns';

const NOW = new Date('2026-09-04T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

function payment(overrides: Partial<PaymentRow>): PaymentRow {
  return {
    id: crypto.randomUUID(),
    paymentReference: 'PMT-1',
    invoice_id: 'inv',
    customer_id: 'cus-1',
    vendor_id: 'ven-1',
    amount: 1000,
    currency: 'USD',
    amountUsd: 1000,
    paymentMethod: 'ach',
    status: 'settled',
    initiatedAt: hoursAgo(2),
    settledAt: hoursAgo(1),
    country: 'United States',
    isCrossBorder: false,
    straightThrough: true,
    attemptCount: 1,
    processingHours: 4,
    rebateEligible: false,
    rebateAmount: 0,
    createdAt: hoursAgo(2),
    ...overrides,
  } as PaymentRow;
}

function exception(overrides: Partial<ExceptionRow>): ExceptionRow {
  return {
    id: crypto.randomUUID(),
    exceptionCode: 'EXC-1',
    customer_id: 'cus-1',
    vendor_id: 'ven-1',
    invoice_id: 'inv',
    payment_id: 'pay',
    assignedTo_id: undefined,
    resolutionCategory_id: undefined,
    invoiceNumber: 'INV-1',
    paymentReference: 'PMT-1',
    amount: 5000,
    currency: 'USD',
    amountUsd: 5000,
    paymentMethod: 'ach',
    exceptionType: 'payment-rejected',
    priority: 'medium',
    status: 'investigating',
    slaRisk: 'on-track',
    country: 'United States',
    isCrossBorder: false,
    reason: 'reason',
    recommendedAction: 'action',
    resolutionNote: undefined,
    slaTargetHours: 24,
    slaDueAt: new Date(NOW.getTime() + 12 * 3_600_000),
    createdAt: hoursAgo(6),
    updatedAt: hoursAgo(1),
    resolvedAt: undefined,
    retryCount: 0,
    reopenCount: 0,
    escalated: false,
    ...overrides,
  } as ExceptionRow;
}

describe('computeKpis', () => {
  it('counts only payments initiated today in the today figures', () => {
    const kpis = computeKpis(
      [payment({ amountUsd: 500 }), payment({ initiatedAt: hoursAgo(72), amountUsd: 900 })],
      [],
      NOW
    );
    expect(kpis.todayCount).toBe(1);
    expect(kpis.todayValue).toBe(500);
    expect(kpis.windowCount).toBe(2);
  });

  it('derives the straight-through rate from the whole window', () => {
    const kpis = computeKpis(
      [payment({}), payment({ straightThrough: false })],
      [],
      NOW
    );
    expect(kpis.stpRate).toBe(50);
  });

  it('excludes resolved and closed exceptions from the open count', () => {
    const kpis = computeKpis(
      [],
      [
        exception({}),
        exception({ status: 'resolved', resolvedAt: hoursAgo(1) }),
        exception({ status: 'closed', resolvedAt: hoursAgo(2) }),
      ],
      NOW
    );
    expect(kpis.openExceptions).toBe(1);
  });

  it('counts critical and high open exceptions as high priority', () => {
    const kpis = computeKpis(
      [],
      [
        exception({ priority: 'critical' }),
        exception({ priority: 'high' }),
        exception({ priority: 'low' }),
      ],
      NOW
    );
    expect(kpis.highPriorityOpen).toBe(2);
  });
});

describe('filters', () => {
  it('restricts payments to the selected window', () => {
    const rows = filterPayments(
      [payment({}), payment({ initiatedAt: hoursAgo(48) })],
      { customerId: null, paymentMethod: null, exceptionType: null, days: 1 },
      NOW
    );
    expect(rows).toHaveLength(1);
  });

  it('filters exceptions by customer and type together', () => {
    const rows = filterExceptions(
      [
        exception({ customer_id: 'cus-1', exceptionType: 'payment-rejected' }),
        exception({ customer_id: 'cus-2', exceptionType: 'payment-rejected' }),
        exception({ customer_id: 'cus-1', exceptionType: 'funding-issue' }),
      ],
      {
        customerId: 'cus-1',
        paymentMethod: null,
        exceptionType: 'payment-rejected',
        days: 30,
      },
      NOW
    );
    expect(rows).toHaveLength(1);
  });
});

describe('breakdowns', () => {
  it('reports value and count for every payment method', () => {
    const slices = methodBreakdown([
      payment({ paymentMethod: 'ach', amountUsd: 100 }),
      payment({ paymentMethod: 'wire', amountUsd: 400 }),
    ]);
    expect(slices).toHaveLength(5);
    expect(slices.find((s) => s.key === 'wire')?.value).toBe(400);
  });

  it('separates domestic and cross-border value by country', () => {
    const rows = geoBreakdown([
      payment({ country: 'Germany', isCrossBorder: true, amountUsd: 300 }),
      payment({ country: 'Germany', isCrossBorder: false, amountUsd: 200 }),
    ]);
    expect(rows[0].country).toBe('Germany');
    expect(rows[0].crossBorderValue).toBe(300);
    expect(rows[0].domesticValue).toBe(200);
  });
});

describe('topUrgentExceptions', () => {
  it('puts breached, critical work at the top', () => {
    const routine = exception({ exceptionCode: 'EXC-ROUTINE' });
    const urgent = exception({
      exceptionCode: 'EXC-URGENT',
      priority: 'critical',
      slaRisk: 'breached',
      slaDueAt: hoursAgo(10),
    });
    const ranked = topUrgentExceptions([routine, urgent], 5, NOW);
    expect(ranked[0].exceptionCode).toBe('EXC-URGENT');
  });

  it('never returns resolved work', () => {
    const ranked = topUrgentExceptions(
      [exception({ status: 'resolved', resolvedAt: hoursAgo(1) })],
      5,
      NOW
    );
    expect(ranked).toHaveLength(0);
  });
});
