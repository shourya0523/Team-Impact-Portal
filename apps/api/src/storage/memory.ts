import type { Storage } from './index';

/** In-memory bucket for tests. `objects` stands in for what clients have PUT. */
export const createMemoryStorage = () => {
  const objects = new Map<string, { contentType: string; byteSize: number }>();
  const storage: Storage = {
    presignPut: async (key, { contentType, byteSize }) => ({
      url: `https://storage.test/${key}?signature=put`,
      headers: { 'content-type': contentType, 'content-length': String(byteSize) },
    }),
    head: async (key) => objects.get(key) ?? null,
    presignGet: async (key) => `https://storage.test/${key}?signature=get`,
    delete: async (key) => {
      objects.delete(key);
    },
  };
  return { storage, objects };
};
