import type { AppRole } from '../domain/enums';
import {
  assertCapability,
  type Capability,
} from '../domain/policy';

import type { AuditActor } from './auditService';

/**
 * Everything a write needs to authorise and audit itself.
 *
 * Services never read the current user from React state directly — the caller
 * passes this context, and `authorize` is invoked before any network call.
 */
export interface OperationContext {
  actor: AuditActor;
  role: AppRole;
  capabilities: Capability[];
}

export function authorize(
  ctx: OperationContext,
  capability: Capability
): void {
  assertCapability(ctx.capabilities, capability, ctx.role);
}
