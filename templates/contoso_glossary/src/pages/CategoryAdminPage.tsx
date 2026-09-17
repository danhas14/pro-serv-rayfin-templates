import { useEffect, useState } from 'react';

import { GlossaryLayout } from '@/components/glossary/GlossaryLayout';
import { useAuth } from '@/hooks/AuthContext';
import { useThemePreference } from '@/hooks/useThemePreference';
import {
  deleteGlossaryCategory,
  listGlossaryCategories,
  resolveUserRole,
  upsertGlossaryCategory,
} from '@/services/glossaryService';
import type { GlossaryCategory } from '@/types/glossary';

export function CategoryAdminPage() {
  const { user } = useAuth();
  const role = resolveUserRole(user);
  const { theme, toggleTheme } = useThemePreference();

  const [categories, setCategories] = useState<GlossaryCategory[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const items = await listGlossaryCategories();
    setCategories(items);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await upsertGlossaryCategory({ name: name.trim(), description: description.trim() || undefined }, user);
      setName('');
      setDescription('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category.');
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm('Delete this category? Existing terms will keep their data but become uncategorized.')) {
      return;
    }

    try {
      await deleteGlossaryCategory(id, user);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category.');
    }
  };

  return (
    <GlossaryLayout
      title="Category Administration"
      subtitle="Manage glossary categories and descriptions."
      theme={theme}
      onThemeToggle={toggleTheme}
    >
      {role !== 'editor' ? (
        <div className="state-card">You need editor permissions to manage categories.</div>
      ) : (
        <>
          <form className="insight-card category-form" onSubmit={onCreate}>
            <h2>Add Category</h2>
            <label>
              Name
              <input className="fluent-input" value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              Description
              <textarea
                className="fluent-textarea"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <button className="fluent-btn" type="submit">
              Add category
            </button>
            {error && <div className="error-box">{error}</div>}
          </form>

          <section className="table-wrap">
            <table className="fluent-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td>{category.description ?? 'No description'}</td>
                    <td>
                      <button className="fluent-btn subtle danger" onClick={() => void onDelete(category.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && categories.length === 0 && (
                  <tr>
                    <td colSpan={3}>No categories yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </GlossaryLayout>
  );
}
