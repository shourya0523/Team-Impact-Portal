import {
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
  head(key: string): Promise<{ contentType: string | undefined; byteSize: number } | null>;
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

    async head(key) {
      try {
        const object = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return { contentType: object.ContentType, byteSize: object.ContentLength ?? 0 };
      } catch (error) {
        if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404)
          return null;
        throw error;
      }
    },

    presignGet: (key, expiresIn) =>
      getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn }),

    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
};
