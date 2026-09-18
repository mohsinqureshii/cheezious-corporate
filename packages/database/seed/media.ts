import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { PrismaClient } from '@prisma/client';
import sharp from 'sharp';

import { resolveStorageRoot } from './lib/storage-root';

/**
 * Placeholder photography.
 *
 * The brief calls for tasteful, clearly-marked placeholders where real
 * photography is not yet available, and for layouts to be built around realistic
 * aspect ratios. These images are generated at the ratios corporate photography
 * is actually shot at, in the corporate palette, and each one states in plain
 * language what photograph belongs in that slot.
 *
 * They are deliberately not decorative: nobody should be able to mistake one for
 * a real photograph of a Cheezious restaurant, and every one is flagged so the
 * CMS can list what still needs shooting.
 */

interface PlaceholderSpec {
  key: string;
  title: string;
  /** The photograph that belongs here, in the art director's words. */
  brief: string;
  ratio: '21:9' | '16:9' | '3:2' | '4:5' | '1:1';
  folder: string;
  tone: 'dark' | 'light' | 'accent';
}

const RATIOS: Record<PlaceholderSpec['ratio'], [number, number]> = {
  '21:9': [2100, 900],
  '16:9': [1920, 1080],
  '3:2': [1800, 1200],
  '4:5': [1200, 1500],
  '1:1': [1200, 1200],
};

/** Corporate palette: charcoal, off-white and a restrained Cheezious yellow. */
const TONES: Record<
  PlaceholderSpec['tone'],
  { background: string; foreground: string; accent: string }
> = {
  dark: { background: '#14140F', foreground: '#F5F4EF', accent: '#F2C230' },
  light: { background: '#EFEDE6', foreground: '#14140F', accent: '#C79A16' },
  accent: { background: '#F2C230', foreground: '#14140F', accent: '#14140F' },
};

const PLACEHOLDERS: PlaceholderSpec[] = [
  {
    key: 'hero-corporate',
    title: 'Corporate hero',
    brief: 'Restaurant exterior at dusk, wide, people entering',
    ratio: '21:9',
    folder: '/restaurants',
    tone: 'dark',
  },
  {
    key: 'hero-operations',
    title: 'Operations hero',
    brief: 'Distribution centre floor, product moving, staff at work',
    ratio: '21:9',
    folder: '/operations',
    tone: 'dark',
  },
  {
    key: 'hero-people',
    title: 'People hero',
    brief: 'Team briefing before service, real colleagues, natural light',
    ratio: '21:9',
    folder: '/people',
    tone: 'dark',
  },
  {
    key: 'hero-careers',
    title: 'Careers hero',
    brief: 'Restaurant manager on the floor mid-shift',
    ratio: '21:9',
    folder: '/people',
    tone: 'dark',
  },
  {
    key: 'restaurant-exterior',
    title: 'Restaurant exterior',
    brief: 'Street-level restaurant frontage, daytime',
    ratio: '3:2',
    folder: '/restaurants',
    tone: 'light',
  },
  {
    key: 'restaurant-interior',
    title: 'Restaurant interior',
    brief: 'Dining area in use, customers, no staged food',
    ratio: '3:2',
    folder: '/restaurants',
    tone: 'light',
  },
  {
    key: 'kitchen-operations',
    title: 'Kitchen operations',
    brief: 'Kitchen line during service, hands and process',
    ratio: '3:2',
    folder: '/operations',
    tone: 'light',
  },
  {
    key: 'warehouse',
    title: 'Warehouse',
    brief: 'Racking, pallets, cold-chain handling',
    ratio: '3:2',
    folder: '/operations',
    tone: 'light',
  },
  {
    key: 'distribution',
    title: 'Distribution',
    brief: 'Delivery vehicle loading at the depot, early morning',
    ratio: '3:2',
    folder: '/operations',
    tone: 'light',
  },
  {
    key: 'training',
    title: 'Training',
    brief: 'Training session in progress, trainer and colleagues',
    ratio: '3:2',
    folder: '/people',
    tone: 'light',
  },
  {
    key: 'technology-team',
    title: 'Technology team',
    brief: 'Engineers working — screens incidental, not the subject',
    ratio: '3:2',
    folder: '/operations',
    tone: 'light',
  },
  {
    key: 'customer-service',
    title: 'Customer service',
    brief: 'Customer care colleague on a call',
    ratio: '3:2',
    folder: '/people',
    tone: 'light',
  },
  {
    key: 'supplier-operations',
    title: 'Supplier operations',
    brief: 'Supplier facility, production or handling',
    ratio: '3:2',
    folder: '/operations',
    tone: 'light',
  },
  {
    key: 'community-programme',
    title: 'Community programme',
    brief: 'Community initiative in progress, participants visible',
    ratio: '3:2',
    folder: '/people',
    tone: 'light',
  },
  {
    key: 'construction',
    title: 'Restaurant construction',
    brief: 'Restaurant fit-out under way, site in progress',
    ratio: '3:2',
    folder: '/restaurants',
    tone: 'light',
  },
  {
    key: 'quality-control',
    title: 'Quality control',
    brief: 'Quality check being carried out, hands and instrument',
    ratio: '3:2',
    folder: '/operations',
    tone: 'light',
  },
  {
    key: 'portrait-leadership',
    title: 'Leadership portrait',
    brief: 'Environmental portrait, workplace setting, eye-level',
    ratio: '4:5',
    folder: '/leadership',
    tone: 'light',
  },
  {
    key: 'portrait-colleague',
    title: 'Colleague portrait',
    brief: 'Environmental portrait of a colleague at work',
    ratio: '4:5',
    folder: '/people',
    tone: 'light',
  },
  {
    key: 'editorial-square',
    title: 'Editorial square',
    brief: 'Supporting editorial image, square crop',
    ratio: '1:1',
    folder: '/restaurants',
    tone: 'light',
  },
  {
    key: 'og-default',
    title: 'Default social image',
    brief: 'Corporate social sharing image, 1200×630',
    ratio: '16:9',
    folder: '/brand',
    tone: 'dark',
  },
];

