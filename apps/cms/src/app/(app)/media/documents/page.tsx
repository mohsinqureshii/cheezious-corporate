import { mediaPage } from '@/components/media/pages';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Documents' };

export default mediaPage({
  title: 'Documents',
  description: 'Reports, policies and other files offered for download.',
  fixed: { kind: 'DOCUMENT' },
});
