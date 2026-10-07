// World mutations used by several portal screens. All immutable, all through update().
import type { List } from '../shared/data';
import type { World } from '../shared/store';
import { today, uid } from './logic';

type Update = (fn: (w: World) => World) => void;

export const companyLists = (w: World, companyId: string) =>
  w.lists.filter((l) => l.companyId === companyId);

export function addToList(update: Update, listId: string, athleteId: string) {
  update((w) => ({
    ...w,
    lists: w.lists.map((l) =>
      l.id === listId && !l.athleteIds.includes(athleteId)
        ? { ...l, athleteIds: [...l.athleteIds, athleteId], updated: 'Today' }
        : l,
    ),
  }));
}

export function removeFromList(update: Update, listId: string, athleteId: string) {
  update((w) => ({
    ...w,
    lists: w.lists.map((l) =>
      l.id === listId
        ? { ...l, athleteIds: l.athleteIds.filter((x) => x !== athleteId), updated: 'Today' }
        : l,
    ),
  }));
}

export function patchList(update: Update, listId: string, patch: Partial<List>) {
  update((w) => ({
    ...w,
    lists: w.lists.map((l) => (l.id === listId ? { ...l, ...patch, updated: 'Today' } : l)),
  }));
}

export function createList(update: Update, l: Omit<List, 'id' | 'updated'>): string {
  const id = uid('l');
  update((w) => ({ ...w, lists: [{ ...l, id, updated: 'Today' }, ...w.lists] }));
  return id;
}

export function deleteList(update: Update, listId: string) {
  update((w) => ({ ...w, lists: w.lists.filter((l) => l.id !== listId) }));
}

/** Quick save from search results: toggles the athlete in the company's "Saved" list (creates it if missing). */
export function toggleQuickSave(
  w: World,
  update: Update,
  companyId: string,
  athleteId: string,
): boolean {
  const saved = companyLists(w, companyId).find((l) => l.name === 'Saved');
  if (!saved) {
    createList(update, {
      companyId,
      name: 'Saved',
      color: '#4A4F57',
      athleteIds: [athleteId],
      sharedWith: [],
    });
    return true;
  }
  if (saved.athleteIds.includes(athleteId)) {
    removeFromList(update, saved.id, athleteId);
    return false;
  }
  addToList(update, saved.id, athleteId);
  return true;
}

export function addNote(
  update: Update,
  athleteId: string,
  companyId: string,
  author: string,
  text: string,
) {
  update((w) => ({
    ...w,
    notes: [...w.notes, { id: uid('n'), athleteId, companyId, author, date: today(), text }],
  }));
}
