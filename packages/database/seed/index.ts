import { PrismaClient } from '@prisma/client';

import { seedAccessControl } from './access-control';
import { seedBlocks } from './blocks';
import { seedCareers } from './careers';
import { seedCompany } from './company';
import { seedContent } from './content';
import { seedMedia } from './media';
import { seedNavigation } from './navigation';
import { seedPages } from './pages';
import { seedSettings } from './settings';
import { seedSubmissionsReference } from './submissions-reference';
import { seedUrduSpine } from './urdu';

/**
 * Seed.
 *
 * Creates the structural content the platform needs to run, plus demonstration
 * content so every feature can be exercised immediately.
 *
 * The governing rule for demo content: **no Cheezious fact is invented.** Every
 * seeded statistic, milestone, award, leadership biography and impact metric is
 * flagged `isDemoContent` and labelled as a placeholder in the CMS and on the
 * page. Restaurant counts, employee numbers, certifications and sourcing claims
 * are structural examples showing where approved data goes — never assertions
 * about the real company.
 *
 * The seed is idempotent: every write is an upsert keyed on a stable business
 * key, so running it twice does not duplicate anything.
 */

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const startedAt = Date.now();
  console.log('Seeding Cheezious Corporate Digital Platform…\n');

  console.log('  → access control (permissions, roles, first administrator)');
  const { adminUser } = await seedAccessControl(prisma);

  console.log('  → block definitions');
  await seedBlocks(prisma);

  console.log('  → settings, locales, boilerplate');
  await seedSettings(prisma);

  console.log('  → company records (departments, regions, leadership, timeline)');
  await seedCompany(prisma, adminUser.id);

  console.log('  → editorial content (stories, news, press releases)');
  await seedContent(prisma, adminUser.id);

  console.log('  → careers (categories, locations, jobs, employee stories)');
  await seedCareers(prisma, adminUser.id);

  console.log('  → impact, reports, policies');
  const { seedImpactAndPublications } = await import('./impact');
  await seedImpactAndPublications(prisma, adminUser.id);

  console.log('  → submission reference data, forms and media folders');
  await seedSubmissionsReference(prisma);

  console.log('  → placeholder photography');
  const mediaByKey = await seedMedia(prisma, adminUser.id);

  console.log('  → corporate pages');
  await seedPages(prisma, adminUser.id, mediaByKey);

  console.log('  → Urdu spine (structural pages, marked as awaiting translation)');
  await seedUrduSpine(prisma, adminUser.id, mediaByKey);

  console.log('  → navigation, mega menu, footer');
  await seedNavigation(prisma);

  const [pages, stories, jobs, people] = await Promise.all([
    prisma.page.count(),
    prisma.story.count(),
    prisma.job.count(),
    prisma.person.count(),
  ]);

  console.log(`\nSeed complete in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`);
  console.log(`  ${pages} pages · ${stories} stories · ${jobs} jobs · ${people} people\n`);
  console.log('Sign in to the CMS with:');
  console.log(`  ${adminUser.email}`);
  console.log(`  ${process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe-First-Signin-2026'}\n`);
  console.log('All seeded statistics, milestones and biographies are demo placeholders.');
  console.log('Replace them with approved corporate data before publication.\n');
}

main()
  .catch((error: unknown) => {
    console.error('\nSeed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
