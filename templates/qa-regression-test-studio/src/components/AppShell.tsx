/** Navigation shell: sidebar, header, and the Azure AI connection banner. */
import { NavLink, Outlet } from 'react-router-dom';

import { AzureAiBanner } from '@/components/AzureAiBanner';
import { useAuth } from '@/hooks/AuthContext';
import contosoLogo from '@/assets/contoso-logo.svg';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/tests', label: 'Tests' },
  { to: '/import', label: 'Import' },
  { to: '/suites', label: 'Suites' },
  { to: '/runs', label: 'Run history' },
  { to: '/applications', label: 'Applications' },
];

export function AppShell() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <img src={contosoLogo} alt="Contoso" className="h-8" />
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Regression Test Studio
              </div>
              <div className="text-xs text-gray-600">
                No-code regression testing for web applications
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <span className="hidden text-xs text-gray-600 sm:inline">
                {user.email}
              </span>
            )}
            <button
              onClick={() => void signOut()}
              className="text-xs text-gray-500 transition-colors hover:text-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-1 px-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <AzureAiBanner />
        <Outlet />
      </main>
    </div>
  );
}
