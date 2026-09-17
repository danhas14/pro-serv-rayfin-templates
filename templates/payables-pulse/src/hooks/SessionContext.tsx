import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { AppRole } from '../domain/enums';
import { ROLE_LABELS } from '../domain/enums';
import {
  can as hasCapability,
  effectiveCapabilities,
  type Capability,
} from '../domain/policy';
import type { UserRow } from '../services/columns';
import type { OperationContext } from '../services/context';
import { resolveIdentity } from '../services/identityService';

import { useAuth } from './AuthContext';

interface SessionContextValue {
  operator: UserRow | null;
  realRole: AppRole | null;
  viewAsRole: AppRole | null;
  /** The role the interface is presented as — never more than the real role. */
  activeRole: AppRole | null;
  capabilities: Capability[];
  can: (capability: Capability) => boolean;
  operationContext: OperationContext | null;
  setViewAsRole: (role: AppRole | null) => void;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

const VIEW_AS_KEY = 'payables-pulse.view-as';

export function SessionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [operator, setOperator] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewAsRole, setViewAsRoleState] = useState<AppRole | null>(() => {
    const stored = window.localStorage.getItem(VIEW_AS_KEY);
    return (stored as AppRole) || null;
  });

  const load = useCallback(async () => {
    if (!user) {
      setOperator(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { user: resolved } = await resolveIdentity(user);
      setOperator(resolved);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load your operator profile.'
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) void load();
    else setOperator(null);
  }, [isAuthenticated, load]);

  const setViewAsRole = useCallback((role: AppRole | null) => {
    setViewAsRoleState(role);
    if (role) window.localStorage.setItem(VIEW_AS_KEY, role);
    else window.localStorage.removeItem(VIEW_AS_KEY);
  }, []);

  const value = useMemo<SessionContextValue>(() => {
    const realRole = operator?.primaryRole ?? null;
    const scoped =
      realRole && viewAsRole && viewAsRole !== realRole ? viewAsRole : null;
    const activeRole = scoped ?? realRole;
    const capabilities = realRole
      ? effectiveCapabilities(realRole, scoped)
      : [];

    const operationContext: OperationContext | null =
      operator && realRole
        ? {
            actor: {
              userId: operator.id,
              name: operator.displayName,
              email: operator.email,
              role: ROLE_LABELS[activeRole ?? realRole],
            },
            role: activeRole ?? realRole,
            capabilities,
          }
        : null;

    return {
      operator,
      realRole,
      viewAsRole: scoped,
      activeRole,
      capabilities,
      can: (capability: Capability) => hasCapability(capabilities, capability),
      operationContext,
      setViewAsRole,
      loading,
      error,
      reload: load,
    };
  }, [operator, viewAsRole, loading, error, load, setViewAsRole]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
