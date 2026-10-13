import { timestamp, uuid } from 'drizzle-orm/pg-core';

export const id = () => uuid('id').primaryKey().defaultRandom();
export const at = (name: string) => timestamp(name, { withTimezone: true });
export const createdAt = () => at('created_at').notNull().defaultNow();
