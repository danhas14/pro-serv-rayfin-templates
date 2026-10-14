import { useState } from 'react';

import aerial from '@/assets/facility-aerial.png';
import { FACILITY } from '@/data/twin';
import { useAuth } from '@/hooks/AuthContext';

const msLogo = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 21 21"
    className="mr-2"
    aria-hidden="true"
  >
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

export function AuthPage() {
  const { signIn, fabricAuthEnabled } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  const buttonLabel = isLoading
    ? fabricAuthEnabled
      ? 'Opening Fabric…'
      : 'Signing in…'
    : 'Sign in with Microsoft';

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink-950 px-4">
      <img
        src={aerial}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full object-cover opacity-25"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink-950/70 via-ink-950/85 to-ink-950" />
      <div className="ops-grid-backdrop pointer-events-none absolute inset-0 opacity-60" />

      <div className="relative w-full max-w-sm">
        <div className="ops-panel p-8">
          <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-fabric-500 to-fabric-700 shadow-lg shadow-fabric-700/30">
            <svg viewBox="0 0 16 16" className="size-5 text-white" fill="currentColor">
              <path d="M8 1 2 3.6v4.1c0 3.5 2.5 6.7 6 7.3 3.5-.6 6-3.8 6-7.3V3.6L8 1Zm0 1.6 4.5 1.9v3.2c0 2.7-1.9 5.2-4.5 5.8-2.6-.6-4.5-3.1-4.5-5.8V4.5L8 2.6Z" />
            </svg>
          </span>

          <h1 className="mt-5 text-xl leading-tight font-semibold text-haze-100">
            {FACILITY.name}
          </h1>
          <p className="mt-1 text-sm text-haze-400">
            Digital Twin — Corrections Operations Center
          </p>
          <p className="mt-4 text-xs leading-relaxed text-haze-500">
            This Microsoft Fabric App contains restricted operational data. Sign
            in with your organisational account to continue.
          </p>

          <button
            type="button"
            onClick={() => void handleSignIn()}
            disabled={isLoading}
            className="mt-6 flex w-full items-center justify-center rounded-xl bg-fabric-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-fabric-500 disabled:opacity-50"
          >
            {msLogo}
            {buttonLabel}
          </button>

          {error && (
            <p className="mt-3 text-center text-sm text-status-critical">
              {error}
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-haze-500">
          {FACILITY.region}
        </p>
      </div>
    </div>
  );
}
