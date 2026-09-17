/**
 * Provision the account the end-to-end suite signs in as.
 *
 * The suite needs an account that is active, has already changed its password,
 * and holds the administrator role — none of which the seed produces. The seeded
 * administrator is deliberately forced through a password change at first
 * sign-in, and the demonstration accounts are deliberately left INVITED with no
 * password at all. Both of those are correct, and neither can be signed into by
 * a test.
 *
 * So the account is provisioned separately, from credentials supplied in the
 * environment. Nothing here has a default: an account with a password anyone can
 * read in a repository is exactly the thing the seed is careful not to create,
 * and a seed that produced one would carry it into whatever database it was next
 * pointed at.
 *
 *   E2E_EMAIL=e2e@cheezious.local E2E_PASSWORD='<something long>' \
 *     pnpm --filter @cheezious/api e2e:account
 */

import { checkPasswordPolicy, hashPassword } from '@cheezious/auth';
import { createPrismaClient } from '@cheezious/database';

// SUPER_ADMIN, because the suite asserts what the permission model refuses as
// well as what it allows: it creates a restricted account of its own and checks
// that account is turned away. Doing that needs user management.
const ROLE_KEY = 'SUPER_ADMIN';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run against a production environment. This script exists to create a ' +
        'test account with a known password; that must never exist in production.',
    );
  }

  const email = process.env.E2E_EMAIL?.trim().toLowerCase();
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Set E2E_EMAIL and E2E_PASSWORD. They are deliberately not defaulted — see the comment ' +
        'at the top of this file.',
    );
  }

  const name = 'End-to-end Test Account';
  const policy = checkPasswordPolicy(password, { email, name });
  if (!policy.valid) {
    // The API enforces this on every password it accepts. A test account that
    // sidesteps it would be testing a system nobody runs.
    throw new Error(`E2E_PASSWORD is not acceptable: ${policy.errors.join(' ')}`);
  }

  const prisma = createPrismaClient();

  try {
    const role = await prisma.role.findUnique({ where: { key: ROLE_KEY }, select: { id: true } });
    if (!role) {
      throw new Error(`The ${ROLE_KEY} role does not exist. Run the seed first.`);
    }

    const passwordHash = await hashPassword(password);
    const account = {
      name,
      jobTitle: 'Automation',
      passwordHash,
      status: 'ACTIVE' as const,
      mustChangePassword: false,
      failedLoginCount: 0,
      lockedUntil: null,
    };

    const user = await prisma.user.upsert({
      where: { email },
      create: { email, ...account },
      update: account,
      select: { id: true },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {},
    });

    console.log(`Provisioned ${email} with the ${ROLE_KEY} role.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
