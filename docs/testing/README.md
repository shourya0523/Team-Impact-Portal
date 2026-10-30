# Testing guides

How the repo is tested, and a guide per ticket. Each guide maps the ticket's acceptance criteria to
the automated tests that prove them and a manual checklist for what tests can't reach (devices,
visuals, people outside the team).

## Test layers

| Layer                        | Where                                          | Runs with                                                                  |
| ---------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| Policy and contract rules    | `packages/contracts/src/*.test.ts`             | `pnpm --filter @team-impact/contracts test`                                |
| API on the mock world        | `apps/api/src/mock/*.test.ts` (`app.inject`)   | `pnpm --filter @team-impact/api test`                                      |
| API on a real schema         | `apps/api/src/*.test.ts`, `db/seed/*.test.ts`  | PGlite locally; Postgres in CI (see [TI-89](TI-89.md))                     |
| Resume reader                | `apps/api/src/resume/*.test.ts`                | `pnpm --filter @team-impact/api test src/resume` (see [TI-113](TI-113.md)) |
| Design tokens and card model | `packages/ui-tokens`, `packages/ui-primitives` | `pnpm --filter <package> test`                                             |
| Portal screens               | `apps/portal/src/**/*.test.tsx` (jsdom)        | `pnpm --filter @team-impact/portal test`                                   |
| Athlete app                  | bundle smoke: `expo export --platform web`     | `pnpm --filter @team-impact/athlete test`; screens are checked by hand     |

Before pushing: `pnpm typecheck && pnpm lint && pnpm test` (CLAUDE.md). CI runs the same on every
PR, filtered to the packages a change touches.

For manual checks, run `pnpm dev:mock` and use dev sign-in. Personas: **Jordan Lee** (athlete),
**Lisa Gomez** (parent of Mateo, 9), **Noah Kim** (teen), **Dana Rivera** (coach), plus a recruiter
and staff on the portal.

## Shourya's tickets

