import { describe, expect, it } from 'vitest';

import { generateDemoDataset } from '@/services/seed/generator';

const dataset = generateDemoDataset(new Date('2026-09-04T12:00:00Z'));

describe('synthetic dataset volume', () => {
  it('meets the demonstration data floor', () => {
    expect(dataset.customers).toHaveLength(20);
    expect(dataset.vendors).toHaveLength(100);
    expect(dataset.invoices.length).toBeGreaterThanOrEqual(1500);
    expect(dataset.payments.length).toBeGreaterThanOrEqual(1200);
    expect(dataset.exceptions.length).toBeGreaterThanOrEqual(80);
    expect(dataset.metrics).toHaveLength(90);
  });

  it('includes at least twenty high-priority exceptions', () => {
    const high = dataset.exceptions.filter(
      (e) => e.priority === 'critical' || e.priority === 'high'
    );
    expect(high.length).toBeGreaterThanOrEqual(20);
  });
  it('covers every payment method', () => {
    const methods = new Set(dataset.payments.map((p) => p.paymentMethod));
    expect([...methods].sort()).toEqual([
      'ach',
      'check',
      'cross-border',
      'virtual-card',
      'wire',
    ]);
  });

  it('spans several currencies and countries', () => {
    const currencies = new Set(dataset.payments.map((p) => p.currency));
    const countries = new Set(dataset.payments.map((p) => p.country));
    expect(currencies.size).toBeGreaterThan(3);
    expect(countries.size).toBeGreaterThan(3);
  });

  it('covers all eleven exception categories', () => {
    expect(dataset.exceptionCategories).toHaveLength(11);
  });
});

describe('synthetic dataset shape', () => {
  it('keeps every record inside the last ninety days', () => {
    const now = new Date('2026-09-04T12:00:00Z').getTime();
    const floor = now - 91 * 86_400_000;
    for (const payment of dataset.payments) {
      expect(payment.initiatedAt.getTime()).toBeGreaterThanOrEqual(floor);
      expect(payment.initiatedAt.getTime()).toBeLessThanOrEqual(now);
    }
  });

  it('produces vendors with a recurring failure pattern', () => {
    const failing = dataset.vendors.filter((v) => v.failedPaymentCount >= 2);
    expect(failing.length).toBeGreaterThanOrEqual(3);
  });

  it('produces customers with an approval bottleneck', () => {
    const slow = dataset.customers.filter((c) => c.avgApprovalHours > 40);
    expect(slow.length).toBeGreaterThanOrEqual(1);
  });

  it('links every exception to a customer that exists', () => {
    const customerKeys = new Set(dataset.customers.map((c) => c.key));
    for (const exception of dataset.exceptions) {
      expect(customerKeys.has(exception.customerKey)).toBe(true);
    }
  });

  it('is deterministic so a demo replays identically', () => {
    const second = generateDemoDataset(new Date('2026-09-04T12:00:00Z'));
    expect(second.exceptions.map((e) => e.exceptionCode)).toEqual(
      dataset.exceptions.map((e) => e.exceptionCode)
    );
  });
});

describe('exception service-level realism', () => {
  const open = dataset.exceptions.filter(
    (e) => e.status !== 'resolved' && e.status !== 'closed'
  );

  it('produces a backlog with both fresh work and an aged tail', () => {
    const breached = open.filter((e) => e.slaRisk === 'breached').length;
    const healthy = open.filter((e) => e.slaRisk !== 'breached').length;
    expect(open.length).toBeGreaterThan(40);
    expect(healthy / open.length).toBeGreaterThan(0.25);
    expect(breached / open.length).toBeLessThan(0.75);
  });

  it('covers every open status so the queue filters are meaningful', () => {
    const statuses = new Set(open.map((e) => e.status));
    expect(statuses.size).toBe(5);
  });

  it('spreads exception history across the whole horizon', () => {
    const dates = dataset.exceptions.map((e) => e.createdAt.getTime());
    const spanDays = (Math.max(...dates) - Math.min(...dates)) / 86_400_000;
    expect(spanDays).toBeGreaterThan(60);
  });

  it('never dates an exception in the future', () => {
    const now = new Date('2026-09-04T12:00:00Z').getTime();
    for (const e of dataset.exceptions) {
      expect(e.createdAt.getTime()).toBeLessThanOrEqual(now);
      if (e.resolvedAt) expect(e.resolvedAt.getTime()).toBeLessThanOrEqual(now);
    }
  });
});
