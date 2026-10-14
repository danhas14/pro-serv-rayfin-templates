import { useEffect, useState } from 'react';

import { FACILITY } from '@/data/twin';
import { useAuth } from '@/hooks/AuthContext';
import { useTwin, useTwinState } from '@/hooks/TwinContext';
import { cx } from '@/lib/format';

const RISK_TONE: Record<string, string> = {
  Low: 'border-status-normal/40 bg-status-normal/10 text-status-normal',
  Guarded: 'border-status-normal/40 bg-status-normal/10 text-status-normal',
  Elevated:
    'border-status-elevated/40 bg-status-elevated/10 text-status-elevated',
  High: 'border-status-risk/45 bg-status-risk/10 text-status-risk',
  Severe: 'border-status-critical/45 bg-status-critical/10 text-status-critical',
};

export function AppHeader() {
  const { user, signOut } = useAuth();
  const { risk } = useTwin();
  const { source } = useTwinState();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-ink-700/70 bg-ink-950/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-fabric-500 to-fabric-700 shadow-lg shadow-fabric-700/30">
            <svg
              viewBox="0 0 16 16"
              className="size-4.5 text-white"
              fill="currentColor"
            >
              <path d="M8 1 2 3.6v4.1c0 3.5 2.5 6.7 6 7.3 3.5-.6 6-3.8 6-7.3V3.6L8 1Zm0 1.6 4.5 1.9v3.2c0 2.7-1.9 5.2-4.5 5.8-2.6-.6-4.5-3.1-4.5-5.8V4.5L8 2.6Z" />
            </svg>
          </span>
          <div>
            <h1 className="text-[15px] leading-tight font-semibold text-haze-100">
              {FACILITY.name}
            </h1>
            <p className="text-[11px] text-haze-500">
              Digital Twin · {FACILITY.region} · Microsoft Fabric App
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {source === 'dev-snapshot' && (
            <span
              className="rounded-full border border-status-elevated/40 bg-status-elevated/10 px-3 py-1.5 text-[11px] font-medium text-status-elevated"
              title="The Fabric embed proxy only reaches the semantic model inside the Fabric portal. This is the generated development snapshot."
            >
              Dev snapshot
            </span>
          )}
          {source === 'semantic-model' && (
            <span
              className="hidden items-center gap-1.5 rounded-full border border-fabric-500/35 bg-fabric-500/10 px-3 py-1.5 text-[11px] font-medium text-fabric-300 sm:inline-flex"
              title="Figures are queried live from the North Valley Corrections Twin semantic model."
            >
              <svg viewBox="0 0 16 16" className="size-3" fill="currentColor">
                <path d="M8 1.5c3 0 5.5 1 5.5 2.3v8.4C13.5 13.5 11 14.5 8 14.5s-5.5-1-5.5-2.3V3.8C2.5 2.5 5 1.5 8 1.5Zm4.1 4.3c-1 .5-2.5.8-4.1.8s-3.1-.3-4.1-.8v2c0 .5 1.8 1.3 4.1 1.3s4.1-.8 4.1-1.3v-2ZM8 2.9c-2.3 0-4.1.6-4.1 1s1.8 1 4.1 1 4.1-.6 4.1-1-1.8-1-4.1-1Z" />
              </svg>
              Semantic model
            </span>
          )}

          <span className="flex items-center gap-1.5 rounded-full border border-status-normal/35 bg-status-normal/10 px-3 py-1.5 text-[11px] font-medium text-status-normal">
            <span
              className="size-1.5 rounded-full bg-status-normal"
              style={{ animation: 'ops-pulse 2s ease-in-out infinite' }}
            />
            Facility {FACILITY.status}
          </span>

          <span
            className={cx(
              'rounded-full border px-3 py-1.5 text-[11px] font-medium',
              RISK_TONE[risk.band] ?? RISK_TONE.Elevated
            )}
          >
            Risk {risk.score}/100 · {risk.band}
          </span>

          <span className="tabular hidden rounded-full border border-ink-700 bg-ink-900 px-3 py-1.5 text-[11px] text-haze-300 sm:inline-flex">
            {now.toLocaleTimeString('en-US', { hour12: false })}
          </span>

          {user && (
            <div className="flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900 py-1 pl-1 pr-1">
              <span className="flex size-7 items-center justify-center rounded-full bg-fabric-600/25 text-[11px] font-semibold text-fabric-300">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-[150px] truncate text-[11px] text-haze-300 md:inline">
                {user.name}
              </span>
              <button
                onClick={() => void signOut()}
                className="rounded-full px-2.5 py-1 text-[11px] text-haze-500 transition-colors hover:bg-ink-800 hover:text-haze-100"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
