import { useEffect, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

import contosoLogo from '@/assets/contoso-logo.svg';
import { useAuth } from '@/hooks/AuthContext';
import { resolveUserRole } from '@/services/glossaryService';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/search', label: 'Semantic Search' },
  { to: '/admin/terms/new', label: 'New Term' },
  { to: '/admin/categories', label: 'Categories' },
];

interface GlossaryLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
}

export function GlossaryLayout({
  children,
  title,
  subtitle,
  theme,
  onThemeToggle,
}: GlossaryLayoutProps) {
  const { user, signIn, signOut, loading } = useAuth();
  const role = resolveUserRole(user);

  useEffect(() => {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
    return () => {
      document.body.classList.remove('theme-light', 'theme-dark');
    };
  }, [theme]);

  return (
    <div className="glossary-shell">
      <aside className="left-nav" aria-label="Glossary navigation">
        <Link to="/" className="brand-link">
          <img className="brand-logo" src={contosoLogo} alt="Contoso" />
          <span>
            <strong>Contoso Glossary</strong>
            <small>Business Vocabulary Hub</small>
          </span>
        </Link>

        <nav className="left-nav-items">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'left-nav-item active' : 'left-nav-item')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="left-nav-footer">
          <div className="role-pill">{role === 'editor' ? 'Editor' : 'Viewer'}</div>
          <p>
            {role === 'editor'
              ? 'You can create, update, and manage glossary content.'
              : 'Read-only mode. Ask an editor to update terms.'}
          </p>
        </div>
      </aside>

      <div className="content-pane">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>

          <div className="topbar-actions">
            <button className="fluent-btn" onClick={onThemeToggle}>
              {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
            </button>
            {loading ? (
              <span className="status-pill">Checking session...</span>
            ) : user ? (
              <>
                <span className="status-pill">{user.name}</span>
                <button className="fluent-btn subtle" onClick={() => void signOut()}>
                  Sign out
                </button>
              </>
            ) : (
              <button className="fluent-btn" onClick={() => void signIn()}>
                Sign in
              </button>
            )}
          </div>
        </header>

        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
