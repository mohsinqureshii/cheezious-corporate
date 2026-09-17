import { describe, expect, it } from 'vitest';

import { createAbility } from '../authorize';
import { ALL_PERMISSIONS, type Permission } from '../permissions';
import { permissionsForRole, ROLE_DEFINITIONS } from '../roles';
import {
  availableTransitions,
  canTransition,
  InvalidTransitionError,
  isPubliclyVisible,
  nextStatus,
  requiredPermission,
} from '../workflow';

describe('editorial workflow', () => {
  it('advances a draft through the standard review path', () => {
    expect(nextStatus('DRAFT', 'SUBMIT_FOR_REVIEW')).toBe('IN_REVIEW');
    expect(nextStatus('IN_REVIEW', 'APPROVE')).toBe('APPROVED');
    expect(nextStatus('APPROVED', 'PUBLISH')).toBe('PUBLISHED');
  });

  it('sends rejected content back to the author and allows resubmission', () => {
    expect(nextStatus('IN_REVIEW', 'REQUEST_CHANGES')).toBe('CHANGES_REQUESTED');
    expect(nextStatus('CHANGES_REQUESTED', 'SUBMIT_FOR_REVIEW')).toBe('IN_REVIEW');
  });

  it('rejects transitions that are not legal from the current status', () => {
    expect(canTransition('DRAFT', 'APPROVE')).toBe(false);
    expect(() => nextStatus('DRAFT', 'APPROVE')).toThrow(InvalidTransitionError);
    expect(() => nextStatus('ARCHIVED', 'PUBLISH')).toThrow(InvalidTransitionError);
    expect(() => nextStatus('PUBLISHED', 'APPROVE')).toThrow(InvalidTransitionError);
  });

  it('requires a publish permission for publishing but not for review steps', () => {
    expect(requiredPermission('pages', 'PUBLISH', 'APPROVED')).toBe('pages.publish');
    expect(requiredPermission('pages', 'SCHEDULE', 'APPROVED')).toBe('pages.publish');
    expect(requiredPermission('pages', 'APPROVE', 'IN_REVIEW')).toBe('pages.update');
    expect(requiredPermission('stories', 'SUBMIT_FOR_REVIEW', 'DRAFT')).toBe('stories.update');
  });

  it('only offers an author the transitions they are allowed to perform', () => {
    const authorPermissions = new Set(permissionsForRole('AUTHOR'));
    const actions = availableTransitions('DRAFT', 'pages', (p) => authorPermissions.has(p)).map(
      (t) => t.action,
    );
    expect(actions).toContain('SUBMIT_FOR_REVIEW');
    expect(actions).not.toContain('PUBLISH');
    expect(actions).not.toContain('SCHEDULE');
  });

  it('offers corporate communications the publishing transitions', () => {
    const permissions = new Set(permissionsForRole('CORPORATE_COMMUNICATIONS'));
    const actions = availableTransitions('APPROVED', 'pages', (p) => permissions.has(p)).map(
      (t) => t.action,
    );
    expect(actions).toContain('PUBLISH');
    expect(actions).toContain('SCHEDULE');
  });

  it('treats only PUBLISHED as publicly visible', () => {
    expect(isPubliclyVisible('PUBLISHED')).toBe(true);
    for (const status of [
      'DRAFT',
      'IN_REVIEW',
      'CHANGES_REQUESTED',
      'APPROVED',
      'SCHEDULED',
      'UNPUBLISHED',
      'ARCHIVED',
    ] as const) {
      expect(isPubliclyVisible(status)).toBe(false);
    }
  });
});

describe('roles', () => {
  it('grants SUPER_ADMIN every permission in the catalogue', () => {
    expect(permissionsForRole('SUPER_ADMIN').sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it('never references a permission that is not in the catalogue', () => {
    const catalogue = new Set<string>(ALL_PERMISSIONS);
    for (const key of Object.keys(ROLE_DEFINITIONS) as Array<keyof typeof ROLE_DEFINITIONS>) {
      for (const permission of permissionsForRole(key)) {
        expect(
          catalogue.has(permission),
          `${key} references unknown permission ${permission}`,
        ).toBe(true);
      }
    }
  });

  it('does not let an author publish or read personal data', () => {
    const author = new Set(permissionsForRole('AUTHOR'));
    for (const forbidden of [
      'pages.publish',
      'applications.read',
      'users.manage',
      'settings.manage',
    ] as Permission[]) {
      expect(author.has(forbidden)).toBe(false);
    }
  });

  it('scopes procurement and expansion managers to their own queues', () => {
    const procurement = new Set(permissionsForRole('PROCUREMENT_MANAGER'));
    expect(procurement.has('suppliers.manage')).toBe(true);
    expect(procurement.has('properties.read')).toBe(false);
    expect(procurement.has('applications.read')).toBe(false);

    const expansion = new Set(permissionsForRole('EXPANSION_MANAGER'));
    expect(expansion.has('properties.manage')).toBe(true);
    expect(expansion.has('suppliers.read')).toBe(false);
  });
});

describe('ability', () => {
  const principal = {
    id: 'u1',
    email: 'editor@example.com',
    name: 'Editor',
    isActive: true,
    roles: ['EDITOR'],
    permissions: permissionsForRole('EDITOR'),
  };

  it('allows what the role grants and refuses what it does not', () => {
    const ability = createAbility(principal);
    expect(ability.can('pages.update')).toBe(true);
    expect(ability.can('pages.publish')).toBe(false);
    expect(() => ability.assert('pages.update')).not.toThrow();
    expect(() => ability.assert('pages.publish')).toThrow(/pages.publish/);
  });

  it('refuses everything for a disabled account', () => {
    const ability = createAbility({ ...principal, isActive: false });
    expect(ability.can('pages.update')).toBe(false);
    expect(() => ability.assert('pages.update')).toThrow(/disabled/i);
  });

  it('refuses everything for an anonymous caller', () => {
    const ability = createAbility(null);
    expect(ability.can('pages.read')).toBe(false);
    expect(() => ability.assert('pages.read')).toThrow(/Authentication required/);
  });
});

describe('republishing', () => {
  it('allows publishing edits to an already-published page', () => {
    // The public site serves the published snapshot, so re-publishing is the
    // only way an editor's changes to a live page reach production.
    expect(canTransition('PUBLISHED', 'PUBLISH')).toBe(true);
    expect(nextStatus('PUBLISHED', 'PUBLISH')).toBe('PUBLISHED');
    expect(requiredPermission('pages', 'PUBLISH', 'PUBLISHED')).toBe('pages.publish');
  });

  it('still requires the publish permission to republish', () => {
    const author = new Set(permissionsForRole('AUTHOR'));
    const actions = availableTransitions('PUBLISHED', 'pages', (p) => author.has(p)).map(
      (t) => t.action,
    );
    expect(actions).not.toContain('PUBLISH');
  });
});
