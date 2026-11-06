# CLAUDE.md

Team Impact Athlete Community Platform. Source of truth for scope is the Notion PRD; technical choices
are in Notion "Stack decisions". Check both before major changes. Tickets are `TI-<n>` on the Notion
Sprint board.

## Stack (decided, don't swap without updating Stack decisions)

- pnpm workspaces + Turborepo monorepo, TypeScript everywhere (TS 6.0; typescript-eslint doesn't support 7 yet)
- `apps/athlete`: Expo SDK 57. Read `apps/athlete/AGENTS.md` first. Add native deps with `npx expo install`, never `pnpm add`
- `apps/portal`: React 19 + Vite
- `apps/api`: Fastify 5 + Drizzle + postgres-js. Auth is Better Auth (TI-101): an open-source library running inside the API, with all data in our Postgres (`users` plus `auth_*` tables), argon2 passwords and HttpOnly cookie sessions. No hosted auth provider. Our product rules (age gate, recruiter domains, suspensions) live in its hooks in `apps/api/src/identity`
- `packages/contracts`: Zod 4 schemas shared by API and clients. No OpenAPI or codegen
- `packages/ui-tokens`: plain numbers/hex only, must work on native, RN Web and the portal. Primitives (Button, Input, Card, Avatar, Badge, Sheet) are NOT here: they need RN or the DOM, so they live in `apps/athlete/src/ui` and `apps/portal/src/ui`, built only from these tokens (matches Notion TI-12)
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

## Design system (Signing Day, TI-72)

- Tokens live in `packages/ui-tokens` (colour, type, radius, layout, motion). Read its README. Brand navy `#1E3F7B` and logo red `#EA2642` (decorative); filled actions use `action` `#E3233F`, which passes AA with white text. Change colours in `colors.ts` only
- `tokens.css` is generated: run `pnpm --filter @team-impact/ui-tokens build:css` after changing tokens (a test fails if stale; it is excluded from Prettier)
- No hardcoded hex or magic spacing/radius/font sizes in apps: ESLint fails them (root `eslint.config.mjs`). Runtime data such as team colours goes in a fixture with a scoped disable
- Every text/background pair must be AA; add new pairs to `textPairs` / `uiPairs` so the contrast test covers them
- Honour `useReducedMotion` (no stamp, tilt or shine; movement becomes a fade)
- The athlete app uses Expo Router (`src/app/`). Primitives built from tokens live in `src/ui`; app-level composites (screen header, chips, cards with actions) in `src/components`

## Conventions

- React version must stay identical across `apps/athlete` and `apps/portal` (hoisted node_modules)
- Workspace packages export `./src/index.ts` directly; the API bundles them with esbuild (`apps/api/build.mjs`)
- Never commit `.env`; secrets live in the platform store
