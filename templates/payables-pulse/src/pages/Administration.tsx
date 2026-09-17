import { Lock, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { useConfirm } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/States';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PAYMENT_METHOD_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  type AppRole,
  type ExceptionPriority,
  type PaymentMethod,
} from '@/domain/enums';
import { useData } from '@/hooks/DataContext';
import { useSession } from '@/hooks/SessionContext';
import { formatCurrency } from '@/lib/format';
import {
  assignUserRole,
  setUserActive,
  updateExceptionCategory,
  updatePaymentMethodRule,
  updateResolutionCategory,
  updateServiceLevelRule,
} from '@/services/adminService';
import {
  resetDemoData,
  seedDemoData,
  type SeedProgress,
} from '@/services/seed/seedService';

export function Administration() {
  const {
    exceptionCategories,
    resolutionCategories,
    slaRules,
    methodRules,
    users,
    refresh,
  } = useData();
  const { operationContext, can, operator } = useSession();
  const { confirm, dialog } = useConfirm();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<SeedProgress | null>(null);

  const editable = can('admin.manageConfig');

  async function guard(action: () => Promise<void>, message: string) {
    if (!operationContext) return;
    setBusy(true);
    try {
      await action();
      toast.success(message);
      await refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'The change could not be saved.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (!can('admin.manageConfig') && !can('admin.manageUsers')) {
    return (
      <EmptyState
        icon={<Lock className="h-8 w-8" />}
        title="Administration is restricted"
        description="Only the Operations Manager role can change exception categories, service-level targets, payment-method rules, role assignments or demo data."
      />
    );
  }

  return (
    <div className="space-y-4">
      {dialog}
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground">
          Operational configuration. Every change is written to the audit trail.
        </p>
      </header>

      <Tabs defaultValue="exception-categories">
        <TabsList className="flex-wrap">
          <TabsTrigger value="exception-categories">
            Exception categories
          </TabsTrigger>
          <TabsTrigger value="resolution-categories">
            Resolution categories
          </TabsTrigger>
          <TabsTrigger value="sla">Service-level targets</TabsTrigger>
          <TabsTrigger value="methods">Payment-method rules</TabsTrigger>
          <TabsTrigger value="users">Users and roles</TabsTrigger>
          <TabsTrigger value="demo">Demo data</TabsTrigger>
        </TabsList>

        <TabsContent value="exception-categories" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Exception categories</CardTitle>
              <CardDescription>
                Default priority and resolution target applied when an exception
                of this category is raised.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="w-[150px]">Default priority</TableHead>
                    <TableHead className="w-[120px]">Target (hours)</TableHead>
                    <TableHead className="w-[90px]">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exceptionCategories.map((category) => (
                    <TableRow key={category.id} className="align-top">
                      <TableCell>
                        <div className="font-medium">{category.name}</div>
                        <div className="max-w-lg text-xs text-muted-foreground">
                          {category.description}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={category.defaultPriority}
                          disabled={!editable || busy}
                          onValueChange={(v) =>
                            void guard(
                              () =>
                                updateExceptionCategory(operationContext!, category, {
                                  defaultPriority: v as ExceptionPriority,
                                }),
                              'Default priority updated.'
                            )
                          }
                        >
                          <SelectTrigger
                            aria-label={`Default priority for ${category.name}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITIES.map((p) => (
                              <SelectItem key={p} value={p}>
                                {PRIORITY_LABELS[p]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <NumberField
                          value={category.defaultSlaHours}
                          disabled={!editable || busy}
                          label={`Target hours for ${category.name}`}
                          onCommit={(value) =>
                            void guard(
                              () =>
                                updateExceptionCategory(operationContext!, category, {
                                  defaultSlaHours: value,
                                }),
                              'Resolution target updated.'
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={category.isActive}
                          disabled={!editable || busy}
                          aria-label={`${category.name} active`}
                          onCheckedChange={(checked) =>
                            void guard(
                              () =>
                                updateExceptionCategory(operationContext!, category, {
                                  isActive: checked,
                                }),
                              checked
                                ? 'Category enabled.'
                                : 'Category disabled.'
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resolution-categories" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resolution categories</CardTitle>
              <CardDescription>
                Recorded when a specialist resolves an exception.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Outcome</TableHead>
                    <TableHead className="w-[140px]">Requires note</TableHead>
                    <TableHead className="w-[90px]">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resolutionCategories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <div className="font-medium">{category.name}</div>
                        <div className="max-w-lg text-xs text-muted-foreground">
                          {category.description}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={category.requiresNote}
                          disabled={!editable || busy}
                          aria-label={`${category.name} requires a note`}
                          onCheckedChange={(checked) =>
                            void guard(
                              () =>
                                updateResolutionCategory(
                                  operationContext!,
                                  category,
                                  { requiresNote: checked }
                                ),
                              'Note requirement updated.'
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={category.isActive}
                          disabled={!editable || busy}
                          aria-label={`${category.name} active`}
                          onCheckedChange={(checked) =>
                            void guard(
                              () =>
                                updateResolutionCategory(
                                  operationContext!,
                                  category,
                                  { isActive: checked }
                                ),
                              checked ? 'Outcome enabled.' : 'Outcome disabled.'
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sla" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Service-level targets</CardTitle>
              <CardDescription>
                Resolution windows by priority and payment method. The warning
                threshold decides when an exception is shown as at risk.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="w-[120px]">Target (hours)</TableHead>
                    <TableHead className="w-[140px]">Warning (%)</TableHead>
                    <TableHead className="w-[90px]">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slaRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="font-medium">{rule.name}</div>
                        <div className="max-w-md text-xs text-muted-foreground">
                          {rule.description}
                        </div>
                      </TableCell>
                      <TableCell>{PRIORITY_LABELS[rule.priority]}</TableCell>
                      <TableCell>
                        {rule.paymentMethod === 'all'
                          ? 'All methods'
                          : PAYMENT_METHOD_LABELS[rule.paymentMethod]}
                      </TableCell>
                      <TableCell>
                        <NumberField
                          value={rule.targetHours}
                          disabled={!editable || busy}
                          label={`Target hours for ${rule.name}`}
                          onCommit={(value) =>
                            void guard(
                              () =>
                                updateServiceLevelRule(operationContext!, rule, {
                                  targetHours: value,
                                }),
                              'Service-level target updated.'
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <NumberField
                          value={rule.warningThresholdPct}
                          disabled={!editable || busy}
                          label={`Warning threshold for ${rule.name}`}
                          onCommit={(value) =>
                            void guard(
                              () =>
                                updateServiceLevelRule(operationContext!, rule, {
                                  warningThresholdPct: value,
                                }),
                              'Warning threshold updated.'
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.isActive}
                          disabled={!editable || busy}
                          aria-label={`${rule.name} active`}
                          onCheckedChange={(checked) =>
                            void guard(
                              () =>
                                updateServiceLevelRule(operationContext!, rule, {
                                  isActive: checked,
                                }),
                              checked ? 'Rule enabled.' : 'Rule disabled.'
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="methods" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment-method rules</CardTitle>
              <CardDescription>
                Operating limits and controls per rail.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Limit</TableHead>
                    <TableHead className="w-[110px]">Cut-off (UTC)</TableHead>
                    <TableHead className="w-[110px]">Retry limit</TableHead>
                    <TableHead className="w-[130px]">Bank verify</TableHead>
                    <TableHead className="w-[150px]">Compliance</TableHead>
                    <TableHead className="w-[90px]">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {methodRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="font-medium">
                          {PAYMENT_METHOD_LABELS[rule.paymentMethod as PaymentMethod]}
                        </div>
                        <div className="max-w-md text-xs text-muted-foreground">
                          {rule.notes}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatCurrency(rule.maxAmount, 'USD', {
                          decimals: false,
                        })}
                        <div className="text-xs text-muted-foreground">
                          rebate {rule.rebateRatePct}%
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          aria-label={`Cut-off time for ${rule.displayName}`}
                          defaultValue={rule.cutoffTimeUtc}
                          disabled={!editable || busy}
                          className="w-24"
                          onBlur={(e) => {
                            const next = e.target.value.trim();
                            if (!next || next === rule.cutoffTimeUtc) return;
                            void guard(
                              () =>
                                updatePaymentMethodRule(operationContext!, rule, {
                                  cutoffTimeUtc: next,
                                }),
                              'Cut-off time updated.'
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <NumberField
                          value={rule.retryLimit}
                          disabled={!editable || busy}
                          label={`Retry limit for ${rule.displayName}`}
                          onCommit={(value) =>
                            void guard(
                              () =>
                                updatePaymentMethodRule(operationContext!, rule, {
                                  retryLimit: value,
                                }),
                              'Retry limit updated.'
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.requiresBankVerification}
                          disabled={!editable || busy}
                          aria-label={`Bank verification for ${rule.displayName}`}
                          onCheckedChange={(checked) =>
                            void guard(
                              () =>
                                updatePaymentMethodRule(operationContext!, rule, {
                                  requiresBankVerification: checked,
                                }),
                              'Bank verification rule updated.'
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.requiresComplianceReview}
                          disabled={!editable || busy}
                          aria-label={`Compliance review for ${rule.displayName}`}
                          onCheckedChange={(checked) =>
                            void guard(
                              () =>
                                updatePaymentMethodRule(operationContext!, rule, {
                                  requiresComplianceReview: checked,
                                }),
                              'Compliance rule updated.'
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.isActive}
                          disabled={!editable || busy}
                          aria-label={`${rule.displayName} active`}
                          onCheckedChange={(checked) =>
                            void guard(
                              () =>
                                updatePaymentMethodRule(operationContext!, rule, {
                                  isActive: checked,
                                }),
                              checked ? 'Rail enabled.' : 'Rail disabled.'
                            )
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-1.5">
                <ShieldCheck
                  className="h-4 w-4 text-primary"
                  aria-hidden="true"
                />
                <CardTitle className="text-base">Users and roles</CardTitle>
              </div>
              <CardDescription>
                The data API refuses any update to your own operator record, so
                you cannot change your own role here — or by calling the API
                directly.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operator</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="w-[280px]">Role</TableHead>
                    <TableHead className="w-[90px]">Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((appUser) => {
                    const isSelf = appUser.id === operator?.id;
                    return (
                      <TableRow key={appUser.id}>
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-medium">
                            {appUser.displayName}
                            {isSelf ? (
                              <Badge variant="outline">You</Badge>
                            ) : null}
                            {appUser.isDemoPersona ? (
                              <Badge variant="secondary">Demo persona</Badge>
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {appUser.email}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {appUser.teamName}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={appUser.primaryRole}
                            disabled={!can('admin.manageUsers') || isSelf || busy}
                            onValueChange={(v) =>
                              void guard(
                                () =>
                                  assignUserRole(
                                    operationContext!,
                                    appUser,
                                    v as AppRole,
                                    'Role updated from the Administration page.'
                                  ),
                                `${appUser.displayName} is now ${ROLE_LABELS[v as AppRole]}.`
                              )
                            }
                          >
                            <SelectTrigger
                              aria-label={`Role for ${appUser.displayName}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {ROLE_LABELS[role]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {isSelf ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Separation of duties: another manager must change
                              your role.
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={appUser.isActive}
                            disabled={
                              !can('admin.manageUsers') || isSelf || busy
                            }
                            aria-label={`${appUser.displayName} active`}
                            onCheckedChange={(checked) =>
                              void guard(
                                () =>
                                  setUserActive(
                                    operationContext!,
                                    appUser,
                                    checked
                                  ),
                                checked
                                  ? 'Operator activated.'
                                  : 'Operator deactivated.'
                              )
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">What each role can do</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {ROLES.map((role) => (
                <div key={role} className="rounded-md border p-3">
                  <div className="text-sm font-medium">{ROLE_LABELS[role]}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ROLE_DESCRIPTIONS[role]}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demo" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Demo data</CardTitle>
              <CardDescription>
                Clearing removes customers, vendors, invoices, payments,
                exceptions and their history. Operator records and the audit
                trail are append-only at the API and are deliberately kept.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {progress ? (
                <div role="status" aria-live="polite" className="space-y-2">
                  <Progress
                    value={
                      progress.overallTotal
                        ? Math.round(
                            (progress.overallDone / progress.overallTotal) * 100
                          )
                        : 0
                    }
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{progress.phase}</span>
                    <span className="tabular-nums">
                      {progress.overallDone.toLocaleString()} /{' '}
                      {progress.overallTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busy || !can('admin.resetDemoData')}
                  onClick={() =>
                    confirm({
                      title: 'Clear all demo data?',
                      description:
                        'This deletes every customer, vendor, invoice, payment and exception in this workspace. The audit trail is preserved.',
                      confirmLabel: 'Clear demo data',
                      destructive: true,
                      action: async () => {
                        setBusy(true);
                        try {
                          await resetDemoData(operationContext!, setProgress);
                          toast.success('Demo data cleared.');
                          await refresh();
                        } catch (err) {
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : 'The reset could not be completed.'
                          );
                        } finally {
                          setBusy(false);
                          setProgress(null);
                        }
                      },
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear demo data
                </Button>

                <Button
                  disabled={busy || !can('admin.resetDemoData')}
                  onClick={() =>
                    confirm({
                      title: 'Regenerate the demo dataset?',
                      description:
                        'Loads a fresh synthetic 90-day payment operation. Run this only on an empty workspace, otherwise records will be duplicated.',
                      confirmLabel: 'Regenerate',
                      action: async () => {
                        setBusy(true);
                        try {
                          await seedDemoData(setProgress);
                          toast.success('Demo dataset regenerated.');
                          await refresh();
                        } catch (err) {
                          toast.error(
                            err instanceof Error
                              ? err.message
                              : 'The dataset could not be regenerated.'
                          );
                        } finally {
                          setBusy(false);
                          setProgress(null);
                        }
                      },
                    })
                  }
                >
                  Regenerate demo data
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                All generated content is synthetic. No real customer, vendor,
                bank account, card, invoice, employee or transaction information
                is used anywhere in this application.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NumberField({
  value,
  onCommit,
  disabled,
  label,
}: {
  value: number;
  onCommit: (value: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Input
      type="number"
      min={1}
      aria-label={label}
      defaultValue={value}
      disabled={disabled}
      className="w-24"
      onBlur={(e) => {
        const next = Number(e.target.value);
        if (!Number.isFinite(next) || next <= 0 || next === value) {
          e.target.value = String(value);
          return;
        }
        onCommit(next);
      }}
    />
  );
}
