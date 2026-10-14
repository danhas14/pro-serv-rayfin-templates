import { useCallback, useState } from 'react';

import { AppHeader } from '@/components/AppHeader';
import { BuildingDetailPanel } from '@/components/BuildingDetailPanel';
import { BuildingInventory } from '@/components/BuildingInventory';
import { CopilotPanel } from '@/components/CopilotPanel';
import { ExecutiveDashboard } from '@/components/ExecutiveDashboard';
import { FacilityMap } from '@/components/FacilityMap';
import { KpiBand } from '@/components/KpiBand';
import { PredictiveAlerts } from '@/components/PredictiveAlerts';
import { TrendSection } from '@/components/TrendSection';
import { FACILITY } from '@/data/twin';
import { useTwin, useTwinState } from '@/hooks/TwinContext';
import type { MapView } from '@/lib/metrics';

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950">
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-2 rounded-full bg-fabric-400"
              style={{
                animation: 'ops-pulse 1s ease-in-out infinite',
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
        <p className="text-sm text-haze-400">
          Querying the {FACILITY.code} semantic model…
        </p>
      </div>
    </div>
  );
}

function ErrorScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="ops-panel max-w-lg p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg border border-status-critical/40 bg-status-critical/10 text-status-critical">
            <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
              <path d="M8 1.5 15 14H1L8 1.5Zm0 3.2L3.4 12.8h9.2L8 4.7ZM7.3 7h1.4v3.1H7.3V7Zm0 3.8h1.4v1.3H7.3v-1.3Z" />
            </svg>
          </span>
          <h1 className="text-base font-semibold text-haze-100">
            Could not load the facility twin
          </h1>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-haze-300">
          {message}
        </p>

        <p className="mt-3 text-[12px] leading-relaxed text-haze-500">
          This dashboard reads the North Valley Corrections Twin semantic model
          through the Fabric host. Open the app from the Fabric portal and
          confirm you have read access to the model in its workspace.
        </p>

        <button
          onClick={onRetry}
          className="mt-5 rounded-xl bg-fabric-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-fabric-500"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function Dashboard() {
  const twin = useTwin();
  const [view, setView] = useState<MapView>('status');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<string[]>([]);

  const focusBuildings = useCallback((ids: string[]) => {
    setHighlighted(ids);
  }, []);

  return (
    <div className="ops-grid-backdrop min-h-screen bg-ink-950">
      <AppHeader />

      <main className="mx-auto max-w-[1680px] space-y-3 px-5 py-4">
        <section aria-label="Facility overview">
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-haze-500">
              Facility Overview
            </h2>
            <p className="text-[11px] text-haze-500">
              Reporting period ending {twin.reportingPeriod} · {twin.monthCount}{' '}
              periods of history
            </p>
          </div>
          <KpiBand />
        </section>

        <FacilityMap
          view={view}
          onViewChange={setView}
          selectedId={selectedId}
          onSelect={setSelectedId}
          highlighted={highlighted}
        />

        <section aria-label="Historical trends">
          <TrendSection />
        </section>

        <section
          aria-label="Assistant and alerts"
          className="grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"
        >
          <CopilotPanel onFocusBuildings={focusBuildings} />
          <PredictiveAlerts onSelectBuilding={setSelectedId} />
        </section>

        <BuildingInventory selectedId={selectedId} onSelect={setSelectedId} />

        <ExecutiveDashboard />

        <footer className="flex flex-wrap items-center justify-between gap-2 px-1 pb-6 pt-2 text-[11px] text-haze-500">
          <p>
            {FACILITY.name} ({FACILITY.code}) digital twin · demonstration
            dataset
          </p>
          <p>Built on Microsoft Fabric · Rayfin</p>
        </footer>
      </main>

      <BuildingDetailPanel
        buildingId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

export function HomePage() {
  const { twin, loading, error, refresh } = useTwinState();

  if (loading) return <LoadingScreen />;
  if (error || !twin) {
    return (
      <ErrorScreen
        message={error ?? 'The semantic model returned no data.'}
        onRetry={refresh}
      />
    );
  }

  return <Dashboard />;
}
