import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { GlossaryLayout } from '@/components/glossary/GlossaryLayout';
import { useAuth } from '@/hooks/AuthContext';
import { useThemePreference } from '@/hooks/useThemePreference';
import { ensureGlossarySeedData, getGlossaryHomeData, resolveUserRole } from '@/services/glossaryService';
import type { GlossaryHomeData } from '@/types/glossary';

const emptyData: GlossaryHomeData = {
  terms: [],
  categories: [],
  totalTerms: 0,
  recentUpdates: [],
  owners: [],
  departments: [],
};

export function GlossaryHomePage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useThemePreference();
  const role = resolveUserRole(user);

  const [data, setData] = useState<GlossaryHomeData>(emptyData);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [department, setDepartment] = useState('');
  const [owner, setOwner] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      await ensureGlossarySeedData();
      const home = await getGlossaryHomeData({
        query,
        categoryId: categoryId || undefined,
        department: department || undefined,
        owner: owner || undefined,
      });
      setData(home);
      setLoading(false);
    };

    void run();
  }, [query, categoryId, department, owner]);

  const updatedSummary = useMemo(
    () =>
      data.recentUpdates.map((term) => ({
        id: term.id,
        name: term.name,
        when: new Date(term.modifiedDate).toLocaleDateString(),
      })),
    [data.recentUpdates]
  );

  return (
    <GlossaryLayout
      title="Contoso Glossary"
      subtitle="Discover business terminology, owners, and definitions across your organization."
      theme={theme}
      onThemeToggle={toggleTheme}
    >
      <section className="dashboard-grid">
        <article className="insight-card hero-search-card">
          <h2>Search the glossary</h2>
          <p>Find terms by keyword, natural language, owner, or category.</p>
          <input
            className="fluent-input fluent-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try: How do we define churn and retention metrics?"
          />
          <div className="filter-row">
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">All categories</option>
              {data.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select value={department} onChange={(event) => setDepartment(event.target.value)}>
              <option value="">All departments</option>
              {data.departments.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select value={owner} onChange={(event) => setOwner(event.target.value)}>
              <option value="">All owners</option>
              {data.owners.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </article>

        <article className="insight-card metric-card">
          <h3>Total Terms</h3>
          <p className="metric-value">{data.totalTerms}</p>
          <small>Centralized enterprise glossary entries.</small>
        </article>

        <article className="insight-card metric-card">
          <h3>Recently Updated</h3>
          <ul className="recent-list">
            {updatedSummary.map((item) => (
              <li key={item.id}>
                <Link to={`/terms/${item.id}`}>{item.name}</Link>
                <span>{item.when}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="section-actions">
        <h2>Glossary Terms</h2>
        <div className="action-cluster">
          <button
            className={viewMode === 'cards' ? 'fluent-btn selected' : 'fluent-btn subtle'}
            onClick={() => setViewMode('cards')}
          >
            Card view
          </button>
          <button
            className={viewMode === 'table' ? 'fluent-btn selected' : 'fluent-btn subtle'}
            onClick={() => setViewMode('table')}
          >
            Table view
          </button>
          {role === 'editor' && (
            <Link className="fluent-btn" to="/admin/terms/new">
              Add term
            </Link>
          )}
        </div>
      </section>

      {loading ? (
        <div className="state-card">Loading glossary terms...</div>
      ) : data.terms.length === 0 ? (
        <div className="state-card">No terms matched your filters.</div>
      ) : viewMode === 'cards' ? (
        <section className="cards-grid">
          {data.terms.map((term) => (
            <article className="term-card" key={term.id}>
              <div className="term-card-header">
                <h3>
                  <Link to={`/terms/${term.id}`}>{term.name}</Link>
                </h3>
                <span>{term.category?.name ?? 'Uncategorized'}</span>
              </div>
              <p>{term.definition}</p>
              <div className="term-meta">
                <span>Owner: {term.owner}</span>
                <span>Department: {term.department ?? 'N/A'}</span>
              </div>
              <div className="tag-row">
                {term.synonyms.slice(0, 3).map((synonym) => (
                  <span className="synonym-pill" key={`${term.id}-${synonym}`}>
                    {synonym}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="table-wrap">
          <table className="fluent-table">
            <thead>
              <tr>
                <th>Term</th>
                <th>Category</th>
                <th>Owner</th>
                <th>Department</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.terms.map((term) => (
                <tr key={term.id}>
                  <td>
                    <Link to={`/terms/${term.id}`}>{term.name}</Link>
                  </td>
                  <td>{term.category?.name ?? 'Uncategorized'}</td>
                  <td>{term.owner}</td>
                  <td>{term.department ?? 'N/A'}</td>
                  <td>{new Date(term.modifiedDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </GlossaryLayout>
  );
}
