import { EDITORIAL_COLLECTIONS } from './editorial';
import { REFERENCE_COLLECTIONS } from './reference';

export * from './types';

/**
 * Every collection the CMS manages, editorial first.
 *
 * Order matters only for the CMS's own listings; routing is by path.
 */
export const COLLECTIONS = [...EDITORIAL_COLLECTIONS, ...REFERENCE_COLLECTIONS];
