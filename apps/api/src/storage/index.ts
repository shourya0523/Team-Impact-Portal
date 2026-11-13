import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/** The private bucket behind every upload. Spaces in production, anything S3-compatible locally. */
export interface Storage {
  /** A URL the client PUTs the file to. Type and size are signed in, so the bucket rejects others. */
  presignPut(
    key: string,
    file: { contentType: string; byteSize: number },
    expiresInSeconds: number,
  ): Promise<{ url: string; headers: Record<string, string> }>;
  /**
   * Copies `from` to `to` inside the bucket, server side (S3 CopyObject, which Spaces supports),
   * keeping its content type. False if `from` doesn't exist.
   */
  copy(from: string, to: string): Promise<boolean>;
  head(key: string): Promise<{ contentType: string | undefined; byteSize: number } | null>;
  /** Up to `length` bytes from the start of the file, to check its magic bytes. */
  readStart(key: string, length: number): Promise<Uint8Array>;
  presignGet(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export interface S3StorageOptions {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export const createS3Storage = ({
  endpoint,
  region,
  bucket,
  accessKeyId,
  secretAccessKey,
}: S3StorageOptions): Storage => {
  // Path-style URLs work on both Spaces and local S3 stand-ins.
  const client = new S3Client({
    endpoint,
    region,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  const notFound = (error: unknown) =>
    error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404;

  return {
    async presignPut(key, { contentType, byteSize }, expiresIn) {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: byteSize,
      });
      const url = await getSignedUrl(client, command, {
        expiresIn,
        signableHeaders: new Set(['content-type', 'content-length']),
      });
      return { url, headers: { 'content-type': contentType, 'content-length': String(byteSize) } };
    },

    async copy(from, to) {
      try {
        // CopySource is `bucket/key`, URL-encoded except for the slashes.
        const source = `${bucket}/${from.split('/').map(encodeURIComponent).join('/')}`;
        await client.send(new CopyObjectCommand({ Bucket: bucket, Key: to, CopySource: source }));
        return true;
      } catch (error) {
        if (notFound(error)) return false;
        throw error;
      }
    },

    async head(key) {
      try {
        const object = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { contentType: object.ContentType, byteSize: object.ContentLength ?? 0 };
      } catch (error) {
        if (notFound(error)) return null;
        throw error;
      }
    },

    async readStart(key, length) {
      const object = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${length - 1}` }),
      );
      return object.Body ? await object.Body.transformToByteArray() : new Uint8Array();
    },

    presignGet: (key, expiresIn) =>
      getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn }),

    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
};