/**
 * Render a placeholder.
 *
 * A diagonal hatch and a stated brief make it unmistakably a placeholder, while
 * the palette and proportions keep it from looking broken in a composed page.
 */
async function render(spec: PlaceholderSpec): Promise<Buffer> {
  const [width, height] = RATIOS[spec.ratio];
  const palette = TONES[spec.tone];

  const titleSize = Math.round(width * 0.028);
  const briefSize = Math.round(width * 0.018);
  const labelSize = Math.round(width * 0.013);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <pattern id="hatch" width="18" height="18" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1="0" y="0" x2="0" y2="18" stroke="${palette.foreground}" stroke-opacity="0.06" stroke-width="7"/>
        </pattern>
      </defs>
      <rect width="${width}" height="${height}" fill="${palette.background}"/>
      <rect width="${width}" height="${height}" fill="url(#hatch)"/>
      <rect x="${width * 0.04}" y="${height * 0.06}" width="${width * 0.92}" height="${height * 0.88}"
            fill="none" stroke="${palette.foreground}" stroke-opacity="0.22" stroke-width="2"/>
      <rect x="${width * 0.04}" y="${height * 0.06}" width="${Math.max(4, width * 0.004)}" height="${height * 0.88}"
            fill="${palette.accent}"/>
      <text x="${width * 0.08}" y="${height * 0.44}" font-family="Helvetica, Arial, sans-serif"
            font-size="${titleSize}" font-weight="700" fill="${palette.foreground}"
            letter-spacing="-0.02em">${escapeXml(spec.title)}</text>
      <text x="${width * 0.08}" y="${height * 0.44 + briefSize * 2}" font-family="Helvetica, Arial, sans-serif"
            font-size="${briefSize}" fill="${palette.foreground}" fill-opacity="0.72">${escapeXml(spec.brief)}</text>
      <text x="${width * 0.08}" y="${height * 0.88}" font-family="Helvetica, Arial, sans-serif"
            font-size="${labelSize}" font-weight="600" fill="${palette.accent}"
            letter-spacing="0.16em">PLACEHOLDER — REPLACE WITH APPROVED PHOTOGRAPHY</text>
      <text x="${width * 0.92}" y="${height * 0.88}" text-anchor="end" font-family="Helvetica, Arial, sans-serif"
            font-size="${labelSize}" fill="${palette.foreground}" fill-opacity="0.5"
            letter-spacing="0.12em">${spec.ratio} · ${width}×${height}</text>
    </svg>`;

  return sharp(Buffer.from(svg)).jpeg({ quality: 82, progressive: true }).toBuffer();
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Generate placeholders, write them to local storage and register them as media
 * assets so blocks can reference them like any other image.
 */
export async function seedMedia(
  prisma: PrismaClient,
  actorId: string,
): Promise<Map<string, string>> {
  // Anchored to the repository root so the seed, the API and the worker all
  // agree on where files live regardless of which directory they run from.
  const storageRoot = resolveStorageRoot(process.env.STORAGE_LOCAL_ROOT ?? './.storage');
  const assetIdByKey = new Map<string, string>();

  const folders = new Map(
    (await prisma.mediaFolder.findMany({ select: { id: true, path: true } })).map((f) => [
      f.path,
      f.id,
    ]),
  );

  // Image generation is the one part of the seed that depends on the host
  // rather than the database: `sharp` renders the placeholder text through
  // libvips, which needs fontconfig, and a slim container may not have it. That
  // must not cost a seed its hundred pages of content, so a failure here is
  // reported and skipped — the pages arrive with empty image slots, which the
  // renderer already handles, and re-running the seed after installing fonts
  // fills them in.
  const failures: string[] = [];

  for (const spec of PLACEHOLDERS) {
    const storageKey = `media/placeholders/${spec.key}.jpg`;

    const existing = await prisma.mediaAsset.findUnique({
      where: { storageKey },
      select: { id: true },
    });
    if (existing) {
      assetIdByKey.set(spec.key, existing.id);
      continue;
    }

    try {
      await writePlaceholder(prisma, spec, storageKey, storageRoot, folders, actorId, assetIdByKey);
    } catch (error) {
      failures.push(spec.key);
      if (failures.length === 1) {
        console.warn(
          `    ! could not generate placeholder images: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  if (failures.length > 0) {
    console.warn(
      `    ! ${failures.length} placeholder image(s) skipped. Content is seeded; image slots are ` +
        'empty. Install fontconfig and a font, then re-run the seed to fill them.',
    );
  }

  // Point the site-wide social sharing image at the generated default, so links
  // to any page share with a preview rather than a blank card. Editors replace
  // the asset in the CMS; the setting keeps pointing at whatever is there.
  const defaultOgKey = 'media/placeholders/og-default.jpg';
  for (const locale of ['en', 'ur'] as const) {
    await prisma.siteSetting.upsert({
      where: { key_locale: { key: 'seo.defaultOgImageKey', locale } },
      create: {
        key: 'seo.defaultOgImageKey',
        locale,
        group: 'seo',
        label: 'Default social sharing image',
        description: 'Used when a page has no image of its own. 1200x630 recommended.',
        value: defaultOgKey,
      },
      update: {},
    });
  }

  return assetIdByKey;
}

