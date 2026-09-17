import { useState } from 'react';
import { Link } from 'react-router-dom';

import { GlossaryLayout } from '@/components/glossary/GlossaryLayout';
import { useThemePreference } from '@/hooks/useThemePreference';
import { semanticSearchGlossary } from '@/services/glossaryService';
import type { GlossarySearchResult } from '@/types/glossary';

export function SemanticSearchPage() {
  const { theme, toggleTheme } = useThemePreference();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlossarySearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = async () => {
    setLoading(true);
    const items = await semanticSearchGlossary(query);
    setResults(items);
    setLoading(false);
  };

  return (
    <GlossaryLayout
      title="AI Semantic Search"
      subtitle="Search using natural language, synonyms, and related business context."
      theme={theme}
      onThemeToggle={toggleTheme}
    >
      <section className="insight-card semantic-search">
        <h2>Ask in plain language</h2>
        <p>
          Example: terms related to customer retention and revenue health
        </p>
        <div className="semantic-note">
          Semantic search ranks terms by meaning, synonyms, and related business context.
        </div>
        <div className="semantic-input-row">
          <input
            className="fluent-input fluent-search"
            placeholder="Type your search intent..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void runSearch();
              }
            }}
          />
          <button className="fluent-btn" onClick={() => void runSearch()}>
            Run semantic search
          </button>
        </div>
      </section>

      {loading ? (
        <div className="state-card">Ranking glossary entries...</div>
      ) : (
        <section className="search-results-grid">
          {results.map((result) => (
            <article key={result.term.id} className="result-card">
              <h3>
                <Link to={`/terms/${result.term.id}`}>{result.term.name}</Link>
              </h3>
              <p>{result.term.definition}</p>
              <div className="result-meta">
                <span>Score: {result.score}</span>
                <span>Reason: {result.reason}</span>
                <span>Owner: {result.term.owner}</span>
              </div>
            </article>
          ))}
          {!loading && results.length === 0 && (
            <div className="state-card">No results yet. Try a broader natural language query.</div>
          )}
        </section>
      )}
    </GlossaryLayout>
  );
}
