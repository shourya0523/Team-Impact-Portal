# Handoff: app shells on mocked endpoints

Written 13 Oct 2026 for a fresh Claude Code session. Read `CLAUDE.md` and `apps/athlete/AGENTS.md` first, then the Notion PRD (v2.2) and Stack decisions before any major change.

## Goal

Both clients run end to end against mocked endpoints, so screen work can start before the real API exists:

- **Portal shell** for recruiters and staff (`apps/portal`): routes, layout, role-gated navigation, sign-in, with every call going to mocks. Matches the Sprint board ticket "Portal shell: recruiter and staff, on mocked endpoints".
- **Athlete app shell** (`apps/athlete`): the Expo Router skeleton already exists on this branch (role-based tabs from the v2 wireframes). Point it at the same mocks and check every role's tabs render.
- **Mocked endpoints**: one source of mock data used by both clients.

## Starting point

Branch `integration/shell-base`, which is `main` plus these branches, merged cleanly, with `pnpm install --frozen-lockfile` and `pnpm typecheck` passing (7 packages):

| Merged                                  | What it brings                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `feature/zodd-schema`                   | Zod contracts in `packages/contracts` (roles, users, teams, join requests, QR codes, cards, posts, events, groups, companies, lists, moderation) |
| `ti-14-schema-and-seed`                 | Drizzle schema, migration `0000_v2_data_model.sql`, seed, `docs/data-model.md`                                                                   |
| `frontend-design-tokens-and-primitives` | `packages/ui-tokens`, `packages/ui-primitives`, athlete app shell                                                                                |
| `design/hifi-mockups`                   | `apps/mockups`, high-fidelity screens (additive)                                                                                                 |
| `docs/claude-md-communities`            | CLAUDE.md rules for PRD v2.2                                                                                                                     |

Not merged on purpose:

- ~~`design/signing-day-tokens` conflicts with the tokens branch above.~~ Resolved 13 Oct: the lead chose the Signing Day set; it is merged (`ddee6c2`) and both apps use it.
- `test` is a one-line change.
- `local/ecstatic-gauss-xm1swi` was not looked at.

## Known gaps to handle first

1. **Communities.** Done in the contracts: `packages/contracts/src/communities.ts` replaces `groups.ts`, with kinds `team`, `team_impact`, `medical`, `interest`, and `official` on interest only. Posts, events, announcements and opportunities now carry a `communityId` / `community` instead of an `audience`, and reports can target a community. `canCreateCommunity` and `canJoinCommunity` encode the PRD §5 table. The database matches since migration `0002_communities`.
2. **Alumni roles.** Contracts split alumni into `alumni_athlete` and `alumni_mentor` (matches PRD §2, §8). The database matches since `0002_communities`. Mock data follows the contracts.
3. ~~**Token conflict** noted above.~~ Resolved: Signing Day tokens (see CLAUDE.md, Design system).

## Mock API (done)

`pnpm dev:mock` (or `MOCK_API=1` for `apps/api`) serves fixture data with no database. Code is in `apps/api/src/mock`: `fixtures.ts` (one Tufts team, coach, four athletes, two parents with a child each, a teen, two Northbeam recruiters, an alumni athlete and mentor, one community of each kind), `world.ts` (visibility rules), `routes.ts`, and `mock.test.ts` (one test per hard rule). Every response is parsed through its contract before it's sent.

| Route                                                                                                                                                                                              | Who                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `POST /auth/dev-sign-in` `{ role }`, `POST /auth/sign-out`, `GET /me`                                                                                                                              | anyone                                            |
| `GET /config/flags`                                                                                                                                                                                | anyone, no session                                |
| `GET /communities`, `GET /communities/:id`, `GET /feed`, `GET /events`                                                                                                                             | signed in                                         |
| `GET /colleges`, `GET /teams?collegeId=`, `POST /join-requests`                                                                                                                                    | join flow; requests from athletes, parents, teens |
| `GET /search/athletes`, `GET /cards/:athleteId`, `GET /lists`, `GET /lists/:id`                                                                                                                    | recruiters (cards: anyone allowed to see them)    |
| `GET /staff/teams`, `/staff/companies`, `/staff/moderation/tickets`, `POST …/tickets/:id/resolve`, `GET /staff/communities`, `PUT /staff/communities/:id/official`, `GET /staff/identity-searches` | staff                                             |

Flags: `FLAG_IDENTITY_SEARCH` and `FLAG_MEDICAL_COMMUNITIES` (both default on). The dev sign-in route only exists with `MOCK_API=1`.

## Suggested approach

- Mocks live in the API app (`apps/api`), as Fastify routes behind a `MOCK_API=1` switch, returning fixture data that is parsed through the `packages/contracts` schemas before it is sent, so a contract change breaks the mocks at build time. No database needed. If you find a better fit (for example MSW in the clients), say why before switching.
- One fixture set: one Tufts team with a coach, athletes, two parents with a child each, a teen, a recruiter company, an alumnus, and one example of each community kind. Mirror the seed in `apps/api/src/db/seed/`.
- Mock sign-in lets you pick a role, so every role's navigation can be checked quickly.
- Card experience is up to 3 entries of `{ role, organization, period }` (matches `ResumeEntry` in `packages/ui-primitives`), not a free-text string. The contracts carry it as `ExperienceEntry[]` (`packages/contracts/src/cards.ts`, max `MAX_EXPERIENCE_ENTRIES`); `cards.payload` was migrated in `drizzle/0001_card_experience_entries.sql`.
- Respect the hard rules in CLAUDE.md in the fixtures too: no child or teen data in recruiter views or search, no health data, no contact details for teens, medical membership never in a profile or search response.
- Use ticket names, not numbers, when writing to the lead. Ticket bodies are Goal / Acceptance criteria / Links only.

## Conventions

- React version identical across `apps/athlete` and `apps/portal`.
- Add native deps with `npx expo install`, never `pnpm add`.
- Workspace packages export `./src/index.ts` directly.
- Run `pnpm typecheck`, `pnpm lint` and `pnpm test` before pushing. Never commit `.env`.
- Do not commit to `main`. Work on a branch off `integration/shell-base` and open a PR.

## Done when

- `pnpm dev` starts the API with mocks, the portal and the athlete app, and each role can sign in and see its navigation.
- Recruiter portal: search results page and a card view, on mock data.
- Staff portal: shells for companies, teams and moderation.
- Athlete app: feed, communities and join flow screens reachable on mock data.
- Typecheck, lint and tests pass.

## Product context (PRD v2.2, 13 Oct)

- Communities replace affinity groups and feed scopes. Kinds: team (private), Team Impact, medical (anyone who can join one can create one, private membership, not teens or recruiters), interest (staff can mark official).
- Only official interest communities are recruiter filters, behind one feature flag, with every search logged.
- Week 4 tickets on the Sprint board: Access layer, Teams and join requests, Staff portal, Uploads, Baseball Card editor, Join flow screens, Staff colleges and teams.
