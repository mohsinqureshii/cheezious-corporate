import { mediaPage } from '@/components/media/pages';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Brand assets' };

export default mediaPage({
  title: 'Brand assets',
  description: 'Logos and marks, with the usage terms third parties are given.',
  fixed: { brandOnly: 'true' },
});
