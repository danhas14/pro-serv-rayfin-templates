import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { TwinData } from '@/data/twin';
import { isEmbedded } from '@/lib/fabric-client';
import { buildTwin, type Twin } from '@/lib/metrics';
import { loadTwin } from '@/lib/twin-loader';

/** Where the currently rendered data came from. */
export type TwinSource = 'semantic-model' | 'dev-snapshot';

interface TwinContextValue {
  twin: Twin | null;
  loading: boolean;
  error: string | null;
  source: TwinSource | null;
  refresh: () => void;
}

const TwinContext = createContext<TwinContextValue | undefined>(undefined);

/**
 * Fetches the twin from the semantic model and exposes the derived model.
 *
 * Queries reach the model through the Fabric embed proxy, which needs a Fabric
 * host on the other side of `postMessage`. Running outside the portal during
 * local development there is no host, so the provider falls back to the
 * generated snapshot. That fallback is compiled out of production builds.
 */
export function TwinProvider({ children }: { children: ReactNode }) {
  const [twin, setTwin] = useState<Twin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<TwinSource | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      try {
        let data: TwinData;
        let from: TwinSource;

        if (import.meta.env.DEV && !isEmbedded()) {
          const { DEV_TWIN } = await import('@/lib/twin-fixture');
          data = DEV_TWIN;
          from = 'dev-snapshot';
        } else {
          data = await loadTwin();
          from = 'semantic-model';
        }

        if (cancelled) return;
        setTwin(buildTwin(data));
        setSource(from);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load the facility twin.'
        );
        setTwin(null);
        setSource(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const value = useMemo<TwinContextValue>(
    () => ({
      twin,
      loading,
      error,
      source,
      refresh: () => setNonce((n) => n + 1),
    }),
    [twin, loading, error, source]
  );

  return <TwinContext.Provider value={value}>{children}</TwinContext.Provider>;
}

/** Access the loading/error state of the twin fetch. */
export function useTwinState(): TwinContextValue {
  const context = useContext(TwinContext);
  if (context === undefined) {
    throw new Error('useTwinState must be used within a TwinProvider');
  }
  return context;
}

/**
 * Access the loaded twin. Only valid beneath a successful load — the dashboard
 * renders a loading or error screen until then, so components never deal with
 * a null twin.
 */
export function useTwin(): Twin {
  const { twin } = useTwinState();
  if (!twin) {
    throw new Error('useTwin was called before the facility twin finished loading');
  }
  return twin;
}
