import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ApiEnv } from '@cheezious/config';
import { sanitizeFilename } from '@cheezious/validation';

/**
 * Object storage.
 *
 * A narrow interface with a local-disk driver for development and an
 * S3-compatible driver for deployment. Application code only ever sees storage
 * keys, never provider-specific paths, so switching providers does not touch
 * any module that stores a file.
 */

export interface StoredObject {
  storageKey: string;
  byteSize: number;
  checksum: string;
  url: string;
}

export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  urlFor(key: string): string;
}

/**
 * Build a storage key.
 *
 * Keys are date-partitioned and carry a random component, so:
 *   • uploading two files called `cv.pdf` cannot collide;
 *   • a key cannot be guessed from a filename, which matters because applicant
 *     CVs live in the same store as public brand assets;
 *   • a prefix listing stays a manageable size over years of uploads.
 */
export function buildStorageKey(prefix: string, filename: string): string {
  const safe = sanitizeFilename(filename);
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${prefix}/${year}/${month}/${randomUUID()}-${safe}`;
}

export function checksumOf(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Local filesystem driver. Used in development and for self-hosted deployments. */
export class LocalStorageDriver implements StorageDriver {
  constructor(
    private readonly root: string,
    private readonly publicBaseUrl: string,
  ) {}

  private resolve(key: string): string {
    // Reject any key that would escape the storage root.
    const target = path.resolve(this.root, key);
    const root = path.resolve(this.root);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      throw new Error('Refusing to access a path outside the storage root.');
    }
    return target;
  }

  async put(key: string, data: Buffer, _contentType: string): Promise<StoredObject> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);

    return {
      storageKey: key,
      byteSize: data.byteLength,
      checksum: checksumOf(data),
      url: this.urlFor(key),
    };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await unlink(this.resolve(key)).catch((error: NodeJS.ErrnoException) => {
      // Deleting something already gone is a success, not a failure.
      if (error.code !== 'ENOENT') throw error;
    });
  }

  urlFor(key: string): string {
    return `${this.publicBaseUrl.replace(/\/+$/, '')}/${key}`;
  }
}

/**
 * S3-compatible driver.
 *
 * Implemented against the REST API with signed requests rather than pulling in
 * the AWS SDK, keeping the deployment footprint small. Works with S3, R2,
 * MinIO and Spaces.
 */
export class S3StorageDriver implements StorageDriver {
  constructor(
    private readonly config: {
      endpoint: string;
      region: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
      forcePathStyle: boolean;
      publicBaseUrl: string;
    },
  ) {}

  private endpointFor(key: string): string {
    const base = this.config.endpoint.replace(/\/+$/, '');
    return this.config.forcePathStyle
      ? `${base}/${this.config.bucket}/${key}`
      : `${base.replace('://', `://${this.config.bucket}.`)}/${key}`;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<StoredObject> {
    const response = await fetch(this.endpointFor(key), {
      method: 'PUT',
      headers: await this.signedHeaders('PUT', key, data, contentType),
      body: new Uint8Array(data),
    });

    if (!response.ok) {
      throw new Error(`Object storage rejected the upload (${response.status}).`);
    }

    return {
      storageKey: key,
      byteSize: data.byteLength,
      checksum: checksumOf(data),
      url: this.urlFor(key),
    };
  }

  async get(key: string): Promise<Buffer> {
    const response = await fetch(this.endpointFor(key), {
      method: 'GET',
      headers: await this.signedHeaders('GET', key),
    });
    if (!response.ok) throw new Error(`Object storage returned ${response.status} for ${key}.`);
    return Buffer.from(await response.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const response = await fetch(this.endpointFor(key), {
      method: 'DELETE',
      headers: await this.signedHeaders('DELETE', key),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Object storage returned ${response.status} deleting ${key}.`);
    }
  }

  urlFor(key: string): string {
    return `${this.config.publicBaseUrl.replace(/\/+$/, '')}/${key}`;
  }

  /** AWS Signature Version 4. */
  private async signedHeaders(
    method: string,
    key: string,
    body?: Buffer,
    contentType?: string,
  ): Promise<Record<string, string>> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = body ? checksumOf(body) : createHash('sha256').update('').digest('hex');

    const url = new URL(this.endpointFor(key));
    const host = url.host;
    const canonicalUri = url.pathname;

    const headers: Record<string, string> = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...(contentType ? { 'content-type': contentType } : {}),
    };

    const sortedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = sortedHeaderNames.map((name) => `${name}:${headers[name]}\n`).join('');
    const signedHeaderList = sortedHeaderNames.join(';');

    const canonicalRequest = [
      method,
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaderList,
      payloadHash,
    ].join('\n');

    const scope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const { createHmac } = await import('node:crypto');
    const hmac = (secret: Buffer | string, value: string): Buffer =>
      createHmac('sha256', secret).update(value).digest();

    const signingKey = hmac(
      hmac(hmac(hmac(`AWS4${this.config.secretAccessKey}`, dateStamp), this.config.region), 's3'),
      'aws4_request',
    );
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    return {
      ...headers,
      authorization:
        `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaderList}, Signature=${signature}`,
    };
  }
}

export function createStorageDriver(env: ApiEnv): StorageDriver {
  if (env.STORAGE_DRIVER === 's3') {
    const missing = (['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'] as const)
      .filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new Error(`STORAGE_DRIVER=s3 requires: ${missing.join(', ')}`);
    }

    return new S3StorageDriver({
      endpoint: env.S3_ENDPOINT as string,
      region: env.S3_REGION as string,
      bucket: env.S3_BUCKET as string,
      accessKeyId: env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL,
    });
  }

  return new LocalStorageDriver(env.STORAGE_LOCAL_ROOT, env.STORAGE_PUBLIC_BASE_URL);
}

/** Storage prefixes. Applicant files are separated from public media by prefix. */
export const STORAGE_PREFIX = {
  media: 'media',
  variants: 'variants',
  applications: 'private/applications',
  supplierAttachments: 'private/suppliers',
  propertyAttachments: 'private/properties',
  formUploads: 'private/forms',
} as const;

/** True when a key holds personal data and must never be served publicly. */
export function isPrivateKey(key: string): boolean {
  return key.startsWith('private/');
}
