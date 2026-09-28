/**
 * Import test page: upload a Word document, preview parsed sections,
 * generate Playwright scripts, and save everything to the database.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/hooks/AuthContext';
import { useAzureAi } from '@/hooks/AzureAiContext';
import {
  parseTestDocument,
  type ParsedDocument,
  type ParsedTestSection,
} from '@/services/docParser';
import { generatePlaywrightScript } from '@/services/scriptGenerator';
import {
  createScript,
  createStep,
  createTest,
  listApplications,
  type ApplicationRow,
} from '@/services/testStore';

type StepInference = {
  action: string;
  target?: string;
  value?: string;
};

/** Map a plain-language step description to the closest action type. */
function inferStepAction(lower: string, raw: string): StepInference {
  // Screenshot — check first so "take a screenshot" doesn't fall through
  if (lower.includes('screenshot'))
    return { action: 'screenshot' };

  // Navigate
  if (lower.startsWith('go to ') || lower.startsWith('navigate '))
    return { action: 'navigate', value: raw.replace(/^(go to|navigate to?)\s+/i, '') };

  // Verify / Confirm
  if (lower.startsWith('verify') || lower.startsWith('confirm'))
    return { action: 'confirmValue', target: raw.replace(/^(verify|confirm)\s+(that\s+)?/i, ''), value: 'Filled' };

  // Type / Enter / Add text
  if (lower.startsWith('type ') || lower.startsWith('enter ') || lower.match(/^add\s+["']/))
    return { action: 'type', target: raw };

  // Select / Dropdown
  if (lower.startsWith('select ') || lower.includes('drop-down') || lower.includes('dropdown'))
    return { action: 'select', target: raw };

  // Wait
  if (lower.startsWith('wait'))
    return { action: 'waitForText', target: raw };

  // Click — broad match last: "click", "hit", "press", "tap", "open"
  if (lower.match(/^(click|hit|press|tap|open)\s/))
    return { action: 'click', target: raw };

  // Default: click (most manual test steps are clicking things)
  return { action: 'click', target: raw };
}

type GenerationState = 'idle' | 'generating' | 'done' | 'error';

interface SectionState {
  section: ParsedTestSection;
  script: string | null;
  state: GenerationState;
  error: string | null;
  testId: string | null;
}

export function ImportTestPage() {
  const { user } = useAuth();
  const { connected } = useAzureAi();
  const navigate = useNavigate();

  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [selectedAppId, setSelectedAppId] = useState('');
  const [parsed, setParsed] = useState<ParsedDocument | null>(null);
  const [sections, setSections] = useState<SectionState[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void listApplications().then((a) => {
      setApps(a);
      if (a.length > 0) setSelectedAppId(a[0].id);
    });
  }, []);

  async function handleFile(file: File) {
    setFileError(null);
    setParsed(null);
    setSections([]);

    if (!file.name.endsWith('.docx')) {
      setFileError('Please upload a .docx file.');
      return;
    }

    try {
      const doc = await parseTestDocument(file);
      setParsed(doc);
      setSections(
        doc.sections.map((s) => ({
          section: s,
          script: null,
          state: 'idle',
          error: null,
          testId: null,
        }))
      );
    } catch (err) {
      setFileError(
        err instanceof Error ? err.message : 'Could not parse the document.'
      );
    }
  }

  async function generateAll() {
    if (!parsed || !selectedAppId) return;
    setBusy(true);

    const app = apps.find((a) => a.id === selectedAppId);
    if (!app) return;

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i];
      setSections((prev) =>
        prev.map((s, j) => (j === i ? { ...s, state: 'generating' } : s))
      );

      try {
        // Inferred first so the script and the step rows are generated from
        // one source, rather than the model reading raw prose while the editor
        // shows separately inferred actions.
        const inferredSteps = sec.section.steps.map((stepText, idx) => {
          const inferred = inferStepAction(stepText.toLowerCase(), stepText);
          return {
            step_number: idx + 1,
            action: inferred.action,
            target: inferred.target,
            value: inferred.value,
          };
        });

        const result = await generatePlaywrightScript({
          applicationName: app.name,
          startUrl: app.start_url,
          testName: sec.section.name,
          steps: inferredSteps,
        });

        // Create the test case
        const now = new Date();
        const test = await createTest({
          name: sec.section.name,
          description: `Imported from "${parsed.title}"`,
          application_id: selectedAppId,
          device_profile: 'Desktop',
          auth_method: 'None',
          tags: 'imported',
          timeout_seconds: 300,
          capture_screenshot_every_step: true,
          status: 'Active',
          created_by: user?.id ?? 'unknown',
          created_at: now,
          updated_at: now,
        });

        // Create step rows for the UI with inferred action types
        for (const step of inferredSteps) {
          await createStep({
            test_id: test.id,
            step_number: step.step_number,
            action: step.action,
            target: step.target,
            value: step.value,
            optional: false,
          });
        }

        // Store the generated script
        await createScript({
          test_id: test.id,
          script_body: result.script,
          status: 'generated',
          generated_by_model: result.model,
          version_hash: String(Date.now()),
          created_by: user?.id ?? 'unknown',
          created_at: now,
          updated_at: now,
        });

        setSections((prev) =>
          prev.map((s, j) =>
            j === i
              ? {
                  ...s,
                  script: result.script,
                  state: 'done',
                  testId: test.id,
                }
              : s
          )
        );
      } catch (err) {
        setSections((prev) =>
          prev.map((s, j) =>
            j === i
              ? {
                  ...s,
                  state: 'error',
                  error:
                    err instanceof Error
                      ? err.message
                      : 'Script generation failed.',
                }
              : s
          )
        );
      }
    }

    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Import tests</h1>
        <p className="mt-1 text-sm text-gray-600">
          Upload a Word document with test steps. A Playwright script is
          generated for each test section automatically.
        </p>
      </div>

      {fileError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {fileError}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-700">
              Application
            </span>
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">
              Test script document (.docx)
            </span>
            <input
              type="file"
              accept=".docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
              className="mt-1 w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50"
            />
          </label>
        </div>
      </section>

      {parsed && sections.length > 0 && (
        <>
          <section className="rounded-xl border border-gray-200 bg-white">
            <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  {parsed.title}
                </h2>
                <p className="text-xs text-gray-500">
                  {sections.length} test section
                  {sections.length === 1 ? '' : 's'} found
                </p>
              </div>
              <button
                onClick={() => void generateAll()}
                disabled={busy || !connected || !selectedAppId}
                title={
                  !connected
                    ? 'Connect to Azure AI first'
                    : !selectedAppId
                      ? 'Select an application first'
                      : undefined
                }
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy
                  ? 'Generating…'
                  : 'Generate Playwright scripts'}
              </button>
            </header>

            <ul className="divide-y divide-gray-100">
              {sections.map((sec, i) => (
                <li key={i} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {sec.section.name}
                        </span>
                        {sec.state === 'generating' && (
                          <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                            Generating…
                          </span>
                        )}
                        {sec.state === 'done' && (
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                            Done
                          </span>
                        )}
                        {sec.state === 'error' && (
                          <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">
                            Failed
                          </span>
                        )}
                      </div>

                      <ol className="mt-2 space-y-1 text-sm text-gray-600">
                        {sec.section.steps.map((step, j) => (
                          <li key={j} className="flex gap-2">
                            <span className="w-5 shrink-0 text-right text-xs text-gray-400">
                              {j + 1}.
                            </span>
                            {step}
                          </li>
                        ))}
                      </ol>

                      {sec.error && (
                        <p className="mt-2 text-sm text-red-600">{sec.error}</p>
                      )}
                    </div>

                    {sec.testId && (
                      <button
                        onClick={() => navigate(`/tests/${sec.testId}`)}
                        className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Open test
                      </button>
                    )}
                  </div>

                  {sec.script && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-medium text-blue-700">
                        View generated script
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-gray-50 p-3 text-xs text-gray-800">
                        {sec.script}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
