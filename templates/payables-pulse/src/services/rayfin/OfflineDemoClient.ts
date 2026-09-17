/**
 * Dev-only in-memory stand-in for the Rayfin data + auth client.
 *
 * The deployed Fabric backend authenticates with Entra SSO only, which cannot
 * be driven from an automated browser session. This harness lets the whole
 * interface — every page, filter, action and role gate — be exercised end to
 * end against the same synthetic dataset the real seeder writes.
 *
 * It is behind `import.meta.env.DEV` and an explicit `VITE_OFFLINE_DEMO=1`
 * flag, so it is never part of a production bundle.
 */
import { generateDemoDataset } from '../seed/generator';

type Row = Record<string, unknown>;

interface Filter {
  [field: string]: { eq?: unknown; gte?: unknown; lte?: unknown } | undefined;
}

const OFFLINE_USER = {
  id: 'offline-subject-0001',
  email: 'demo.operator@payablespulse.demo',
};

function uuid(): string {
  return crypto.randomUUID();
}

class Table {
  readonly rows: Row[] = [];

  insert(row: Row): Row {
    const stored = { id: row.id ?? uuid(), ...row };
    this.rows.push(stored);
    return stored;
  }
}

class QueryBuilder {
  private fields: string[] = [];
  private filters: Filter = {};
  private order: Record<string, 'asc' | 'desc'> = {};
  private limit = Number.POSITIVE_INFINITY;

  constructor(private readonly table: Table) {}

  select(fields: string[]): this {
    this.fields = fields;
    return this;
  }

  where(filter: Filter): this {
    this.filters = { ...this.filters, ...filter };
    return this;
  }

  orderBy(order: Record<string, 'asc' | 'desc'>): this {
    this.order = { ...this.order, ...order };
    return this;
  }

  first(count: number): this {
    this.limit = count;
    return this;
  }

  async execute(): Promise<Row[]> {
    let rows = this.table.rows.filter((row) => matches(row, this.filters));

    for (const [field, direction] of Object.entries(this.order).reverse()) {
      rows = [...rows].sort((a, b) => {
        const result = compare(a[field], b[field]);
        return direction === 'desc' ? -result : result;
      });
    }

    rows = rows.slice(0, this.limit);
    if (this.fields.length === 0) return rows.map((row) => ({ ...row }));
    return rows.map((row) => {
      const projected: Row = {};
      for (const field of this.fields) projected[field] = row[field];
      return projected;
    });
  }

  async findFirst(): Promise<Row | null> {
    const rows = await this.execute();
    return rows[0] ?? null;
  }
}

class EntityClient {
  constructor(private readonly table: Table) {}

  select(fields: string[]) {
    return new QueryBuilder(this.table).select(fields);
  }

  where(filter: Filter) {
    return new QueryBuilder(this.table).where(filter);
  }

  orderBy(order: Record<string, 'asc' | 'desc'>) {
    return new QueryBuilder(this.table).orderBy(order);
  }

  first(count: number) {
    return new QueryBuilder(this.table).first(count);
  }

  async findById(id: string): Promise<Row | null> {
    return this.table.rows.find((row) => row.id === id) ?? null;
  }

  async findMany(filter?: Filter): Promise<Row[]> {
    return this.table.rows.filter((row) => matches(row, filter ?? {}));
  }

  async create(input: Row): Promise<Row> {
    return this.table.insert(flatten(input));
  }

  async update(where: { id: string }, data: Row): Promise<Row> {
    const row = this.table.rows.find((r) => r.id === where.id);
    if (!row) throw new Error(`Record ${where.id} not found`);
    Object.assign(row, flatten(data));
    return { ...row };
  }

  async delete(where: { id: string }): Promise<Row> {
    const index = this.table.rows.findIndex((r) => r.id === where.id);
    if (index === -1) throw new Error(`Record ${where.id} not found`);
    return this.table.rows.splice(index, 1)[0];
  }
}

/** The real client expands `customer: { id }` into a `customer_id` column. */
function flatten(input: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      value &&
      typeof value === 'object' &&
      !(value instanceof Date) &&
      'id' in (value as Row)
    ) {
      out[`${key}_id`] = (value as Row).id;
    } else {
      out[key] = value;
    }
  }
  return out;
}

function matches(row: Row, filter: Filter): boolean {
  for (const [field, condition] of Object.entries(filter)) {
    if (!condition) continue;
    const value = row[field];
    if ('eq' in condition && condition.eq !== undefined) {
      if (normalise(value) !== normalise(condition.eq)) return false;
    }
    if ('gte' in condition && condition.gte !== undefined) {
      if (time(value) < time(condition.gte)) return false;
    }
    if ('lte' in condition && condition.lte !== undefined) {
      if (time(value) > time(condition.lte)) return false;
    }
  }
  return true;
}

function normalise(value: unknown): unknown {
  return value instanceof Date ? value.getTime() : value;
}

function time(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return new Date(value).getTime();
  if (typeof value === 'number') return value;
  return 0;
}

function compare(a: unknown, b: unknown): number {
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  if (av === bv) return 0;
  if (av === undefined || av === null) return -1;
  if (bv === undefined || bv === null) return 1;
  return av < bv ? -1 : 1;
}

export interface OfflineClient {
  data: Record<string, EntityClient>;
  auth: {
    getSession(): {
      isAuthenticated: boolean;
      user: { id: string; email: string };
    };
    signOut(): Promise<void>;
  };
}

const ENTITY_NAMES = [
  'ApprovalEvent',
  'AppUser',
  'AuditEvent',
  'Customer',
  'DailyOperationalMetric',
  'ExceptionAssignment',
  'ExceptionCategory',
  'ExceptionNote',
  'ExceptionStatusHistory',
  'Invoice',
  'Payment',
  'PaymentAttempt',
  'PaymentException',
  'PaymentMethodRule',
  'ResolutionCategory',
  'ServiceLevelRule',
  'UserRoleAssignment',
  'Vendor',
] as const;

