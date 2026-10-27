# Handoff: integration/ticket-stack

Written 27 Oct 2026 for branch `integration/ticket-stack`, on top of `main` at `c4914e1`.
It lands the stranded ticket work in one branch, ready for one PR into `main`. Read CLAUDE.md first.

## What's in it

| Brought in                                                            | PRs it replaces                      |
| --------------------------------------------------------------------- | ------------------------------------ |
| `ti-111-uploads`: one signed upload path for photos and resumes       | #8 (open)                            |
| `ti-policy-can`: visibility rules in one `can(actor, action, target)` | #18 (open)                           |
| `ti-postgres-schema`: schema from groups to communities, fixture seed | #19 (open)                           |
| `contact-settings-consent-records`: consent records                   | #15 (open)                           |
| `parent-roster-athlete-contacts`: parents see athletes' contacts      | #16 (open)                           |
| `tickets-base` fix: uploads routes point at communities               | none (was only on `tickets-base`)    |
| `blocking-everywhere`, `roster-plain-profiles`, `child-photo`         | #21, #22, #23 (closed, never merged) |
| `qr-code-cam-and-card-editing`: camera QR scan, card editor fields    | #14 (closed, never merged)           |

Not in it, on purpose: `ti-101-better-auth` (#20, draft; contradicts "Stack decisions" until that
page and CLAUDE.md change), `coach-invite` (overlaps main's TI-148 work; needs a rebase by its
author), `local/modest-ptolemy-d1zbba` (unreviewed redesign), `local/ecstatic-curie-5m9oai`
(CLAUDE.md moderation exemption the PRD doesn't support).

## Decisions made while merging

- **Migrations.** main's `0002_events_log_subject` stays `0002`. The stack's `0002_communities` and
  `0003_media_uploads` became `0003_communities` and `0004_media_uploads`, with snapshots chained
  after main's. `drizzle-kit generate` reports no drift. Anyone who ran the stack's old numbering
  locally should reset their dev database.
- **Seed.** The fixture seed (`src/db/seed/index.ts` + `fixtures.ts`) is the default; the old Faker
  seed lives in `bulk.ts` (`db:seed:bulk`) with main's typed `log()` events ported into it.
- **server.ts.** One database connection, shared by events-log retention and the upload routes.
- **ContactLinks** (`apps/athlete/src/components/contact.tsx`) now takes `ownerId` and logs
  `contact.viewed`, which main's inline links used to do.
- **`alumni` user type** is `alumni_athlete` after the stack's rename (seed map, one test).
- **`media.test.ts`** gets a 30s `beforeAll`, the same as `events-log.test.ts`: two more migrations
  made PGlite's boot occasionally pass the 10s default under a full parallel `pnpm test`.

## Verified (in a cloud container, 27 Oct)

- `pnpm typecheck`, `pnpm lint`, `pnpm test`: green (API 431 tests). One portal test
  (`recruiter/Athlete.test.tsx`, "logs a contact view…") flaked once under load; this branch doesn't
  touch the portal, so it is a pre-existing flake on main.
- Postgres 16: main's migrations + main's seed, then this branch's migrations: data converts (team
  groups to communities, media purposes, event subjects kept). Both new migrations roll back and
  re-apply. Fresh DB: migrate, `db:seed`, `db:seed:bulk` all work.
- Real API + S3 stand-in: upload refused without a session (401), refused for a non-parent (403),
  complete before the file lands (409), then 201/200/204; child photo visible to parent and
  teammates, 404 to non-members.
- Athlete app on web (mock API): parent contacts + `contact.viewed`, child photo screen, edit
  profile, block from a post (feed, profile, Safety), coach team and QR, card editor, scan screen.

## Not verified yet (do these locally)

- **Native app.** An Android emulator without hardware acceleration only got as far as: the app
  loads in Expo Go (SDK 57, Android 13), the Team tab renders and a contact tap reaches `/events`.
  Everything else hit "app isn't responding" dialogs from the slow emulator. Run the checklist below
  on a real emulator, simulator or phone.
- **Camera QR scan** on a real phone.
- **Real sign-in**: still the dev header / mock sign-in.

## Run it

```bash
corepack enable && pnpm install
pnpm dev:mock                          # mock API :3000, portal :5173, Expo
# Android emulator: adb reverse tcp:3000 tcp:3000, then press `a` in the Expo terminal
# iOS Simulator: press `i`
# Phone (same Wi-Fi): EXPO_PUBLIC_API_URL=http://<computer-ip>:3000 pnpm --filter @team-impact/athlete dev
```

Real database: `docker compose up -d`, `cp .env.example .env`,
`pnpm --filter @team-impact/api db:migrate`, `pnpm --filter @team-impact/api db:seed`, `pnpm dev`.

## Native checklist (Welcome, then Mock sign-in)

| Sign in as           | Do                                                          | Expect                                                 |
| -------------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| Lisa Gomez (parent)  | Team tab, Athletes; tap an email                            | contacts shown; API log shows `POST /events` 204       |
| Lisa Gomez           | Child tab: Add photo, tick "I have the right", Choose photo | `/uploads` then `/complete`; photo on Mateo            |
| Lisa Gomez           | Me, edit profile                                            | name saves                                             |
| Jordan Lee (athlete) | Home: flag on Noah's post, Block Noah                       | Noah's posts gone; his profile "No such profile"       |
| Jordan Lee           | Me, Safety                                                  | Noah listed with Unblock                               |
| Jordan Lee           | Card, edit                                                  | names, season, photo                                   |
| Dana Rivera (coach)  | Team, QR code                                               | code shown                                             |
| Leo Grant (newcomer) | Scan a team QR code, Allow camera                           | camera preview; on a phone, scanning Dana's code joins |

## Next steps

1. Run the native checklist; fix anything that breaks on this branch.
2. Open one PR from `integration/ticket-stack` into `main`; once merged, close #8, #15, #16, #18,
   #19 and note on #14 and #21–#23 that they landed here.
3. Update the Notion board: TI-109's "Camera scan" box was ticked before camera code merged; TI-142
   still lists it as pending.