/** Which placeholder suits a given page path, so pages are not all identical. */
export function placeholderForPath(pathname: string): string {
  if (pathname.includes('/people') || pathname.includes('/careers')) return 'portrait-colleague';
  if (pathname.includes('/supply-chain') || pathname.includes('/procurement')) return 'warehouse';
  if (pathname.includes('/technology') || pathname.includes('/digital')) return 'technology-team';
  if (pathname.includes('/food-quality')) return 'quality-control';
  if (pathname.includes('/restaurant') || pathname.includes('/business'))
    return 'restaurant-interior';
  if (pathname.includes('/impact')) return 'community-programme';
  if (pathname.includes('/development') || pathname.includes('/real-estate')) return 'construction';
  if (pathname.includes('/leadership')) return 'portrait-leadership';
  return 'editorial-square';
}

export function heroForPath(pathname: string): string {
  if (pathname === '/careers' || pathname.startsWith('/careers')) return 'hero-careers';
  if (pathname.includes('/people')) return 'hero-people';
  if (pathname.includes('/business') || pathname.includes('/supply-chain'))
    return 'hero-operations';
  return 'hero-corporate';
}

/**
 * Render one placeholder, store it, and register it as a media asset.
 *
 * Separate from the loop so that a host without the fonts `sharp` needs fails
 * one image rather than the whole seed.
 */
async function writePlaceholder(
  prisma: PrismaClient,
  spec: (typeof PLACEHOLDERS)[number],
  storageKey: string,
  storageRoot: string,
  folders: Map<string, string>,
  actorId: string,
  assetIdByKey: Map<string, string>,
): Promise<void> {
  const buffer = await render(spec);
  const [width, height] = RATIOS[spec.ratio];

  const target = path.resolve(storageRoot, storageKey);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, buffer);

  // A tiny blurred version is inlined as the loading placeholder, so the page
  // does not flash empty boxes before images arrive.
  const blur = await sharp(buffer).resize(16).blur(1).jpeg({ quality: 40 }).toBuffer();

  const asset = await prisma.mediaAsset.create({
    data: {
      kind: 'IMAGE',
      folderId: folders.get(spec.folder) ?? null,
      storageKey,
      originalName: `${spec.key}.jpg`,
      mimeType: 'image/jpeg',
      byteSize: buffer.byteLength,
      checksum: createHash('sha256').update(buffer).digest('hex'),
      width,
      height,
      blurDataUrl: `data:image/jpeg;base64,${blur.toString('base64')}`,
      placeholderColor: TONES[spec.tone].background,
      title: `[Placeholder] ${spec.title}`,
      // Alt text describes the intended photograph, so the slot is accessible
      // even while the real image is outstanding.
      altText: `Placeholder image. Intended photograph: ${spec.brief.toLowerCase()}.`,
      usageNotes: `PLACEHOLDER. Replace with approved photography: ${spec.brief}.`,
      visibility: 'CMS_ONLY',
      uploadedById: actorId,
    },
    select: { id: true },
  });

  assetIdByKey.set(spec.key, asset.id);
}
