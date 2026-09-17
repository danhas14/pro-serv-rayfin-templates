import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { GlossaryLayout } from '@/components/glossary/GlossaryLayout';
import { useAuth } from '@/hooks/AuthContext';
import { useThemePreference } from '@/hooks/useThemePreference';
import {
  buildAiAssist,
  getGlossaryHomeData,
  getGlossaryTermById,
  resolveUserRole,
  upsertGlossaryTerm,
} from '@/services/glossaryService';
import type { AiGlossaryAssist, GlossaryCategory, GlossaryTerm, UpsertGlossaryTermInput } from '@/types/glossary';

interface FormState {
  name: string;
  definition: string;
  synonyms: string;
  categoryId: string;
  department: string;
  owner: string;
  relatedTermIds: string[];
}

const emptyForm: FormState = {
  name: '',
  definition: '',
  synonyms: '',
  categoryId: '',
  department: '',
  owner: '',
  relatedTermIds: [],
};

const parseSynonyms = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export function TermEditorPage() {
  const { termId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useThemePreference();
  const role = resolveUserRole(user);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [categories, setCategories] = useState<GlossaryCategory[]>([]);
  const [allTerms, setAllTerms] = useState<GlossaryTerm[]>([]);
  const [assist, setAssist] = useState<AiGlossaryAssist | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(termId);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setAssist(null);
      const home = await getGlossaryHomeData({ query: '' });
      setCategories(home.categories);
      setAllTerms(home.terms);

      if (!isEditing || !termId) {
        setLoading(false);
        return;
      }

      const term = await getGlossaryTermById(termId);
      if (!term) {
        setError('Term not found.');
        setLoading(false);
        return;
      }

      setForm({
        name: term.name,
        definition: term.definition,
        synonyms: term.synonyms.join(', '),
        categoryId: term.category?.id ?? '',
        department: term.department ?? '',
        owner: term.owner,
        relatedTermIds: term.relatedTermIds,
      });

      const aiAssist = await buildAiAssist(term.id);
      setAssist(aiAssist);
      setLoading(false);
    };

    void run();
  }, [isEditing, termId]);

  const availableRelated = useMemo(
    () => allTerms.filter((item) => item.id !== termId),
    [allTerms, termId]
  );

  const selectedSynonyms = useMemo(() => {
    return new Set(parseSynonyms(form.synonyms).map((item) => item.toLowerCase()));
  }, [form.synonyms]);

  const onAddSuggestedSynonym = (value: string) => {
    setForm((prev) => {
      const current = parseSynonyms(prev.synonyms);
      if (current.some((item) => item.toLowerCase() === value.toLowerCase())) {
        return prev;
      }

      return {
        ...prev,
        synonyms: [...current, value].join(', '),
      };
    });
  };

  const onUseDraftDefinition = () => {
    if (!assist) return;
    setForm((prev) => ({ ...prev, definition: assist.draftDefinition }));
  };

  const onAddSuggestedRelatedTerm = (relatedId: string) => {
    setForm((prev) => {
      if (prev.relatedTermIds.includes(relatedId)) {
        return prev;
      }

      return {
        ...prev,
        relatedTermIds: [...prev.relatedTermIds, relatedId],
      };
    });
  };

  if (role !== 'editor') {
    return (
      <GlossaryLayout
        title="Term Administration"
        subtitle="Editor permission required"
        theme={theme}
        onThemeToggle={toggleTheme}
      >
        <div className="state-card">You need editor permissions to create or update glossary terms.</div>
      </GlossaryLayout>
    );
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const payload: UpsertGlossaryTermInput = {
      id: termId,
      name: form.name.trim(),
      definition: form.definition.trim(),
      synonyms: form.synonyms
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      categoryId: form.categoryId || undefined,
      department: form.department.trim() || undefined,
      owner: form.owner.trim(),
      relatedTermIds: form.relatedTermIds,
    };

    try {
      const id = await upsertGlossaryTerm(payload, user);
      navigate(`/terms/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save glossary term.');
      setSaving(false);
    }
  };

  return (
    <GlossaryLayout
      title={isEditing ? 'Edit Glossary Term' : 'Create Glossary Term'}
      subtitle="Manage definitions, synonyms, ownership, and relationships."
      theme={theme}
      onThemeToggle={toggleTheme}
    >
      {loading ? (
        <div className="state-card">Loading editor...</div>
      ) : (
        <section className="editor-layout">
          <form className="editor-form" onSubmit={onSubmit}>
            <label>
              Term Name
              <input
                className="fluent-input"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
            </label>

            <label>
              Definition
              <textarea
                className="fluent-textarea"
                value={form.definition}
                onChange={(event) => setForm((prev) => ({ ...prev, definition: event.target.value }))}
                rows={5}
                required
              />
            </label>

            <div className="form-grid">
              <label>
                Category
                <select
                  value={form.categoryId}
                  onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Department
                <input
                  className="fluent-input"
                  value={form.department}
                  onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))}
                  placeholder="Finance, Sales, Data Platform..."
                />
              </label>

              <label>
                Data Owner
                <input
                  className="fluent-input"
                  value={form.owner}
                  onChange={(event) => setForm((prev) => ({ ...prev, owner: event.target.value }))}
                  required
                />
              </label>
            </div>

            <label>
              Synonyms (comma separated)
              <input
                className="fluent-input"
                value={form.synonyms}
                onChange={(event) => setForm((prev) => ({ ...prev, synonyms: event.target.value }))}
                placeholder="KPI, Key Metric, Performance Indicator"
              />
            </label>

            <label>
              Related Terms
              <select
                multiple
                value={form.relatedTermIds}
                onChange={(event) => {
                  const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                  setForm((prev) => ({ ...prev, relatedTermIds: values }));
                }}
              >
                {availableRelated.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </select>
            </label>

            {error && <div className="error-box">{error}</div>}

            <div className="action-cluster left">
              <button className="fluent-btn" type="submit" disabled={saving}>
                {saving ? 'Saving...' : isEditing ? 'Save changes' : 'Create term'}
              </button>
              <button
                className="fluent-btn subtle"
                type="button"
                onClick={() => navigate(-1)}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </form>

          <aside className="detail-card editor-assist-card">
            <h2>AI Assistance</h2>
            {!isEditing && <p className="muted-text">Save the new term first to unlock AI suggestions.</p>}
            {isEditing && assist ? (
              <>
                <h4>Suggested Synonyms</h4>
                <div className="tag-row">
                  {assist.suggestedSynonyms.map((item) => {
                    const alreadyAdded = selectedSynonyms.has(item.toLowerCase());
                    return (
                      <button
                        key={item}
                        className="synonym-pill assist-chip-button"
                        type="button"
                        onClick={() => onAddSuggestedSynonym(item)}
                        disabled={alreadyAdded}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>

                <h4>Draft Definition</h4>
                <p>{assist.draftDefinition}</p>
                <button className="fluent-btn subtle" type="button" onClick={onUseDraftDefinition}>
                  Use draft definition
                </button>

                <h4>Plain Language</h4>
                <p>{assist.plainLanguageExplanation}</p>

                {assist.suggestedRelatedTerms.length > 0 && (
                  <>
                    <h4>Suggested Related Terms</h4>
                    <ul className="related-list assist-related-list">
                      {assist.suggestedRelatedTerms.map((item) => {
                        const alreadyAdded = form.relatedTermIds.includes(item.id);
                        return (
                          <li key={item.id}>
                            <span>{item.name}</span>
                            <button
                              className="fluent-btn subtle"
                              type="button"
                              onClick={() => onAddSuggestedRelatedTerm(item.id)}
                              disabled={alreadyAdded}
                            >
                              {alreadyAdded ? 'Added' : 'Add'}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </>
            ) : null}
            {isEditing && !assist && <p className="muted-text">AI suggestions are unavailable for this term.</p>}
          </aside>
        </section>
      )}
    </GlossaryLayout>
  );
}
