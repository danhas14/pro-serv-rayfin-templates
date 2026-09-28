/**
 * Tracks whether the browser can currently get an Azure AI token.
 *
 * Separate from the Rayfin/Fabric sign-in that gates the app itself: being
 * signed in to the app proves who you are, but executing a test additionally
 * needs a delegated token for the Foundry agent, which requires its own
 * one-time consent. Surfacing that as its own state means the Run buttons can
 * explain *why* they are unavailable instead of failing on click.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import {
  connectToAzureAi,
  isConnectedToAzureAi,
  isEmbeddedInIframe,
} from '@/services/entraAuth';
import { isAgentConfigured } from '@/config/agentConfig';

interface AzureAiContextValue {
  connected: boolean;
  checking: boolean;
  configured: boolean;
  embedded: boolean;
  error: string | null;
  connect: (loginHint?: string) => Promise<void>;
}

const AzureAiContext = createContext<AzureAiContextValue | undefined>(undefined);

export function AzureAiProvider({ children }: { children: ReactNode }) {
  const configured = isAgentConfigured();
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    void isConnectedToAzureAi().then((ok) => {
      if (cancelled) return;
      setConnected(ok);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [configured]);

  const connect = useCallback(async (loginHint?: string) => {
    setError(null);
    try {
      await connectToAzureAi(loginHint);
      setConnected(true);
    } catch (err) {
      setConnected(false);
      setError(
        err instanceof Error ? err.message : 'Could not connect to Azure AI.'
      );
      throw err;
    }
  }, []);

  return (
    <AzureAiContext.Provider
      value={{
        connected,
        checking,
        configured,
        embedded: isEmbeddedInIframe(),
        error,
        connect,
      }}
    >
      {children}
    </AzureAiContext.Provider>
  );
}

export function useAzureAi(): AzureAiContextValue {
  const context = useContext(AzureAiContext);
  if (!context) {
    throw new Error('useAzureAi must be used within an AzureAiProvider');
  }
  return context;
}
