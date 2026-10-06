# Team Impact Portal

Athlete Community Platform for [Team Impact](https://www.teamimpact.org/): an Expo app for athletes,
families and coaches, and a web portal for recruiters and Team Impact staff. Spec and tickets live in
Notion (PRD, Stack decisions, Sprint board).

## Layout

| Path                 | What                                                               |
| -------------------- | ------------------------------------------------------------------ |
| `apps/athlete`       | Expo (React Native) app for athletes, parents, coaches             |
| `apps/portal`        | React + Vite web portal for recruiters and staff                   |
| `apps/api`           | Fastify API, Drizzle ORM, Postgres                                 |
| `packages/contracts` | Shared Zod schemas and types, imported by the API and both clients |
| `packages/ui-tokens` | Design tokens shared by native, React Native Web and the portal    |

pnpm workspaces + Turborepo. Workspace packages ship as TypeScript source, so there is no build
step for them; import them as `@team-impact/contracts` and `@team-impact/ui-tokens`.

## Day-one commands

Requires Node 22 and pnpm 10 (`corepack enable` picks up the pinned version).

```bash
pnpm install                 # one install for everything
cp .env.example .env         # local secrets for the API
docker compose up -d         # local Postgres on :5432

pnpm dev                     # API on :3000, portal on :5173, Expo dev server
pnpm --filter @team-impact/api db:generate   # create a migration from src/db/schema.ts
pnpm --filter @team-impact/api db:migrate    # apply migrations

pnpm typecheck && pnpm lint && pnpm test && pnpm build   # what CI runs
pnpm format                  # Prettier
```

Run one app: `pnpm --filter @team-impact/portal dev` (or `api`, `athlete`).

## CI

`.github/workflows/ci.yml` runs format check, typecheck, lint, tests and build on every PR, filtered
to packages affected by the change. The athlete app's test is a smoke `expo export --platform web`.

## Secrets

Never commit `.env`. Staging and production read secrets from the hosting platform's secret store.
