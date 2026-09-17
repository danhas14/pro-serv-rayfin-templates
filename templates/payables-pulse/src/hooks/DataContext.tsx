import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type {
  CustomerRow,
  ExceptionCategoryRow,
  ExceptionRow,
  MethodRuleRow,
  MetricRow,
  PaymentRow,
  ResolutionCategoryRow,
  SlaRuleRow,
  UserRow,
  VendorRow,
} from '../services/columns';
import { listExceptions } from '../services/exceptionService';
import { listDailyMetrics, listPayments } from '../services/metricsService';
import {
  listCustomers,
  listExceptionCategories,
  listPaymentMethodRules,
  listResolutionCategories,
  listServiceLevelRules,
  listUsers,
  listVendors,
} from '../services/referenceService';

import { useAuth } from './AuthContext';

export interface WorkingSet {
  customers: CustomerRow[];
  vendors: VendorRow[];
  users: UserRow[];
  exceptions: ExceptionRow[];
  metrics: MetricRow[];
  payments: PaymentRow[];
  exceptionCategories: ExceptionCategoryRow[];
  resolutionCategories: ResolutionCategoryRow[];
  slaRules: SlaRuleRow[];
  methodRules: MethodRuleRow[];
}

const EMPTY: WorkingSet = {
  customers: [],
  vendors: [],
  users: [],
  exceptions: [],
  metrics: [],
  payments: [],
  exceptionCategories: [],
  resolutionCategories: [],
  slaRules: [],
  methodRules: [],
};

interface DataContextValue extends WorkingSet {
  loading: boolean;
  error: string | null;
  /** True once a load has completed and found no customers. */
  isEmpty: boolean;
  refresh: () => Promise<void>;
  customerById: Map<string, CustomerRow>;
  vendorById: Map<string, VendorRow>;
  userById: Map<string, UserRow>;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

/**
 * Loads the working set once per session.
 *
 * Data API Builder does not aggregate server-side and the client has no
 * `count()`, so the dashboards slice an in-memory 90-day window rather than
 * issuing a query per tile.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<WorkingSet>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const since = new Date(Date.now() - 90 * 86_400_000);
      const [
        customers,
        vendors,
        users,
        exceptions,
        metrics,
        payments,
        exceptionCategories,
        resolutionCategories,
        slaRules,
        methodRules,
      ] = await Promise.all([
        listCustomers(),
        listVendors(),
        listUsers(),
        listExceptions(),
        listDailyMetrics(),
        listPayments(since),
        listExceptionCategories(),
        listResolutionCategories(),
        listServiceLevelRules(),
        listPaymentMethodRules(),
      ]);
      setData({
        customers,
        vendors,
        users,
        exceptions,
        metrics,
        payments,
        exceptionCategories,
        resolutionCategories,
        slaRules,
        methodRules,
      });
      setLoaded(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load operational data.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) void refresh();
    else {
      setData(EMPTY);
      setLoaded(false);
    }
  }, [isAuthenticated, refresh]);

  const value = useMemo<DataContextValue>(
    () => ({
      ...data,
      loading,
      error,
      isEmpty: loaded && data.customers.length === 0,
      refresh,
      customerById: new Map(data.customers.map((c) => [c.id, c])),
      vendorById: new Map(data.vendors.map((v) => [v.id, v])),
      userById: new Map(data.users.map((u) => [u.id, u])),
    }),
    [data, loading, error, loaded, refresh]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
