import { Database, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { ErrorState } from '@/components/States';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useData } from '@/hooks/DataContext';
import {
  seedDemoData,
  type SeedProgress,
} from '@/services/seed/seedService';

/**
 * Shown when the database has no demo dataset yet.
 *
 * Seeding runs through the same authenticated data client the rest of the app
 * uses — there is no privileged back door — so it is a visible, cancellable,
 * progress-reported operation rather than a hidden migration.
 */
export function SeedGate() {
  const { refresh } = useData();
  const [progress, setProgress] = useState<SeedProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const result = await seedDemoData(setProgress);
      toast.success(
        `Loaded ${result.invoices.toLocaleString()} invoices, ${result.payments.toLocaleString()} payments and ${result.exceptions} exceptions.`
      );
      await refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Demo data could not be loaded.';
      setError(message);
      toast.error(message);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  const pct = progress
    ? Math.round((progress.overallDone / progress.overallTotal) * 100)
    : 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" aria-hidden="true" />
            <CardTitle>Load the demonstration dataset</CardTitle>
          </div>
          <CardDescription>
            This workspace has no operational data yet. Loading generates a
            synthetic 90-day payment operation: 20 business customers, 100
            vendors, more than 1,500 invoices and 1,200 payments across ACH,
            check, virtual card, wire and cross-border rails, plus the exception
            queue, approval trails and daily operating metrics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Every record is invented locally. No external system is contacted.</li>
            <li>• No real customer, vendor, bank, card or employee data is used.</li>
            <li>• Loading takes a few minutes because each row is written through the data API.</li>
          </ul>

          {error ? <ErrorState message={error} onRetry={run} /> : null}

          {running && progress ? (
            <div className="space-y-2" role="status" aria-live="polite">
              <Progress value={pct} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress.phase}</span>
                <span className="tabular-nums">
                  {progress.overallDone.toLocaleString()} /{' '}
                  {progress.overallTotal.toLocaleString()} records ({pct}%)
                </span>
              </div>
            </div>
          ) : null}

          <Button onClick={run} disabled={running} className="w-full">
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Loading demo data…
              </>
            ) : (
              'Load demo data'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