| Ticket        | Title                                            | Status              | Guide                                                   |
| ------------- | ------------------------------------------------ | ------------------- | ------------------------------------------------------- |
| TI-113        | Resume extraction and review                     | Built here          | [TI-113.md](TI-113.md)                                  |
| TI-114        | Card render front and back, PNG export           | Built here          | [TI-114.md](TI-114.md)                                  |
| TI-107        | Terms, privacy policy and acceptable use         | Drafted here        | [TI-107.md](TI-107.md)                                  |
| TI-89         | Test harness and smoke suite in CI               | Built here          | [TI-89.md](TI-89.md)                                    |
| TI-121        | Recruiter search, flagged identity filter, audit | Done                | [below](#ti-121-recruiter-search)                       |
| TI-105        | Portal shell on mocked endpoints                 | Done                | [below](#ti-105-portal-shell)                           |
| TI-1          | Monorepo, CI and staging                         | Done (staging open) | [below](#ti-1-monorepo-ci-and-staging)                  |
| TI-71–74      | Product map, design language, wireframes, hi-fi  | Done                | [below](#ti-7174-design)                                |
| TI-10         | App store accounts (Apple, Google)               | Blocked             | [below](#ti-10-app-store-accounts)                      |
| TI-8          | LinkedIn API                                     | Blocked             | [below](#ti-8-linkedin-api)                             |
| TI-13, TI-153 | Client asks, legal chases, open problems         | Open                | [below](#ti-13-and-ti-153-client-and-counsel-questions) |

---

## TI-121 Recruiter search

**Automated**

- API (`apps/api/src/mock/mock.test.ts`, `tracking.test.ts`): only published, open-to-recruiting
  athletes are returned; the community filter is refused with the flag off and for team, medical
  and private communities; only members who opted in match; every identity search is logged
  (staff log and `search.identity_filter` event).
- Policy (`packages/contracts/src/policy.test.ts`): `recruiterVisible`.
- Portal (`apps/portal/src/pages/recruiter/Search.test.tsx`): the filter offers official interest
  communities only, disappears with the flag off, and filters in the URL reach the request.

**Manual** (portal as the recruiter)

1. Each filter (region, city, sport, major, grad year, division, experience) narrows the grid; Clear
   resets the URL and the form.
2. With `FLAG_IDENTITY_SEARCH=false` restart the API: the official-community filter is gone, and a
   pasted `?communityId=` URL returns an error, not results.
3. Run one identity-filtered search, then open the staff portal → Communities: the search is in the
   identity-search log with recruiter, company and time.
4. As Jordan, unpublish the card or turn off open to recruiting: Jordan disappears from search, the
   card URL and the recruiter's lists at once.
5. The grid stays usable at 1280 px with the filter rail visible.

Known gap: search stops at 100 results (no paging yet).

## TI-105 Portal shell

**Automated**: `App.test.tsx` (routing and role guards), `api/client.test.ts`, `ui/ui.test.tsx` (no
hex or raw px in `ui.css`), staff page tests.

**Manual**

1. Signed out, every portal URL lands on sign-in and returns to it after signing in.
2. A recruiter never sees staff links and is sent home from `/staff/*`; staff likewise for recruiter
   pages.
3. Every page loads on the mock API with no console errors; loading and error states show text.
4. Keyboard only: every control is reachable; the sheet closes with Esc. (Known: the focus ring is
   hard to see on the navy sidebar.)

## TI-1 Monorepo, CI and staging

**Automated**: CI itself (`.github/workflows/ci.yml`): format check, typecheck, lint, test, build,
filtered to changed packages on PRs.

**Manual**

1. Fresh clone: `corepack enable && pnpm install && pnpm dev:mock` starts API, portal and Expo.
2. A PR with a deliberate type error fails CI; main is protected (green build plus one review).
3. CI finishes in under 5 minutes on a typical PR.
4. Still open on the ticket: staging deploy from main (App Platform) and the EAS Update channel.
   When they land: merge to main, check staging `/health` reports the new `APP_VERSION`.

## TI-71–74 Design

These are design deliverables; test them as a design review.

1. Every PRD §10 P0 story has a screen in the hi-fi mockups (`apps/mockups`, `#/app`, `#/portal`,
   `#/staff`), and every screen maps back to a story.
2. The built screens match the mockups' layout and copy; differences are listed on TI-74.
3. Every text/background pair used is in `packages/ui-tokens` `textPairs`/`uiPairs` (the contrast
   test covers them). Known open item: the hi-fi canvas's red `#D0213C` and pressed navy `#152E5C`
   differ from the tokens.
4. Reduce Motion on (iOS Settings → Accessibility → Motion; macOS for web): no stamp, tilt or
   shine anywhere; movement becomes fades.
5. Touch targets are at least 44 pt; Dynamic Type at the largest size doesn't clip text.

## TI-10 App store accounts

Not code. Done when, and checked by:

1. Team Impact's D-U-N-S number is confirmed with Apple, and Apple Developer organisation enrolment
   is approved under Team Impact (a Team Impact staff member is Account Holder).
2. The bundle ID is registered (it can't change later) and matches `apps/athlete/app.json`.
3. An EAS build installs through TestFlight on a team member's phone.
4. Google Play organisation account exists, with a closed testing track and the first build on it.
5. App privacy labels are filled from the privacy policy draft ([TI-107](TI-107.md)); reporting and
   blocking (Apple guideline 1.2) are demonstrable in the build.

## TI-8 LinkedIn API

Not code. Since PRD v2, Team Impact finds alumni on LinkedIn itself, so first confirm with the client
whether the API is still needed. If it is: the application is submitted, the approved scopes are
recorded on the ticket, and nothing is built until access is granted. If not: close the ticket.

## TI-13 and TI-153 Client and counsel questions

Not code. Done when each question has a yes, a no or a decision date, recorded on the ticket:

1. The five counsel questions in PRD §11 (identity search, teens without a verified parent link,
   child-tagged posts leaving the team, direct family–athlete contact, open medical communities).
   The cover note in `docs/legal/counsel-cover-note.md` lists each with pilot behaviour and fallback.
2. D-U-N-S and Apple account holder (TI-10), who moderates after handoff, the Tufts pilot roster,
   a vector logo, and moving production to Team Impact's accounts with a cost model (TI-5).
3. For every "no", the fallback in PRD §11 is ticketed (draft TI-147) before week 7 store builds.
