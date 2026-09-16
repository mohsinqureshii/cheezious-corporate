import {
  ALL_PERMISSIONS,
  describePermission,
  isHighRisk,
  PERMISSION_GROUPS,
  permissionsForRole,
  ROLE_DEFINITIONS,
  type Permission,
} from '@cheezious/permissions';
import type { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

/**
 * Seed permissions, roles and the first administrator.
 *
 * Permissions are synchronised from the code catalogue every run, so adding a
 * permission in `@cheezious/permissions` and re-seeding is all it takes to make
 * it assignable. Role *assignments* are only written when a role is first
 * created — re-seeding never silently reverts permission changes an
 * administrator has made through the CMS.
 */
export async function seedAccessControl(prisma: PrismaClient) {
  const groupOf = new Map<Permission, string>();
  for (const group of PERMISSION_GROUPS) {
    for (const permission of group.permissions) groupOf.set(permission, group.label);
  }

  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      create: {
        key,
        description: describePermission(key),
        group: groupOf.get(key) ?? 'Other',
        isHighRisk: isHighRisk(key),
      },
      update: {
        description: describePermission(key),
        group: groupOf.get(key) ?? 'Other',
        isHighRisk: isHighRisk(key),
      },
    });
  }

  const permissionIds = new Map(
    (await prisma.permission.findMany({ select: { id: true, key: true } })).map((p) => [p.key, p.id]),
  );

  const roleKeys = Object.keys(ROLE_DEFINITIONS) as Array<keyof typeof ROLE_DEFINITIONS>;

  for (const [index, key] of roleKeys.entries()) {
    const definition = ROLE_DEFINITIONS[key];

    const existing = await prisma.role.findUnique({ where: { key }, select: { id: true } });

    const role = await prisma.role.upsert({
      where: { key },
      create: {
        key,
        name: definition.name,
        description: definition.description,
        isSystem: definition.isSystem,
        sortOrder: index,
      },
      update: { name: definition.name, description: definition.description, sortOrder: index },
    });

    // Only write permissions on creation, or for SUPER_ADMIN which must always
    // hold everything — otherwise re-seeding would undo deliberate changes.
    const shouldSyncPermissions = !existing || key === 'SUPER_ADMIN';
    if (!shouldSyncPermissions) continue;

    const permissions = permissionsForRole(key);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions
        .map((permission) => permissionIds.get(permission))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }

  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@cheezious.local').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe!Admin123';

  const superAdmin = await prisma.role.findUniqueOrThrow({ where: { key: 'SUPER_ADMIN' } });

  const adminUser = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: 'Platform Administrator',
      jobTitle: 'Administrator',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 }),
      status: 'ACTIVE',
      // The seeded password is a known value, so the account is required to
      // change it at first sign-in.
      mustChangePassword: true,
      passwordChangedAt: new Date(),
    },
    update: {},
    select: { id: true, email: true },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: superAdmin.id } },
    create: { userId: adminUser.id, roleId: superAdmin.id },
    update: {},
  });

  // Demonstration accounts, one per operational role, so the permission model
  // can be exercised without inventing users by hand. Disabled by default.
  const demoUsers: Array<{ email: string; name: string; jobTitle: string; role: string }> = [
    { email: 'comms@cheezious.local', name: 'Corporate Communications', jobTitle: 'Communications Lead', role: 'CORPORATE_COMMUNICATIONS' },
    { email: 'hr@cheezious.local', name: 'People Team', jobTitle: 'HR Manager', role: 'HR_MANAGER' },
    { email: 'pr@cheezious.local', name: 'Press Office', jobTitle: 'PR Manager', role: 'PR_MANAGER' },
    { email: 'procurement@cheezious.local', name: 'Procurement Team', jobTitle: 'Procurement Manager', role: 'PROCUREMENT_MANAGER' },
    { email: 'expansion@cheezious.local', name: 'Expansion Team', jobTitle: 'Expansion Manager', role: 'EXPANSION_MANAGER' },
    { email: 'editor@cheezious.local', name: 'Content Editor', jobTitle: 'Editor', role: 'EDITOR' },
    { email: 'author@cheezious.local', name: 'Content Author', jobTitle: 'Author', role: 'AUTHOR' },
  ];

  for (const demo of demoUsers) {
    const role = await prisma.role.findUnique({ where: { key: demo.role }, select: { id: true } });
    if (!role) continue;

    const user = await prisma.user.upsert({
      where: { email: demo.email },
      create: {
        email: demo.email,
        name: demo.name,
        jobTitle: demo.jobTitle,
        // No password is set: these accounts exist to demonstrate the role model
        // and must be invited properly before they can be used.
        status: 'INVITED',
        invitedById: adminUser.id,
      },
      update: {},
      select: { id: true },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {},
    });
  }

  return { adminUser };
}
