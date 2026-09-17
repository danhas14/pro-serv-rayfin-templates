import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { GlossaryLayout } from '@/components/glossary/GlossaryLayout';
import { useAuth } from '@/hooks/AuthContext';
import { useThemePreference } from '@/hooks/useThemePreference';
import {
  deleteGlossaryTerm,
  getGlossaryTermById,
  listRelatedTerms,
  resolveUserRole,
} from '@/services/glossaryService';
import type { GlossaryTerm } from '@/types/glossary';

export function TermDetailsPage() {
  const { termId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useThemePreference();
  const role = resolveUserRole(user);

  const [term, setTerm] = useState<GlossaryTerm | null>(null);
  const [related, setRelated] = useState<GlossaryTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const record = await getGlossaryTermById(termId);
      if (!record) {
        setError('Term not found.');
        setLoading(false);
        return;
      }

      setTerm(record);
      const relatedTerms = await listRelatedTerms(record.id);
      setRelated(relatedTerms);
      setLoading(false);
    };

    void run();
  }, [termId]);

  const onDelete = async () => {
    if (!term || role !== 'editor') return;
    const confirmed = window.confirm(`Delete glossary term "${term.name}"?`);
    if (!confirmed) return;

    await deleteGlossaryTerm(term.id, user);
    navigate('/');
  };

  if (loading) {
    return (
      <GlossaryLayout title="Term details" subtitle="Loading details..." theme={theme} onThemeToggle={toggleTheme}>
        <div className="state-card">Loading term details...</div>
      </GlossaryLayout>
    );
  }

  if (!term) {
    return (
      <GlossaryLayout title="Term details" subtitle="Unable to load term." theme={theme} onThemeToggle={toggleTheme}>
        <div className="state-card">{error ?? 'Term not found.'}</div>
      </GlossaryLayout>
    );
  }

  return (
    <GlossaryLayout
      title={term.name}
      subtitle="Business term profile"
      theme={theme}
      onThemeToggle={toggleTheme}
    >
      <section className="detail-grid">
        <article className="detail-card">
          <h2>Definition</h2>
          <p>{term.definition}</p>

          <div className="detail-meta-grid">
            <div>
              <h4>Business Category</h4>
              <p>{term.category?.name ?? 'Uncategorized'}</p>
            </div>
            <div>
              <h4>Data Owner</h4>
              <p>{term.owner}</p>
            </div>
            <div>
              <h4>Department</h4>
              <p>{term.department ?? 'N/A'}</p>
            </div>
            <div>
              <h4>Last Updated</h4>
              <p>{new Date(term.modifiedDate).toLocaleString()}</p>
            </div>
          </div>

          <h4>Synonyms</h4>
          <div className="tag-row">
            {term.synonyms.map((synonym) => (
              <span key={synonym} className="synonym-pill">
                {synonym}
              </span>
            ))}
            {term.synonyms.length === 0 && <span className="muted-text">No synonyms defined.</span>}
          </div>

          {role === 'editor' && (
            <div className="action-cluster left detail-actions">
              <Link className="fluent-btn" to={`/admin/terms/${term.id}/edit`}>
                Edit term
              </Link>
              <button className="fluent-btn danger" onClick={() => void onDelete()}>
                Delete
              </button>
            </div>
          )}
        </article>

        <article className="detail-card">
          <h2>Related Terms</h2>
          <ul className="related-list">
            {related.map((item) => (
              <li key={item.id}>
                <Link to={`/terms/${item.id}`}>{item.name}</Link>
              </li>
            ))}
            {related.length === 0 && <li>No related terms available.</li>}
          </ul>
        </article>
      </section>
    </GlossaryLayout>
  );
}
