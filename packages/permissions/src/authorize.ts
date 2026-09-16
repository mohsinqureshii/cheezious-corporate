import { type Permission } from './permissions';

/** The authenticated principal as far as authorisation is concerned. */
export interface Principal {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  roles: string[];
  permissions: Permission[];
}

export class AuthorizationError extends Error {
  readonly code = 'FORBIDDEN';
  readonly status = 403;
  constructor(readonly required: Permission | Permission[]) {
    const list = Array.isArray(required) ? required.join(', ') : required;
    super(`Missing required permission: ${list}`);
    this.name = 'AuthorizationError';
  }
}

export class AuthenticationError extends Error {
  readonly code = 'UNAUTHENTICATED';
  readonly status = 401;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/** A permission checker bound to a principal. Shared by the API and the CMS UI. */
export function createAbility(principal: Principal | null) {
  const granted = new Set<string>(principal?.permissions ?? []);
  const active = principal?.isActive === true;

  const can = (permission: Permission): boolean => active && granted.has(permission);
  const canAny = (permissions: readonly Permission[]): boolean => permissions.some(can);
  const canAll = (permissions: readonly Permission[]): boolean => permissions.every(can);

  return {
    principal,
    can,
    canAny,
    canAll,
    /** Throws unless the principal holds the permission. Use this in services. */
    assert(permission: Permission): void {
      if (!principal) throw new AuthenticationError();
      if (!active) throw new AuthenticationError('This account has been disabled.');
      if (!granted.has(permission)) throw new AuthorizationError(permission);
    },
    assertAny(permissions: readonly Permission[]): void {
      if (!principal) throw new AuthenticationError();
      if (!active) throw new AuthenticationError('This account has been disabled.');
      if (!permissions.some((p) => granted.has(p))) throw new AuthorizationError([...permissions]);
    },
  };
}

export type Ability = ReturnType<typeof createAbility>;
