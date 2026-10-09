import { existsSync, readFileSync } from 'node:fs';
import { getTableColumns, is, SQL } from 'drizzle-orm';
import { getTableConfig, type IndexedColumn, PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import * as schema from './schema';

const tables = (Object.values(schema) as unknown[]).filter((value): value is PgTable =>
  is(value, PgTable),
);
const configs = tables.map((table) => getTableConfig(table));
type Config = (typeof configs)[number];

/** Index columns are IndexedColumn objects, or SQL for expression indexes. */
const indexColumnNames = (index: Config['indexes'][number]) =>
  index.config.columns.map((col) => (is(col, SQL) ? null : ((col as IndexedColumn).name ?? null)));

/** Column-name lists of every non-partial index, unique constraint and primary key on a table. */
const fullIndexes = (config: Config): (string | null)[][] => [
  ...config.indexes.filter((index) => !index.config.where).map(indexColumnNames),
  ...config.uniqueConstraints.map((unique) => unique.columns.map((col) => col.name)),
  ...config.primaryKeys.map((pk) => pk.columns.map((col) => col.name)),
  ...config.columns.filter((col) => col.primary || col.isUnique).map((col) => [col.name]),
];

describe('data model rules', () => {
  it('has the 30 tables recorded in Stack decisions', () => {
    expect(tables).toHaveLength(30);
  });

  it('indexes every foreign key', () => {
    const missing = configs.flatMap((config) =>
      config.foreignKeys
        .map((fk) => fk.reference().columns.map((col) => col.name))
        .filter(
          (fkCols) =>
            !fullIndexes(config).some((indexCols) =>
              fkCols.every((name, i) => indexCols[i] === name),
            ),
        )
        .map((fkCols) => `${config.name}(${fkCols.join(', ')})`),
    );
    expect(missing).toEqual([]);
  });

  it('gives every soft-delete column a partial index', () => {
    const missing = configs
      .filter((config) => config.columns.some((col) => col.name === 'deleted_at'))
      .filter(
        (config) =>
          !config.indexes.some(
            (index) =>
              is(index.config.where, SQL) && indexColumnNames(index).includes('deleted_at'),
          ),
      )
      .map((config) => config.name);
    expect(missing).toEqual([]);
  });

  it('stores no health, condition, diagnosis or minor-flag column', () => {
    const banned = /health|condition|diagnos|medical|injur|disab|minor/;
    const offenders = configs.flatMap((config) =>
      config.columns
        .map((col) => col.name)
        .filter((name) => banned.test(name))
        .map((name) => `${config.name}.${name}`),
    );
    expect(offenders).toEqual([]);
  });

  it('stores no birthdate for children', () => {
    const childColumns = Object.values(getTableColumns(schema.children)).map((col) => col.name);
    expect(childColumns.filter((name) => /dob|birth/.test(name))).toEqual([]);
  });

  it('has a down migration for every migration', () => {
    const dir = new URL('../../drizzle/', import.meta.url);
    const journal = JSON.parse(readFileSync(new URL('meta/_journal.json', dir), 'utf8')) as {
      entries: { tag: string }[];
    };
    const missing = journal.entries
      .map((entry) => entry.tag)
      .filter((tag) => !existsSync(new URL(`down/${tag}.sql`, dir)));
    expect(missing).toEqual([]);
  });
});
