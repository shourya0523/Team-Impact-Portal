import type { Storage } from './index';

/**
 * In-memory bucket for tests. `objects` stands in for what clients have PUT: the file's bytes and
 * the content type it was stored with.
 */
export const createMemoryStorage = () => {
  const objects = new Map<string, { contentType: string; body: Uint8Array }>();
  const storage: Storage = {
    presignPut: async (key, { contentType, byteSize }) => ({
      url: `https://storage.test/${key}?signature=put`,
      headers: { 'content-type': contentType, 'content-length': String(byteSize) },
    }),
    copy: async (from, to) => {
      const object = objects.get(from);
      if (!object) return false;
      objects.set(to, { contentType: object.contentType, body: object.body.slice() });
      return true;
    },
    head: async (key) => {
      const object = objects.get(key);
      return object ? { contentType: object.contentType, byteSize: object.body.length } : null;
    },
    readStart: async (key, length) => objects.get(key)?.body.slice(0, length) ?? new Uint8Array(),
    presignGet: async (key) => `https://storage.test/${key}?signature=get`,
    delete: async (key) => {
      objects.delete(key);
    },
  };
  return { storage, objects };
};
