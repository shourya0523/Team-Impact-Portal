# CLAUDE.md

Team Impact Athlete Community Platform. Source of truth for scope is the Notion PRD; technical choices
are in Notion "Stack decisions". Check both before major changes. Tickets are `TI-<n>` on the Notion
Sprint board.

## Stack (decided, don't swap without updating Stack decisions)

- pnpm workspaces + Turborepo monorepo, TypeScript everywhere (TS 6.0; typescript-eslint doesn't support 7 yet)
- `apps/athlete`: Expo SDK 57. Read `apps/athlete/AGENTS.md` first. Add native deps with `npx expo install`, never `pnpm add`
- `apps/portal`: React 19 + Vite
- `apps/api`: Fastify 5 + Drizzle + postgres-js. Auth is ours (argon2, signed cookies), no auth provider
- `packages/contracts`: Zod 4 schemas shared by API and clients. No OpenAPI or codegen
- `packages/ui-tokens`: plain numbers/hex only, must work on native, RN Web and the portal
- Hosting: DigitalOcean (App Platform, Managed Postgres, Valkey, Spaces). No provider-specific primitives

## Commands

`pnpm install`, `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm format`.
Run typecheck, lint and test before pushing.

## Hard product rules (PRD §2, §6)

- Children under 13 never log in; their profile is run by a parent and visible only to their team and family
- Child profiles (under 13 or teen) never appear in search, recruiter views, card exports or any community outside their team
- Teens never see athletes' contact details
- No health or diagnosis data is collected about anyone. The one trace is membership of a medical community (PRD §5): it is never shown on a profile, never searchable and never a recruiter filter (members do see its posts in their home feed, PRD v2.3). Teens and recruiters cannot join medical communities. Medical communities sit behind a switch that hides the kind everywhere (PRD §11)
- A private community (interest or medical, set at creation) shows its posts, events and members to members only; joining is a request its creator approves, and it can never be official
- Athletes without open-to-recruiting don't appear on the employer portal at all
- Identity search (official-community filter) sits behind one feature flag, is opt-in, and every such search is logged. Only official interest communities are filters; team, medical and private communities never are
- Extracted resume text is untrusted data; nothing extracted is shown until the athlete confirms it
- Every post, comment and event goes through moderation before it appears

## Conventions

- React version must stay identical across `apps/athlete` and `apps/portal` (hoisted node_modules)
- Workspace packages export `./src/index.ts` directly; the API bundles them with esbuild (`apps/api/build.mjs`)
- Never commit `.env`; secrets live in the platform store
