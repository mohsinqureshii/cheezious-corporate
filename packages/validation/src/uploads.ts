import { z } from 'zod';

/**
 * Upload validation.
 *
 * A file is accepted only when its declared MIME type, its extension and its
 * magic bytes all agree. Checking the extension alone is what lets someone
 * upload `cv.pdf.exe`; checking the client-declared MIME alone is what lets them
 * simply lie.
 */

export interface AllowedFileType {
  mime: string;
  extensions: string[];
  /** Leading bytes that identify the format. Empty for formats without a stable signature. */
  magic: number[][];
  kind: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'OTHER';
}

export const ALLOWED_FILE_TYPES: AllowedFileType[] = [
  { mime: 'image/jpeg', extensions: ['jpg', 'jpeg'], magic: [[0xff, 0xd8, 0xff]], kind: 'IMAGE' },
  {
    mime: 'image/png',
    extensions: ['png'],
    magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    kind: 'IMAGE',
  },
  { mime: 'image/webp', extensions: ['webp'], magic: [[0x52, 0x49, 0x46, 0x46]], kind: 'IMAGE' },
  { mime: 'image/avif', extensions: ['avif'], magic: [], kind: 'IMAGE' },
  { mime: 'image/gif', extensions: ['gif'], magic: [[0x47, 0x49, 0x46, 0x38]], kind: 'IMAGE' },
  {
    mime: 'application/pdf',
    extensions: ['pdf'],
    magic: [[0x25, 0x50, 0x44, 0x46]],
    kind: 'DOCUMENT',
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['docx'],
    magic: [[0x50, 0x4b, 0x03, 0x04]],
    kind: 'DOCUMENT',
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['xlsx'],
    magic: [[0x50, 0x4b, 0x03, 0x04]],
    kind: 'DOCUMENT',
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extensions: ['pptx'],
    magic: [[0x50, 0x4b, 0x03, 0x04]],
    kind: 'DOCUMENT',
  },
  { mime: 'video/mp4', extensions: ['mp4'], magic: [], kind: 'VIDEO' },
  { mime: 'image/svg+xml', extensions: ['svg'], magic: [], kind: 'IMAGE' },
];

/**
 * Types an anonymous member of the public may upload (a CV, a floor plan, a
 * photograph). Deliberately narrower than the CMS allow-list: notably SVG is
 * excluded, because an SVG is a script-capable document.
 */
export const PUBLIC_UPLOAD_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

/** Extensions that must never be stored, whatever the declared MIME type says. */
const EXECUTABLE_EXTENSIONS =
  /\.(exe|bat|cmd|sh|bash|zsh|js|mjs|cjs|php|phtml|py|rb|pl|jar|com|scr|msi|dll|ps1|vbs|wsf|hta)$/i;

export function findFileType(mime: string): AllowedFileType | undefined {
  return ALLOWED_FILE_TYPES.find((t) => t.mime === mime.toLowerCase());
}

export function extensionOf(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';
}

export interface FileValidationInput {
  filename: string;
  mimeType: string;
  byteSize: number;
  /** First bytes of the file, used for the magic-number check. */
  head?: Uint8Array;
}

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  kind?: AllowedFileType['kind'];
  /** Filename stripped of path components and unsafe characters. */
  safeFilename: string;
}

export function validateUpload(
  input: FileValidationInput,
  options: { maxBytes: number; allowedMimes?: readonly string[] },
): FileValidationResult {
  const errors: string[] = [];
  const safeFilename = sanitizeFilename(input.filename);

  if (input.byteSize <= 0) errors.push('The file is empty.');
  if (input.byteSize > options.maxBytes) {
    errors.push(`The file is larger than ${Math.round(options.maxBytes / (1024 * 1024))} MB.`);
  }

  // An executable extension is refused before anything else is considered.
  if (EXECUTABLE_EXTENSIONS.test(safeFilename)) {
    errors.push('Executable files are not accepted.');
    return { valid: false, errors, safeFilename };
  }

  const mime = input.mimeType.toLowerCase().split(';')[0]?.trim() ?? '';
  const allowed = options.allowedMimes ?? ALLOWED_FILE_TYPES.map((t) => t.mime);
  if (!allowed.includes(mime)) {
    errors.push('That file type is not accepted.');
    return { valid: false, errors, safeFilename };
  }

  const type = findFileType(mime);
  if (!type) {
    errors.push('That file type is not accepted.');
    return { valid: false, errors, safeFilename };
  }

  const extension = extensionOf(safeFilename);
  if (!extension || !type.extensions.includes(extension)) {
    errors.push(
      `The file extension does not match its type. Expected: ${type.extensions.join(', ')}.`,
    );
  }

  if (input.head && type.magic.length > 0) {
    const matches = type.magic.some((signature) =>
      signature.every((byte, index) => input.head?.[index] === byte),
    );
    if (!matches) errors.push('The file contents do not match its declared type.');
  }

  return { valid: errors.length === 0, errors, kind: type.kind, safeFilename };
}

/**
 * Reduce a client-supplied filename to something safe to store and to serve.
 * Path separators, control characters and leading dots are all removed.
 */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? 'file';
  const withoutControlChars = Array.from(base)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code > 31 && code !== 127;
    })
    .join('');

  const cleaned = withoutControlChars
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[.-]+/, '')
    .slice(0, 180);

  return cleaned || 'file';
}

export const uploadMetadataSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  byteSize: z.number().int().positive(),
});
