import type { PrismaClient } from '@prisma/client';

/**
 * The Urdu spine.
 *
 * The platform is bilingual from the database up — every content type carries a
 * locale and a translation group, paths are per-locale, and the site renders
 * right-to-left for Urdu. None of that is demonstrable while there is nothing in
 * Urdu to look at, and a language switch that leads to a 404 is worse than one
 * that leads to a placeholder.
 *
 * So this seeds the structural spine: the sections a reader would switch
 * language on. Two rules govern what it writes, and both matter:
 *
 *   1. **Only the words we are sure of.** Section names are translated;
 *      everything else is an explicit, visibly-marked placeholder in both
 *      languages. Seeding invented Urdu prose would be exactly the failure the
 *      brief warns about, in a language fewer reviewers can check.
 *
 *   2. **Paths match English.** `/ur/company` mirrors `/en/company`, so hreflang
 *      pairs cleanly and a shared link survives a language switch. Localised
 *      slugs are supported per page — the model and validation allow Urdu
 *      slugs — but choosing them is editorial work, not something a seed should
 *      decide.
 *
 * Everything here is created as a published page with `isDemoContent`-style
 * marking in its copy, so nobody mistakes it for approved translation.
 */

/** "[Placeholder] The Urdu translation of this page is not yet complete." */
const PENDING_UR = '[پلیس ہولڈر] اس صفحے کا اردو ترجمہ ابھی مکمل نہیں ہوا۔';
const PENDING_EN =
  '[Placeholder] The Urdu translation of this page is not yet complete. Replace this with approved copy.';

interface UrduPage {
  /** Must match an English page's path, so the pair shares a translation group. */
  path: string;
  /** The section name, translated. */
  title: string;
  /** Navigation label, translated. */
  navLabel: string;
  /** English gloss, kept alongside so a reviewer can check the pairing. */
  englishTitle: string;
}

const SPINE: UrduPage[] = [
  { path: '/company', title: 'کمپنی', navLabel: 'کمپنی', englishTitle: 'Company' },
  { path: '/company/leadership', title: 'قیادت', navLabel: 'قیادت', englishTitle: 'Leadership' },
  { path: '/company/newsroom', title: 'نیوز روم', navLabel: 'نیوز روم', englishTitle: 'Newsroom' },
  { path: '/company/impact', title: 'اثرات', navLabel: 'اثرات', englishTitle: 'Impact' },
  { path: '/company/governance', title: 'گورننس', navLabel: 'گورننس', englishTitle: 'Governance' },
  {
    path: '/company/partners',
    title: 'شراکت دار',
    navLabel: 'شراکت دار',
    englishTitle: 'Partners',
  },
  { path: '/company/contact', title: 'رابطہ', navLabel: 'رابطہ', englishTitle: 'Contact' },
  { path: '/careers', title: 'کیریئرز', navLabel: 'کیریئرز', englishTitle: 'Careers' },
];

export async function seedUrduSpine(
  prisma: PrismaClient,
  actorId: string,
  mediaByKey: Map<string, string>,
): Promise<void> {
  const definitions = new Map(
    (await prisma.blockDefinition.findMany({ select: { id: true, key: true } })).map((d) => [
      d.key,
      d.id,
    ]),
  );

  const heroDefinition = definitions.get('HeroMinimal');
  const statementDefinition = definitions.get('IntroStatement');

  for (const spec of SPINE) {
    // The English page owns the translation group; joining it is what makes the
    // pair visible to hreflang, the CMS and the translation-status screen.
    const english = await prisma.page.findUnique({
      where: { locale_path: { locale: 'en', path: spec.path } },
      select: { id: true, translationGroupId: true, type: true, sortOrder: true },
    });
    if (!english) {
      console.warn(`    ! no English page at ${spec.path}; Urdu counterpart skipped`);
      continue;
    }

    const slug = spec.path.split('/').filter(Boolean).pop() ?? 'company';

    const page = await prisma.page.upsert({
      where: { locale_path: { locale: 'ur', path: spec.path } },
      create: {
        translationGroupId: english.translationGroupId,
        locale: 'ur',
        path: spec.path,
        slug,
        title: spec.title,
        navLabel: spec.navLabel,
        summary: PENDING_UR,
        type: english.type,
        status: 'PUBLISHED',
        // Marked as started rather than finished: the section name is
        // translated, the content is not.
        translationStatus: 'IN_PROGRESS',
        publishedAt: new Date(),
        firstPublishedAt: new Date(),
        sortOrder: english.sortOrder,
        createdById: actorId,
        publishedById: actorId,
      },
      update: { title: spec.title, navLabel: spec.navLabel },
      select: { id: true },
    });

    await prisma.pageSeo.upsert({
      where: { pageId: page.id },
      create: {
        pageId: page.id,
        title: spec.title,
        description: PENDING_UR,
        // Not indexed while it is a placeholder: an untranslated page competing
        // in Urdu search results is worse than no Urdu page at all.
        noindex: true,
      },
      update: {},
    });

    const existingBlocks = await prisma.pageBlock.count({ where: { pageId: page.id } });
    if (existingBlocks > 0) continue;

    if (heroDefinition) {
      await prisma.pageBlock.create({
        data: {
          pageId: page.id,
          definitionId: heroDefinition,
          blockKey: 'HeroMinimal',
          data: {
            eyebrow: 'Cheezious',
            headline: spec.title,
            standfirst: PENDING_UR,
            tone: 'light',
          } as never,
          sortOrder: 0,
        },
      });
    }

    if (statementDefinition) {
      await prisma.pageBlock.create({
        data: {
          pageId: page.id,
          definitionId: statementDefinition,
          blockKey: 'IntroStatement',
          // Both languages, so an English-speaking reviewer opening the Urdu
          // page can tell at a glance that it is a placeholder.
          data: { statement: `${PENDING_UR} — ${PENDING_EN}`, tone: 'muted' } as never,
          sortOrder: 1,
        },
      });
    }
  }

  void mediaByKey;
  console.log(`    ${SPINE.length} Urdu spine pages`);
}
