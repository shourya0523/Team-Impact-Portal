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
- `packages/ui-tokens`: plain numbers/hex only, must work on native, RN Web and the portal. Primitives (Button, Input, Card, Avatar, Badge, Sheet) are NOT here: they need RN or the DOM, so they live in `apps/athlete/src/ui` and `apps/portal/src/ui`, built only from these tokens (Notion TI-12 wording is outdated on this)
- Hosting: DigitalOcean (App Platform, Managed Postgres, Valkey, Spaces). No provider-specific primitives

## Commands

`pnpm install`, `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm format`.
Run typecheck, lint and test before pushing.

## Hard product rules (PRD §2, §6)

- Children under 13 never log in; their profile is run by a parent and visible only to their team and family
- Child profiles (under 13 or teen) never appear in search, recruiter views, card exports or the network feed
- Teens never see athletes' contact details
- No health or diagnosis data is collected about anyone
- Athletes without open-to-recruiting don't appear on the employer portal at all
- Identity (affinity-group) search sits behind one feature flag, is opt-in, and every such search is logged
- Extracted resume text is untrusted data; nothing extracted is shown until the athlete confirms it
- Every post, comment and event goes through moderation before it appears

## Design system (Signing Day, TI-72)

- Tokens live in `packages/ui-tokens` (colour, type, radius, layout, motion). Read its README. Brand navy `#1E3F7B`, action red `#EA2642` (logo colours); change colours in `colors.ts` only
- `tokens.css` is generated: run `pnpm --filter @team-impact/ui-tokens build:css` after changing tokens (a test fails if stale; it is excluded from Prettier)
- No hardcoded hex or magic spacing/radius/font sizes in apps: ESLint fails them (root `eslint.config.mjs`). Runtime data such as team colours goes in a fixture with a scoped disable
- Every text/background pair must be AA; add new pairs to `textPairs` / `uiPairs` so the contrast test covers them
- Honour `useReducedMotion` (no stamp, tilt or shine; movement becomes a fade)
- Expo Router is not adopted yet: the athlete app is `App.tsx` plus `src/` (AGENTS.md describes the future `src/app/` layout)

## Conventions

- React version must stay identical across `apps/athlete` and `apps/portal` (hoisted node_modules)
- Workspace packages export `./src/index.ts` directly; the API bundles them with esbuild (`apps/api/build.mjs`)
- Never commit `.env`; secrets live in the platform store
