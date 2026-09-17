import { generateTemporaryPassword, hashPassword, revokeAllSessionsForUser } from '@cheezious/auth';
import { Prisma } from '@cheezious/database';
import {
  ALL_PERMISSIONS,
  HIGH_RISK_PERMISSIONS,
  PERMISSION_GROUPS,
  isPermission,
  type Permission,
} from '@cheezious/permissions';
import { ApiError, email as emailSchema } from '@cheezious/validation';
import { Router } from 'express';
import { z } from 'zod';

import { AuditService } from '../lib/audit';
import { asyncHandler, clientIp, param, rateLimit, requireAuth, requirePermission } from '../middleware';

/**
 * System administration: users, roles, audit and settings.
 *
 * The safety property that matters most here is that an administrator cannot
 * lock the organisation out of its own platform. Three guards enforce it:
 * SUPER_ADMIN cannot lose permissions, a user cannot disable or demote
 * themselves, and the last active super administrator cannot be removed.
 */
export function cmsSystemRoutes(): Router {
  const router = Router();
  router.use(requireAuth());

  // ===========================================================================
  // Users
  // ===========================================================================

  router.get(
    '/users',
    requirePermission('users.read'),
    asyncHandler(async (req, res) => {
      const query = z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(25),
          q: z.string().max(200).optional(),
          status: z.enum(['INVITED', 'ACTIVE', 'DISABLED']).optional(),
          roleKey: z.string().max(60).optional(),
        })
        .parse(req.query);

      const where: Prisma.UserWhereInput = {
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.roleKey ? { roles: { some: { role: { key: query.roleKey } } } } : {}),
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { email: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        req.ctx.prisma.user.findMany({
          where,
          orderBy: { name: 'asc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          // The password hash is never selected, anywhere, for any reason.
          select: {
            id: true,
            name: true,
            email: true,
            jobTitle: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
            mustChangePassword: true,
            roles: { select: { role: { select: { id: true, key: true, name: true } } } },
          },
        }),
        req.ctx.prisma.user.count({ where }),
      ]);

      res.json({
        items,
        meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
      });
    }),
  );

  /** Invite a user. A temporary password is issued and must be changed at first sign-in. */
  router.post(
    '/users',
    requirePermission('users.manage'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const input = z
        .object({
          name: z.string().min(1).max(120),
          email: emailSchema,
          jobTitle: z.string().max(120).optional(),
          roleIds: z.array(z.string().cuid()).min(1).max(10),
        })
        .parse(req.body);

      const existing = await req.ctx.prisma.user.findFirst({
        where: { email: { equals: input.email, mode: 'insensitive' } },
        select: { id: true, deletedAt: true },
      });
      if (existing) {
        throw ApiError.conflict(
          existing.deletedAt
            ? 'A deleted account already uses that email address. Restore it instead.'
            : 'An account already uses that email address.',
        );
      }

      const roles = await req.ctx.prisma.role.findMany({
        where: { id: { in: input.roleIds } },
        select: { id: true, key: true, name: true },
      });
      if (roles.length !== input.roleIds.length) throw ApiError.notFound('Role');

      // Only a super administrator can create another one.
      if (roles.some((role) => role.key === 'SUPER_ADMIN') && !req.principal!.roles.includes('SUPER_ADMIN')) {
        throw new ApiError('FORBIDDEN', 'Only a super administrator can grant that role.');
      }

      const temporaryPassword = generateTemporaryPassword();

      const user = await req.ctx.prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          jobTitle: input.jobTitle ?? null,
          passwordHash: await hashPassword(temporaryPassword),
          status: 'ACTIVE',
          mustChangePassword: true,
          passwordChangedAt: new Date(),
          invitedById: req.principal!.id,
          roles: { create: roles.map((role) => ({ roleId: role.id, assignedById: req.principal!.id })) },
        },
        select: { id: true, name: true, email: true, status: true },
      });

      await new AuditService(req.ctx.prisma).record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'CREATE',
          entityType: 'user',
          entityId: user.id,
          entityLabel: user.name,
          summary: `Invited ${user.name} with role(s): ${roles.map((r) => r.name).join(', ')}`,
        },
      );

      // Returned once, never stored in readable form, and shown to the inviter
      // to pass on out of band until a mail transport is configured.
      res.status(201).json({
        user,
        temporaryPassword,
        message: 'Share this temporary password securely. The user must change it at first sign-in.',
      });
    }),
  );

  router.patch(
    '/users/:id',
    requirePermission('users.manage'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const input = z
        .object({
          name: z.string().min(1).max(120).optional(),
          jobTitle: z.string().max(120).nullish(),
          status: z.enum(['ACTIVE', 'DISABLED']).optional(),
          roleIds: z.array(z.string().cuid()).max(10).optional(),
        })
        .parse(req.body);

      const target = await req.ctx.prisma.user.findFirst({
        where: { id: param(req, 'id'), deletedAt: null },
        include: { roles: { include: { role: { select: { id: true, key: true, name: true } } } } },
      });
      if (!target) throw ApiError.notFound('User');

      const isSelf = target.id === req.principal!.id;
      const targetIsSuperAdmin = target.roles.some((r) => r.role.key === 'SUPER_ADMIN');

      // Guard against self-lockout: disabling or demoting yourself is almost
      // always a mistake, and recovering from it needs another administrator.
      if (isSelf && input.status === 'DISABLED') {
        throw ApiError.conflict('You cannot disable your own account.');
      }
      if (isSelf && input.roleIds && !input.roleIds.some((id) => target.roles.some((r) => r.role.id === id && r.role.key === 'SUPER_ADMIN')) && targetIsSuperAdmin) {
        throw ApiError.conflict('You cannot remove your own super administrator role.');
      }

      // Guard against organisational lockout: the last super administrator
      // cannot be disabled or demoted.
      if (targetIsSuperAdmin && (input.status === 'DISABLED' || input.roleIds)) {
        const remaining = await req.ctx.prisma.user.count({
          where: {
            deletedAt: null,
            status: 'ACTIVE',
            NOT: { id: target.id },
            roles: { some: { role: { key: 'SUPER_ADMIN' } } },
          },
        });
        const losingSuperAdmin =
          input.status === 'DISABLED' ||
          (input.roleIds !== undefined &&
            !target.roles.some((r) => r.role.key === 'SUPER_ADMIN' && input.roleIds!.includes(r.role.id)));

        if (losingSuperAdmin && remaining === 0) {
          throw ApiError.conflict(
            'This is the only super administrator. Grant the role to someone else first.',
          );
        }
      }

      if (input.roleIds && !req.principal!.roles.includes('SUPER_ADMIN')) {
        const roles = await req.ctx.prisma.role.findMany({
          where: { id: { in: input.roleIds } },
          select: { key: true },
        });
        if (roles.some((role) => role.key === 'SUPER_ADMIN')) {
          throw new ApiError('FORBIDDEN', 'Only a super administrator can grant that role.');
        }
      }

      const updated = await req.ctx.prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: target.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
          },
          select: { id: true, name: true, email: true, status: true },
        });

        if (input.roleIds) {
          await tx.userRole.deleteMany({ where: { userId: target.id } });
          await tx.userRole.createMany({
            data: input.roleIds.map((roleId) => ({ userId: target.id, roleId, assignedById: req.principal!.id })),
          });
        }

        return user;
      });

      // Disabling an account ends its sessions immediately rather than letting
      // the current one run until it expires.
      if (input.status === 'DISABLED') {
        await revokeAllSessionsForUser(req.ctx.prisma, target.id, 'ACCOUNT_DISABLED');
      }

      await new AuditService(req.ctx.prisma).record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: input.roleIds ? 'ROLE_ASSIGNED' : 'UPDATE',
          entityType: 'user',
          entityId: target.id,
          entityLabel: target.name,
          summary: input.status === 'DISABLED' ? 'Disabled account and revoked sessions' : 'Updated user',
          before: { status: target.status, roles: target.roles.map((r) => r.role.name) },
          after: { status: updated.status },
        },
      );

      res.json({ user: updated });
    }),
  );

  // ===========================================================================
  // Roles and permissions
  // ===========================================================================

  router.get(
    '/roles',
    requirePermission('users.read'),
    asyncHandler(async (req, res) => {
      const roles = await req.ctx.prisma.role.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          permissions: { include: { permission: { select: { key: true } } } },
          _count: { select: { users: true } },
        },
      });

      res.json({
        roles: roles.map((role) => ({
          id: role.id,
          key: role.key,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          userCount: role._count.users,
          permissions: role.permissions.map((p) => p.permission.key),
        })),
        // The full catalogue, grouped, so the CMS can render a permission matrix
        // rather than a flat list of a hundred checkboxes.
        catalogue: PERMISSION_GROUPS.map((group) => ({
          key: group.key,
          label: group.label,
          permissions: group.permissions.map((permission) => ({
            key: permission,
            isHighRisk: HIGH_RISK_PERMISSIONS.includes(permission),
          })),
        })),
        highRisk: HIGH_RISK_PERMISSIONS,
      });
    }),
  );

  router.patch(
    '/roles/:id',
    requirePermission('roles.manage'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const input = z
        .object({
          name: z.string().min(1).max(80).optional(),
          description: z.string().max(400).nullish(),
          permissions: z.array(z.string().max(60)).max(ALL_PERMISSIONS.length).optional(),
        })
        .parse(req.body);

      const role = await req.ctx.prisma.role.findUnique({
        where: { id: param(req, 'id') },
        include: { permissions: { include: { permission: { select: { key: true } } } } },
      });
      if (!role) throw ApiError.notFound('Role');

      // SUPER_ADMIN must always hold everything, or the platform can be locked.
      if (role.key === 'SUPER_ADMIN' && input.permissions) {
        throw ApiError.conflict('The super administrator role always holds every permission.');
      }

      const invalid = (input.permissions ?? []).filter((key) => !isPermission(key));
      if (invalid.length > 0) {
        throw ApiError.validation(
          invalid.map((key) => ({ field: 'permissions', message: `Unknown permission: ${key}` })),
        );
      }

      const before = role.permissions.map((p) => p.permission.key);

      await req.ctx.prisma.$transaction(async (tx) => {
        await tx.role.update({
          where: { id: role.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
          },
        });

        if (input.permissions) {
          const permissions = await tx.permission.findMany({
            where: { key: { in: input.permissions } },
            select: { id: true },
          });
          await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
          await tx.rolePermission.createMany({
            data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })),
          });
        }
      });

      const after = input.permissions ?? before;
      const granted = after.filter((key) => !before.includes(key));
      const revoked = before.filter((key) => !after.includes(key));

      await new AuditService(req.ctx.prisma).record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'PERMISSION_CHANGED',
          entityType: 'role',
          entityId: role.id,
          entityLabel: role.name,
          summary: `Granted ${granted.length}, revoked ${revoked.length} permission(s)`,
          metadata: { granted, revoked },
        },
      );

      res.json({
        ok: true,
        granted,
        revoked,
        // Surfaced so the CMS can confirm a high-risk grant after the fact.
        highRiskGranted: granted.filter((key) => HIGH_RISK_PERMISSIONS.includes(key as Permission)),
      });
    }),
  );

  // ===========================================================================
  // Audit log
  // ===========================================================================

  router.get(
    '/audit',
    requirePermission('audit.read'),
    asyncHandler(async (req, res) => {
      const query = z
        .object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(50),
          q: z.string().max(200).optional(),
          action: z.string().max(200).optional(),
          entityType: z.string().max(60).optional(),
          actorId: z.string().cuid().optional(),
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
        })
        .parse(req.query);

      const where: Prisma.AuditLogWhereInput = {
        ...(query.action ? { action: { in: query.action.split(',') as never } } : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.actorId ? { actorId: query.actorId } : {}),
        ...(query.from || query.to
          ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
          : {}),
        ...(query.q
          ? {
              OR: [
                { entityLabel: { contains: query.q, mode: 'insensitive' } },
                { summary: { contains: query.q, mode: 'insensitive' } },
                { actorEmail: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [items, total, actions] = await Promise.all([
        req.ctx.prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: { actor: { select: { id: true, name: true, email: true } } },
        }),
        req.ctx.prisma.auditLog.count({ where }),
        req.ctx.prisma.auditLog.groupBy({ by: ['action'], _count: true, orderBy: { _count: { action: 'desc' } } }),
      ]);

      res.json({
        items,
        meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
        facets: { actions: actions.map((row) => ({ value: row.action, count: row._count })) },
      });
    }),
  );

  // ===========================================================================
  // Settings
  // ===========================================================================

  router.get(
    '/settings',
    requirePermission('settings.manage'),
    asyncHandler(async (req, res) => {
      const [site, globals, flags] = await Promise.all([
        req.ctx.prisma.siteSetting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] }),
        req.ctx.prisma.globalSetting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] }),
        req.ctx.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } }),
      ]);

      res.json({ site, globals, flags });
    }),
  );

  router.patch(
    '/settings/:key',
    requirePermission('settings.manage'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const input = z
        .object({ value: z.unknown(), locale: z.enum(['en', 'ur']).optional() })
        .parse(req.body);

      const existing = input.locale
        ? await req.ctx.prisma.siteSetting.findUnique({
            where: { key_locale: { key: param(req, 'key'), locale: input.locale } },
          })
        : await req.ctx.prisma.globalSetting.findUnique({ where: { key: param(req, 'key') } });
      if (!existing) throw ApiError.notFound('Setting');

      if (input.locale) {
        await req.ctx.prisma.siteSetting.update({
          where: { key_locale: { key: param(req, 'key'), locale: input.locale } },
          data: { value: input.value as never, updatedById: req.principal!.id },
        });
      } else {
        await req.ctx.prisma.globalSetting.update({
          where: { key: param(req, 'key') },
          data: { value: input.value as never, updatedById: req.principal!.id },
        });
      }

      await new AuditService(req.ctx.prisma).record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'SETTINGS_CHANGED',
          entityType: 'setting',
          entityId: param(req, 'key'),
          entityLabel: existing.label,
          summary: `Changed ${param(req, 'key')}${input.locale ? ` (${input.locale})` : ''}`,
          before: { value: existing.value },
          after: { value: input.value },
        },
      );

      res.json({ ok: true });
    }),
  );

  router.patch(
    '/flags/:key',
    requirePermission('settings.manage'),
    rateLimit('cmsWrite'),
    asyncHandler(async (req, res) => {
      const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);

      const flag = await req.ctx.prisma.featureFlag.findUnique({ where: { key: param(req, 'key') } });
      if (!flag) throw ApiError.notFound('Feature flag');

      await req.ctx.prisma.featureFlag.update({
        where: { key: param(req, 'key') },
        data: { enabled, updatedById: req.principal!.id },
      });

      await new AuditService(req.ctx.prisma).record(
        { id: req.principal!.id, email: req.principal!.email, ipAddress: clientIp(req) },
        {
          action: 'SETTINGS_CHANGED',
          entityType: 'featureFlag',
          entityId: flag.id,
          entityLabel: flag.label,
          summary: `${enabled ? 'Enabled' : 'Disabled'} ${flag.key}`,
        },
      );

      res.json({ ok: true, enabled });
    }),
  );

  // ===========================================================================
  // Notifications
  // ===========================================================================

  router.get(
    '/notifications',
    asyncHandler(async (req, res) => {
      const notifications = await req.ctx.prisma.notification.findMany({
        where: { userId: req.principal!.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      res.json({
        notifications,
        unread: notifications.filter((notification) => notification.readAt === null).length,
      });
    }),
  );

  router.post(
    '/notifications/read',
    asyncHandler(async (req, res) => {
      const { ids } = z.object({ ids: z.array(z.string().cuid()).max(100).optional() }).parse(req.body);

      const result = await req.ctx.prisma.notification.updateMany({
        where: { userId: req.principal!.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
        data: { readAt: new Date() },
      });

      res.json({ ok: true, marked: result.count });
    }),
  );

  return router;
}
