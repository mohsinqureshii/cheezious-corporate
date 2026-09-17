import { createAbility, type Permission, type Principal } from '@cheezious/permissions';

/**
 * Client-side permission checks.
 *
 * Used only to decide what to *show*. The API enforces the same permissions
 * independently on every request, so a user who forges their way past this sees
 * a 403 rather than performing the action. Hiding a control is a courtesy:
 * showing someone a Publish button that will refuse them is bad design, not a
 * security hole.
 */
export function abilityFor(principal: Principal | null) {
  return createAbility(principal);
}

export function grantedSet(permissions: readonly Permission[] | undefined): Set<string> {
  return new Set(permissions ?? []);
}

export type { Permission, Principal };