export function createOfflineClient(): OfflineClient {
  const tables = new Map<string, Table>();
  for (const name of ENTITY_NAMES) tables.set(name, new Table());

  const data: Record<string, EntityClient> = {};
  for (const [name, table] of tables) data[name] = new EntityClient(table);

  loadDataset(tables);

  return {
    data,
    auth: {
      getSession: () => ({ isAuthenticated: true, user: OFFLINE_USER }),
      signOut: async () => {},
    },
  };
}

function loadDataset(tables: Map<string, Table>) {
  const dataset = generateDemoDataset();
  const table = (name: string) => tables.get(name)!;

  for (const category of dataset.exceptionCategories) {
    table('ExceptionCategory').insert({ ...category });
  }
  const resolutionIds = dataset.resolutionCategories.map(
    (c) => table('ResolutionCategory').insert({ ...c }).id as string
  );
  for (const rule of dataset.slaRules) table('ServiceLevelRule').insert({ ...rule });
  for (const rule of dataset.methodRules) {
    table('PaymentMethodRule').insert({ ...rule });
  }

  const userIds = new Map<string, string>();
  for (const user of dataset.users) {
    const { key, ...fields } = user;
    userIds.set(key, table('AppUser').insert(fields).id as string);
  }
  // The offline identity resolves by email, so give it an operator record.
  table('AppUser').insert({
    email: OFFLINE_USER.email,
    displayName: 'Demo Operator',
    initials: 'DO',
    teamName: 'Payment Operations',
    primaryRole: 'operations-manager',
    isActive: true,
    isDemoPersona: false,
    createdAt: new Date(),
  });

  const customerIds = new Map<string, string>();
  for (const customer of dataset.customers) {
    const { key, ...fields } = customer;
    customerIds.set(key, table('Customer').insert(fields).id as string);
  }

  const vendorIds = new Map<string, string>();
  for (const vendor of dataset.vendors) {
    const { key, ...fields } = vendor;
    vendorIds.set(key, table('Vendor').insert(fields).id as string);
  }

  const invoiceIds = new Map<string, string>();
  for (const invoice of dataset.invoices) {
    const { key, customerKey, vendorKey, ...fields } = invoice;
    invoiceIds.set(
      key,
      table('Invoice').insert({
        ...fields,
        customer_id: customerIds.get(customerKey),
        vendor_id: vendorIds.get(vendorKey),
      }).id as string
    );
  }

  const paymentIds = new Map<string, string>();
  for (const payment of dataset.payments) {
    const { key, invoiceKey, customerKey, vendorKey, ...fields } = payment;
    paymentIds.set(
      key,
      table('Payment').insert({
        ...fields,
        invoice_id: invoiceIds.get(invoiceKey),
        customer_id: customerIds.get(customerKey),
        vendor_id: vendorIds.get(vendorKey),
      }).id as string
    );
  }

  for (const attempt of dataset.attempts) {
    const { paymentKey, ...fields } = attempt;
    table('PaymentAttempt').insert({
      ...fields,
      payment_id: paymentIds.get(paymentKey),
    });
  }

  for (const approval of dataset.approvals) {
    const { invoiceKey, ...fields } = approval;
    table('ApprovalEvent').insert({
      ...fields,
      invoice_id: invoiceIds.get(invoiceKey),
    });
  }

  const exceptionIds = new Map<string, string>();
  for (const exception of dataset.exceptions) {
    const {
      key,
      customerKey,
      vendorKey,
      invoiceKey,
      paymentKey,
      assigneeKey,
      ...fields
    } = exception;
    exceptionIds.set(
      key,
      table('PaymentException').insert({
        ...fields,
        customer_id: customerIds.get(customerKey),
        vendor_id: vendorKey ? vendorIds.get(vendorKey) : undefined,
        invoice_id: invoiceKey ? invoiceIds.get(invoiceKey) : undefined,
        payment_id: paymentKey ? paymentIds.get(paymentKey) : undefined,
        assignedTo_id: assigneeKey ? userIds.get(assigneeKey) : undefined,
        resolutionCategory_id:
          fields.status === 'resolved' || fields.status === 'closed'
            ? resolutionIds[0]
            : undefined,
      }).id as string
    );
  }

  for (const assignment of dataset.assignments) {
    const { exceptionKey, assigneeKey, ...fields } = assignment;
    table('ExceptionAssignment').insert({
      ...fields,
      exception_id: exceptionIds.get(exceptionKey),
      assignedTo_id: userIds.get(assigneeKey),
      assigned_by_user_id: OFFLINE_USER.id,
    });
  }

  for (const note of dataset.notes) {
    const { exceptionKey, customerKey, vendorKey, ...fields } = note;
    table('ExceptionNote').insert({
      ...fields,
      exception_id: exceptionKey ? exceptionIds.get(exceptionKey) : undefined,
      customer_id: customerKey ? customerIds.get(customerKey) : undefined,
      vendor_id: vendorKey ? vendorIds.get(vendorKey) : undefined,
      author_user_id: OFFLINE_USER.id,
    });
  }

  for (const row of dataset.history) {
    const { exceptionKey, ...fields } = row;
    table('ExceptionStatusHistory').insert({
      ...fields,
      exception_id: exceptionIds.get(exceptionKey),
      changed_by_user_id: OFFLINE_USER.id,
    });
  }

  for (const metric of dataset.metrics) {
    table('DailyOperationalMetric').insert({ ...metric });
  }
}
