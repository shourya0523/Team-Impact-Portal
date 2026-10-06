import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { ROLES } from '@team-impact/contracts';

// Starter table so migrations have something to run. TI-14 owns the full v2 data model.
export const roleEnum = pgEnum('role', ROLES);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
