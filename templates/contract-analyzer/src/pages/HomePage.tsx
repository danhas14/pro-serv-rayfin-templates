import { useCallback, useEffect, useState } from 'react';

import { ContractIntake } from '@/components/ContractIntake';
import { ContractQaPanel } from '@/components/ContractQaPanel';
import { ExtractedFieldsPanel } from '@/components/ExtractedFieldsPanel';
import { useAuth } from '@/hooks/AuthContext';
import { contractAi, fileToBase64 } from '@/services/contractAiClient';
import {
  deleteContract,
  getContract,
  listContracts,
  type ContractDetail,
  type ContractSummary,
} from '@/services/contractStore';
import { SignInRequiredError, signInToFabric } from '@/services/fabricAuth';
import type { QaTurn } from '@/types/contract';

function messageOf(err: unknown): string {
  if (err instanceof SignInRequiredError) return err.message;
  return err instanceof Error ? err.message : 'Something went wrong.';
}

export function HomePage() {
  const { user, signOut } = useAuth();

  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [selected, setSelected] = useState<ContractDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAiSignIn, setNeedsAiSignIn] = useState(false);
  const [turns, setTurns] = useState<QaTurn[]>([]);

  const refreshList = useCallback(async () => {
    setContracts(await listContracts());
  }, []);

  useEffect(() => {
    refreshList().catch((err) => setError(messageOf(err)));
  }, [refreshList]);

  const openContract = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const detail = await getContract(id);
      setSelected(detail);
      setTurns([]);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  /**
   * Wait for an in-flight analysis to finish, polling the backend.
   *
   * `analyze_contract` only *starts* the work and returns a `Processing` row,
   * so the browser drives the wait here — one short `poll_contract` call every
   * few seconds. That keeps each function call well under the 240-second Fabric
   * limit, so a large contract that takes minutes to analyze still completes.
   * Capped so a stuck job cannot poll forever.
   */
  const pollUntilDone = useCallback(async (contractId: string) => {
    const deadline = Date.now() + 20 * 60 * 1000; // 20 minutes
    for (;;) {
      const result = await contractAi.poll(contractId);
      if (result.status === 'Succeeded') return;
      if (result.status === 'Failed') {
        throw new Error(
          result.error ?? 'The contract could not be analyzed.'
        );
      }
      if (Date.now() > deadline) {
        throw new Error(
          'This contract is still being analyzed. It will keep processing — ' +
            'reopen it from the list in a few minutes.'
        );
      }
      const waitMs = (result.pollIntervalSeconds ?? 3) * 1000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }, []);

  /**
   * Shared tail of both analyze paths.
   *
   * The function starts the analysis and returns a `Processing` id; we poll it
   * to completion, then refresh the list and select the finished contract.
   */
  const runAnalysis = useCallback(
    async (
      run: (ownerId: string) => Promise<{ contractId: string; status: string }>
    ) => {
      if (!user) return;
      setBusy(true);
      setError(null);
      setNeedsAiSignIn(false);
      try {
        const { contractId, status } = await run(user.id);
        if (status === 'Processing') {
          await pollUntilDone(contractId);
        }
        await refreshList();
        await openContract(contractId);
      } catch (err) {
        if (err instanceof SignInRequiredError) setNeedsAiSignIn(true);
        setError(messageOf(err));
      } finally {
        setBusy(false);
      }
    },
    [user, refreshList, openContract, pollUntilDone]
  );

  const handleAnalyzeFile = useCallback(
    async (file: File) =>
      runAnalysis(async (ownerId) => {
        const contentBase64 = await fileToBase64(file);
        return contractAi.analyzeFile(
          ownerId,
          file.name,
          file.type,
          contentBase64
        );
      }),
    [runAnalysis]
  );

  const handleAnalyzeUrl = useCallback(
    async (url: string) =>
      runAnalysis((ownerId) => contractAi.analyzeUrl(ownerId, url)),
    [runAnalysis]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setBusy(true);
      setError(null);
      try {
        await deleteContract(id);
        if (selected?.id === id) {
          setSelected(null);
          setTurns([]);
        }
        await refreshList();
      } catch (err) {
        setError(messageOf(err));
      } finally {
        setBusy(false);
      }
    },
    [selected, refreshList]
  );

  const handleAsk = useCallback(
    async (question: string) => {
      if (!selected) return;

      const id = crypto.randomUUID();
      setTurns((prev) => [
        ...prev,
        { id, question, answer: null, error: null, pending: true },
      ]);

      try {
        const { answer } = await contractAi.ask(question, selected.id);
        setTurns((prev) =>
          prev.map((turn) =>
            turn.id === id ? { ...turn, answer, pending: false } : turn
          )
        );
      } catch (err) {
        if (err instanceof SignInRequiredError) setNeedsAiSignIn(true);
        const detail = messageOf(err);
        setTurns((prev) =>
          prev.map((turn) =>
            turn.id === id ? { ...turn, error: detail, pending: false } : turn
          )
        );
      }
    },
    [selected]
  );

  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  /**
   * True when the app is running inside another page's frame — which it is in
   * the Fabric portal. Browsers frequently suppress `window.open` from a
   * cross-origin iframe, and MSAL's consent popup is exactly that, so a click
   * can produce no popup and no error. Worth calling out explicitly rather than
   * leaving the user staring at an unchanged banner.
   */
  const isEmbedded =
    typeof window !== 'undefined' && window.self !== window.top;

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      await signInToFabric(user?.email);
      setNeedsAiSignIn(false);
      setError(null);
    } catch (err) {
      setConnectError(messageOf(err));
    } finally {
      setConnecting(false);
    }
  }, [user]);

  return (
    // On large screens the app is pinned to the viewport and each column scrolls
    // on its own, so a contract with many extracted fields can no longer stretch
    // the row and push the Q&A input below the fold. Below `lg` the columns
    // stack and the page scrolls normally.
    <div className="flex min-h-screen flex-col bg-slate-950 lg:h-screen lg:min-h-0">
      <header className="relative shrink-0 border-b border-slate-800 bg-slate-900 px-6 py-5">
        <h1 className="text-center text-2xl font-bold text-white">
          Contract Analyzer
        </h1>
        <button
          type="button"
          onClick={signOut}
          className="absolute top-1/2 right-6 -translate-y-1/2 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700"
        >
          Sign out
        </button>
      </header>

      {needsAiSignIn && (
        <div className="shrink-0 border-b border-amber-900 bg-amber-950/40 px-6 py-3">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-amber-200">
                Azure AI needs a separate consent for your account before this
                app can analyze contracts on your behalf.
              </p>
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-60"
              >
                {connecting ? 'Waiting for sign-in...' : 'Connect to Azure AI'}
              </button>
            </div>

            {connectError && (
              <p role="alert" className="mt-2 text-sm text-red-300">
                {connectError}
              </p>
            )}

            {isEmbedded && (
              <p className="mt-2 text-xs text-amber-300/80">
                No sign-in window? Browsers often block pop-ups from an embedded
                page.{' '}
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-amber-200"
                >
                  Open this app in its own tab
                </a>{' '}
                and try again there.
              </p>
            )}
          </div>
        </div>
      )}

      {/* `grid-rows-[minmax(0,1fr)]` is what actually lets the children shrink:
          a default `auto` row would size to content and overflow the main. */}
      <main className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 p-6 lg:min-h-0 lg:flex-1 lg:grid-cols-3 lg:grid-rows-[minmax(0,1fr)]">
        <ContractIntake
          contracts={contracts}
          selectedId={selected?.id ?? null}
          busy={busy}
          error={error}
          onAnalyzeFile={handleAnalyzeFile}
          onAnalyzeUrl={handleAnalyzeUrl}
          onSelect={openContract}
          onDelete={handleDelete}
        />
        <ExtractedFieldsPanel contract={selected} loading={loadingDetail} />
        <ContractQaPanel
          contractId={selected?.id ?? null}
          turns={turns}
          onAsk={handleAsk}
        />
      </main>
    </div>
  );
}
