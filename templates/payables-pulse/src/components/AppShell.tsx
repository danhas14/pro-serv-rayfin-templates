import {
  Building2,
  ClipboardList,
  Eye,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  ScrollText,
  Settings,
  Store,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/domain/enums';
import { canOpenRoute } from '@/domain/policy';
import { useAuth } from '@/hooks/AuthContext';
import { useData } from '@/hooks/DataContext';
import { useSession } from '@/hooks/SessionContext';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', label: 'Command Center', icon: LayoutDashboard, end: true },
  { to: '/exceptions', label: 'Exception Workbench', icon: ClipboardList },
  { to: '/customers', label: 'Customer Payment Health', icon: Building2 },
  { to: '/vendors', label: 'Vendor Insights', icon: Store },
  { to: '/audit', label: 'Audit Trail', icon: ScrollText },
  { to: '/admin', label: 'Administration', icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const { operator, realRole, activeRole, viewAsRole, setViewAsRole } =
    useSession();
  const { refresh, loading, exceptions } = useData();
  const navigate = useNavigate();

  const openCount = exceptions.filter(
    (e) => e.status !== 'resolved' && e.status !== 'closed'
  ).length;

  const visibleNav = NAV_ITEMS.filter((item) =>
    activeRole ? canOpenRoute(activeRole, item.to) : false
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-4">
          <img
            src="/payables-pulse.svg"
            alt=""
            aria-hidden="true"
            className="h-8 w-8 rounded-md"
          />
          <div className="leading-tight">
            <div className="text-sm font-semibold">Payables Pulse</div>
            <div className="text-[11px] text-sidebar-foreground/70">
              Payment Operations
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition',
                  isActive
                    ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              {item.to === '/exceptions' && openCount > 0 ? (
                <span className="rounded-full bg-sidebar-primary px-1.5 py-0.5 text-[11px] font-semibold text-sidebar-primary-foreground tabular-nums">
                  {openCount}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-sidebar-border px-5 py-3 text-[11px] text-sidebar-foreground/60">
          Synthetic demonstration data. No real payment information.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-3 sm:px-6">
          <nav
            className="flex flex-1 gap-1 overflow-x-auto lg:hidden"
            aria-label="Main"
          >
            {visibleNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden flex-1 lg:block" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
              aria-hidden="true"
            />
            Refresh
          </Button>

          {realRole === 'operations-manager' ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  {viewAsRole ? `Viewing as ${ROLE_LABELS[viewAsRole]}` : 'View as'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Preview a narrower persona. This can only remove permissions —
                  the server still evaluates your real role on every write.
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setViewAsRole(null)}>
                  <span className="font-medium">
                    Your role — {ROLE_LABELS['operations-manager']}
                  </span>
                </DropdownMenuItem>
                {ROLES.filter((r) => r !== 'operations-manager').map((role) => (
                  <DropdownMenuItem
                    key={role}
                    onClick={() => {
                      setViewAsRole(role);
                      navigate('/');
                    }}
                    className="flex-col items-start gap-0.5"
                  >
                    <span className="font-medium">{ROLE_LABELS[role]}</span>
                    <span className="text-xs text-muted-foreground">
                      {ROLE_DESCRIPTIONS[role]}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {operator?.initials ?? '··'}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-xs font-medium">
                    {operator?.displayName ?? user?.email ?? 'Operator'}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {activeRole ? ROLE_LABELS[activeRole] : 'Loading…'}
                  </span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span>{operator?.displayName}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {operator?.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {realRole ? ROLE_DESCRIPTIONS[realRole] : ''}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void signOut()}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
