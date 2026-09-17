import type { AppRole } from '../domain/enums';
import { ROLE_LABELS } from '../domain/enums';

import { tryRecordAudit } from './auditService';
import type {
  ExceptionCategoryRow,
  MethodRuleRow,
  ResolutionCategoryRow,
  SlaRuleRow,
  UserRow,
} from './columns';
import { authorize, type OperationContext } from './context';
import { currentSessionUserId, db, withRelationships } from './dataUtils';

export async function updateExceptionCategory(
  ctx: OperationContext,
  category: ExceptionCategoryRow,
  patch: Partial<Omit<ExceptionCategoryRow, 'id' | 'code'>>
): Promise<void> {
  authorize(ctx, 'admin.manageConfig');
  await db().ExceptionCategory.update({ id: category.id }, patch);
  await tryRecordAudit(ctx.actor, {
    entityType: 'ExceptionCategory',
    entityId: category.id,
    entityLabel: category.name,
    action: 'config-change',
    fieldName: Object.keys(patch).join(', '),
    previousValue: describe(category, patch),
    newValue: describe(patch, patch),
  });
}

export async function updateResolutionCategory(
  ctx: OperationContext,
  category: ResolutionCategoryRow,
  patch: Partial<Omit<ResolutionCategoryRow, 'id' | 'code'>>
): Promise<void> {
  authorize(ctx, 'admin.manageConfig');
  await db().ResolutionCategory.update({ id: category.id }, patch);
  await tryRecordAudit(ctx.actor, {
    entityType: 'ResolutionCategory',
    entityId: category.id,
    entityLabel: category.name,
    action: 'config-change',
    fieldName: Object.keys(patch).join(', '),
    previousValue: describe(category, patch),
    newValue: describe(patch, patch),
  });
}

export async function updateServiceLevelRule(
  ctx: OperationContext,
  rule: SlaRuleRow,
  patch: Partial<Omit<SlaRuleRow, 'id'>>
): Promise<void> {
  authorize(ctx, 'admin.manageConfig');
  await db().ServiceLevelRule.update({ id: rule.id }, patch);
  await tryRecordAudit(ctx.actor, {
    entityType: 'ServiceLevelRule',
    entityId: rule.id,
    entityLabel: rule.name,
    action: 'config-change',
    fieldName: Object.keys(patch).join(', '),
    previousValue: describe(rule, patch),
    newValue: describe(patch, patch),
  });
}

export async function updatePaymentMethodRule(
  ctx: OperationContext,
  rule: MethodRuleRow,
  patch: Partial<Omit<MethodRuleRow, 'id' | 'paymentMethod'>>
): Promise<void> {
  authorize(ctx, 'admin.manageConfig');
  await db().PaymentMethodRule.update({ id: rule.id }, patch);
  await tryRecordAudit(ctx.actor, {
    entityType: 'PaymentMethodRule',
    entityId: rule.id,
    entityLabel: rule.displayName,
    action: 'config-change',
    fieldName: Object.keys(patch).join(', '),
    previousValue: describe(rule, patch),
    newValue: describe(patch, patch),
  });
}

export class SelfRoleChangeError extends Error {
  constructor() {
    super(
      'You cannot change your own role. The data API rejects any update to your own operator record.'
    );
    this.name = 'SelfRoleChangeError';
  }
}

/**
 * Grant a role to another operator.
 *
 * The API enforces the separation of duties independently of this check: the
 * `AppUser` update policy refuses any row whose email matches the caller, and
 * `UserRoleAssignment` refuses a grant where the acting subject equals the
 * target subject.
 */
export async function assignUserRole(
  ctx: OperationContext,
  target: UserRow,
  role: AppRole,
  reason: string
): Promise<void> {
  authorize(ctx, 'admin.manageUsers');

  if (target.email.toLowerCase() === ctx.actor.email.toLowerCase()) {
    throw new SelfRoleChangeError();
  }

  const previous = target.primaryRole;

  await db().AppUser.update({ id: target.id }, { primaryRole: role });

  await db().UserRoleAssignment.create(
    withRelationships(
      {
        target_user_id: target.id,
        role,
        assignedAt: new Date(),
        assigned_by_user_id: currentSessionUserId(),
        assignedByName: ctx.actor.name,
        isActive: true,
        reason: reason.slice(0, 300),
      },
      [],
      { user: { id: target.id } }
    )
  );

  await tryRecordAudit(ctx.actor, {
    entityType: 'AppUser',
    entityId: target.id,
    entityLabel: target.displayName,
    action: 'update',
    fieldName: 'primaryRole',
    previousValue: ROLE_LABELS[previous],
    newValue: ROLE_LABELS[role],
    explanation: reason,
  });
}

export async function setUserActive(
  ctx: OperationContext,
  target: UserRow,
  isActive: boolean
): Promise<void> {
  authorize(ctx, 'admin.manageUsers');
  if (target.email.toLowerCase() === ctx.actor.email.toLowerCase()) {
    throw new SelfRoleChangeError();
  }

  await db().AppUser.update({ id: target.id }, { isActive });

  await tryRecordAudit(ctx.actor, {
    entityType: 'AppUser',
    entityId: target.id,
    entityLabel: target.displayName,
    action: 'update',
    fieldName: 'isActive',
    previousValue: String(target.isActive),
    newValue: String(isActive),
  });
}

function describe(
  source: Record<string, unknown>,
  shape: Record<string, unknown>
): string {
  return Object.keys(shape)
    .map((key) => `${key}=${String(source[key] ?? '')}`)
    .join('; ');
}
