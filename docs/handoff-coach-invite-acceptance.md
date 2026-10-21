# Handoff: coach invite acceptance

Written 21 Oct 2026 for branch `coach-invite` (commits `97f3c86` and `06daa2f`, on top of `main`).
Ticket: "Coach invite acceptance". An invited coach opens a single-use, 7-day link tied to their
email, signs up or signs in, and lands on their team as a verified coach. Bad links fail clearly.
Everything here runs on the mock API (`pnpm dev:mock`); no database-backed routes yet.

## What already existed before this branch

The accept flow itself was already built:

- staff and coaches create invites;
- `/invite/[token]` shows the invite;
- a new coach creates an account with the invite's email, or an existing coach signs in;
- accepting puts them on the team, and the team's first coach makes the team live;
- dead links answer 404 or 410 with a reason.

This branch closes the acceptance criteria that weren't met:

| Acceptance criterion                                                                | Before                                                         | After                                                        |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| Single-use link, valid 7 days, tied to the address; only a hash of the token stored | Raw token stored; no email, so a new invite couldn't be opened | Hash only; the link goes out through a mock outbox           |
| Records who added whom (feeds C4)                                                   | Lost once the invite was accepted                              | `addedBy` on every team member, and `coach.added` in the log |
| Accepting, expiry and revocation in events_log                                      | Nothing logged                                                 | All three logged, plus `coach.invited` and `coach.added`     |

## The changes

### 1. Only a hash of the invite token is stored

The invite link is the key: whoever holds the token can claim a coach account on that team.

- `MockCoachInvite.token` became `tokenHash`, holding SHA-256 of the token. This matches the
  database column `coach_invites.token_hash`.
- `createCoachInvite` makes the raw token, stores its hash, and hands the raw token back once, for
  the email.
- `usableInvite` hashes the token from the link and looks the invite up by that hash.
- **Why SHA-256 and not argon2:** the token is 24 random bytes, so it can't be guessed and a fast
  hash is safe. SHA-256 is also deterministic, which is what makes lookup by hash possible.
  argon2, which the project uses for passwords, salts every hash differently, so it can't be
  searched by.

#### How the hash is used

A hash is made when the invite is created, and made again every time the link is opened. Storing
only the hash works because the same token always produces the same hash.

When staff or a coach sends an invite (`createCoachInvite`):

```
1. random token        FpL8z_CkwrPu0WakiDd_Ivmak-vl_gPl            ← newToken(), 24 random bytes
2. hash it             sha256(token) → 3f9a1c…e7b2 (64 hex chars)   ← hashInviteToken(token)
3. store the invite    { email, teamId, tokenHash: "3f9a1c…e7b2", expiresAt, … }   ← no token
4. email the link      teamimpact://invite/FpL8z_CkwrPu0WakiDd_Ivmak-vl_gPl          ← the only copy
```

After step 4 the server forgets the token; only the email and its link have it. The invite record
is saved in `world.coachInvites`, an array in the mock API's memory. In the real backend it goes in
the `coach_invites` table, column `token_hash`.

When the invited coach opens the link (`usableInvite`):

```
1. take the token from the link      FpL8z_CkwrPu0WakiDd_Ivmak-vl_gPl
2. hash it the same way              sha256(token) → 3f9a1c…e7b2
3. find the invite with that hash    world.coachInvites.find((i) => i.tokenHash === "3f9a1c…e7b2")
4. check its state                   not revoked, not used, not expired → show it / accept it
```

The server never needs the original token back: it recomputes the hash from the link and compares
that with what it stored.

**Why this is safer.** A hash is one-way: computing token → hash is easy, but nobody can turn a
hash back into its token.

| Someone gets hold of…                       | Can they open the invite?                                                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| The link (from the email)                   | Yes. That's the point: the link is the key.                                                                                          |
| The stored data, which has only `tokenHash` | No. A link needs the token. Using the hash as the token gives `sha256(hash)`, which matches nothing; a test checks this returns 404. |

Without hashing, a leaked copy of the stored invites, say from a database backup, would let anyone
accept every pending invite. With hashing it reveals nothing usable.

#### How a link is told apart: invalid, revoked, used, expired

The hash only answers one question: is there an invite record for this link? Everything after that
comes from the record's own fields, because each invite carries its state with it:

```ts
{
  tokenHash:  "3f9a1c…e7b2",
  expiresAt:  "2026-10-28T19:25:07Z",   // set at creation: now + 7 days
  revokedAt:  null,                     // set when staff or a coach revoke it
  acceptedAt: null,                     // set when the coach accepts it
  …
}
```

`usableInvite` (`apps/api/src/mock/team.ts`) checks them in this order and stops at the first
problem:

```ts
const invite = world.coachInvites.find((i) => i.tokenHash === hashInviteToken(token));
if (!invite)            → 404 "No such invite"                                        // invalid
if (invite.revokedAt)   → 410 "This invite was withdrawn"                             // revoked
if (invite.acceptedAt)  → 410 "This invite has already been used"                     // single-use
if (expiresAt <= now)   → 410 "This invite has expired. Ask Team Impact to resend it" // expired
otherwise               → the invite: show it, or let them accept
```

| Case         | How it's known                                                                                          | Status |
| ------------ | ------------------------------------------------------------------------------------------------------- | ------ |
| Invalid      | No record matches the hash: a typo, a made-up link, or a link cut short                                 | 404    |
| Revoked      | The record has `revokedAt` set                                                                          | 410    |
| Already used | The record has `acceptedAt` set                                                                         | 410    |
| Expired      | `expiresAt` is in the past. Nothing marks it; the date is compared with the current time on each check. | 410    |

- **404 vs 410.** 404 means "nothing here". 410 ("Gone") means "this existed but can't be used any
  more". The app shows the server's message either way.
- **Invalid can't be narrowed down further, on purpose.** The server can't tell a typo from a
  guessed link, and it shouldn't hint at which tokens are "close".
- **The order matters when more than one applies.** A revoked invite that has also passed its date
  says "withdrawn", not "expired". That's the more useful reason: asking for the invite to be
  resent won't help if someone deliberately withdrew it.
- **Expiry needs no job or timer.** The invite simply stops passing the date check. That's also why
  the events log records expiry on the first failed open, not at the moment it expired.

### 2. The outbox: a mock stand-in for sending email

**What it is:** an array in the mock API's memory (`world.outbox`). Each item is one email the API
"sent": `to`, `subject`, `body`, `link`, `sentAt`. It's never delivered anywhere, and restarting
the API empties it.

**Why we need it:**

- **The token has nowhere else to go.** After change 1, the raw token exists only for a moment
  inside `createCoachInvite`. Without somewhere to send it, a newly created invite could never be
  opened.
- **Real email needs a provider, and none has been chosen.** Spam filters, SPF/DKIM/DMARC domain
  records, bounce handling and hosting limits on outgoing mail are why apps send through a provider
  such as Postmark, Resend, SendGrid, Mailgun or SES. That choice belongs in the Notion Stack
  decisions.
- **It tests the flow without emailing anyone.** The fixture addresses are fake, and tests can
  read what was "sent".
- **Swapping it later touches one file.** Every email goes through `sendEmail`. Once a provider is
  chosen, only that function changes; callers like `createCoachInvite` stay the same.

**Where to read it:**

- `GET /dev/outbox` returns the messages as JSON, newest first. Add `?to=<email>` for one address.
- The API terminal also prints each email as `✉ to …` with its link. Test runs don't print.
- `/dev/*` routes exist only on the mock (`MOCK_API=1`). The real API must never have them,
  because they hand out live invite links.

### 3. Who added whom

- **Contract:** `TeamMember.addedBy` is a `UserSummary`, or `null` for QR joins, approved requests,
  and once the adder deletes their account.
- **Mock:** each membership stores `addedById`; on accept, `acceptCoachInvite` passes the
  inviter's id. One helper, `memberView`, turns a membership into a `TeamMember`, and both the
  roster and the staff coaches list use it.
- **App:** the roster's coach rows read "Coach · invited by Maya Chen" plus the date.
- **Account deletion:** if the adder deletes their account, the coach stays on the team and
  `addedById` becomes `null`. This matches the database's `on delete set null`.

### 4. The events log

`world.eventLog` mirrors the `events_log` table: `userId`, `event`, `properties`, `occurredAt`.
Entries are written by `logEvent` (`event-log.ts`). Properties name records by id; the token and
its hash never go in the log.

| Event                   | When                                                | `userId`                     |
| ----------------------- | --------------------------------------------------- | ---------------------------- |
| `coach.invited`         | an invite is created (by staff or a coach)          | the sender                   |
| `coach.invite_accepted` | the invite is accepted                              | the new coach                |
| `coach.added`           | the same moment (the seed's event name)             | the inviter (who added whom) |
| `coach.invite_revoked`  | the first revoke; revoking again logs nothing       | whoever revoked it           |
| `coach.invite_expired`  | the first time an expired link is opened; once only | `null` (nobody did it)       |

Expiry is logged on first use because nothing runs at the moment an invite expires.

Both revoke routes, staff and coach, now share one helper, `revokeCoachInvite`. That also fixed a
gap: a coach could previously "revoke" an invite that had already been accepted. Now both routes
answer **409** "Already accepted. Remove the coach instead." The staff route used to answer 400.

Account deletion removes that user's own log rows, matching the table's `on delete cascade`. Rows
by other people that mention them stay.

## How the mock stores it

### The invite record

Each invite is one object in `world.coachInvites` (`MockCoachInvite` in `apps/api/src/mock/team.ts`):

```ts
{
  id:          '…5000',                      // the invite's own id (revoke URLs, the log)
  teamId:      '…0201',                      // which team it's for
  email:       'test@tufts.edu',             // the only address that may accept it
  tokenHash:   '3f9a1c…e7b2',                // sha256 of the link's token, never the token itself
  invitedById: '…0102',                      // who sent it (staff or a coach): becomes addedBy
  expiresAt:   '2026-10-28T19:25:07.783Z',   // createdAt + 7 days
  acceptedAt:  null,                         // set when accepted: single-use
  revokedAt:   null,                         // set when revoked
  createdAt:   '2026-10-21T19:25:07.783Z',
}
```

| Field                                  | Used for                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `tokenHash`                            | finding the invite when a link is opened                                                    |
| `revokedAt`, `acceptedAt`, `expiresAt` | deciding whether the link still works (withdrawn, used, expired)                            |
| `email`                                | "tied to their email": accepting needs a session, or a new account, with this address       |
| `invitedById`                          | who added whom: copied onto the coach's membership as `addedById` on accept                 |
| `teamId`                               | which team the coach joins                                                                  |
| `id`                                   | referring to the invite without its token, in `/coach-invites/:id/revoke` and in event rows |

The database's `coach_invites` table has the same columns in snake_case (`token_hash`,
`invited_by`, `expires_at`, …).

### The invite record decides; the events log only records

|                       | Invite record (`world.coachInvites`)                | Events log (`world.eventLog`)                        |
| --------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Purpose               | the current state of each invite                    | a history of what happened, and who did it           |
| Holds                 | `tokenHash`, `expiresAt`, `revokedAt`, `acceptedAt` | rows like `coach.invited`, `coach.invite_revoked`, … |
| Used to check a link? | **Yes.** `usableInvite` reads these fields.         | **No**                                               |
| Changes               | fields are updated, e.g. `revokedAt` is set         | rows are only ever added                             |

When a link is opened, the server hashes the token, finds the record, and reads `revokedAt`, then
`acceptedAt`, then `expiresAt`. The log is never consulted: deleting it entirely wouldn't change
how any link behaves. It exists for the ticket's audit requirement, answering "who revoked this
invite, and when?" or "who added this coach?".

The one place the log is read is a logging detail, not a check: when an expired link is opened,
`usableInvite` looks for an existing `coach.invite_expired` row so it writes that row only once.

### Everything lives in the API process's memory

When the API starts, `apps/api/src/app.ts` creates one `MockWorld` (`new MockWorld(flags)`). That
object holds every store as a plain array, and every route works on that same object:

```ts
readonly coachInvites: MockCoachInvite[] = initialCoachInvites(); // starts with the 3 fixture invites
readonly eventLog: MockLogEntry[] = [];                            // starts empty
readonly outbox: MockEmail[] = [];                                 // starts empty
```

| Situation                         | What happens to invites, the log and the outbox                                  |
| --------------------------------- | -------------------------------------------------------------------------------- |
| The API keeps running             | everything you do stays                                                          |
| You restart `pnpm dev:mock`       | all reset: the 3 fixture invites come back, and the log and outbox are empty     |
| You save a file in `apps/api/src` | also a reset, because `tsx watch` restarts the server on file changes            |
| Tests                             | each test builds its own `new MockWorld(...)`, so tests never share or leak data |

Nothing is written to disk, so no mock data can end up in git. The same goes for all the mock data:
users, teams, cards, posts. The real backend replaces these arrays with the Postgres tables already
defined in `apps/api/src/db/schema` (`coach_invites`, `events_log`, …), so data survives restarts.

## Files

| File                                      | Change                                                                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/mock/team.ts`               | `tokenHash`, `hashInviteToken`, `inviteLink`, the email in `createCoachInvite`, `memberView`, `revokeCoachInvite`, and logging in create, accept and expiry |
| `apps/api/src/mock/outbox.ts` (new)       | `MockEmail`, `sendEmail`                                                                                                                                    |
| `apps/api/src/mock/event-log.ts` (new)    | `MockLogEntry`, `logEvent`                                                                                                                                  |
| `apps/api/src/mock/routes/dev.ts` (new)   | `GET /dev/outbox`, `GET /dev/events`                                                                                                                        |
| `apps/api/src/mock/routes/index.ts`       | registers the dev routes                                                                                                                                    |
| `apps/api/src/mock/routes/team.ts`        | the coach revoke route uses `revokeCoachInvite`                                                                                                             |
| `apps/api/src/mock/routes/staff-admin.ts` | the staff revoke route uses `revokeCoachInvite`; the staff coaches list uses `memberView`                                                                   |
| `apps/api/src/mock/world.ts`              | `outbox` and `eventLog` stores                                                                                                                              |
| `apps/api/src/mock/fixtures.ts`           | `addedById` on memberships (the soccer coach was added by staff)                                                                                            |
| `apps/api/src/mock/safety.ts`             | account deletion clears `addedById` and removes the user's own log rows                                                                                     |
| `packages/contracts/src/teams.ts`         | `TeamMember.addedBy`                                                                                                                                        |
| `apps/athlete/src/components/team.tsx`    | `joinedLine` shows "invited by …"                                                                                                                           |
| `apps/api/src/mock/team.test.ts`          | tests: hash only; outbox link opens the invite; who added whom; roster `addedBy`; event order; revoke once and 409; expiry logged once                      |
| `packages/contracts/src/team.test.ts`     | a hand-built roster parent gets `addedBy: null`                                                                                                             |

## How to check it by running the app

### Setup

```bash
pnpm install
pnpm dev:mock        # the API on :3000 with MOCK_API=1 (turbo also starts the apps' dev servers)
```

- **Athlete app:** `http://localhost:8081` on web, or Expo Go on a phone. Turbo already starts it;
  otherwise run `cd apps/athlete && npx expo start`.
- **Staff portal:** `http://localhost:5173`.
- **Testing on a phone:** follow "On a physical phone" in `apps/athlete/README.md`
  (`apps/athlete/.env.local` and `CORS_ORIGINS` in the root `.env`). Then open web at
  `http://<mac-ip>:8081`, not `localhost`. Otherwise every request says "Sign in first".
- **Mock data lives in memory:** restart `pnpm dev:mock` to reset invites, the outbox and the log.

### 1. A coach invites another coach, and the link arrives in the outbox

1. In the athlete app: **Mock sign-in → Coach** (Dana Rivera, soccer). Then go to the **Team** tab
   → **Add a coach**, and invite `test@tufts.edu`.
2. The API terminal prints:
   ```
   ✉ to test@tufts.edu: You're invited to coach Women's Soccer on Team IMPACT
     teamimpact://invite/<token>
   ```
3. Open `http://localhost:3000/dev/outbox`. The same email should be there as JSON.

### 2. The invitee accepts

1. Sign out, then open `http://localhost:8081/invite/<token>`. That's the token from step 1, with
   the same path as the email's link.
2. You should see the soccer team, "invited by Dana Rivera", and the address `test@tufts.edu`.
   Create the account.
3. You should land on the team as a coach. The **Team** tab's Coaches list shows the new coach as
   "Coach · invited by Dana Rivera" plus the date. Dana's own row reads "invited by Maya Chen",
   the staff member.
4. Open the same link again. You should get "This invite has already been used".

### 3. Revoke

1. As Dana, invite another address, then revoke it on **Add a coach**.
2. Opening that link shows "This invite was withdrawn".
3. The screens only offer Revoke on pending invites, so the 409 for an accepted invite ("Already
   accepted. Remove the coach instead.") is checked by the tests, not by hand.

### 4. Expired and unknown links

| Open                                            | Expected                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `/invite/invite-tufts-soccer-expired-assistant` | "This invite has expired. Ask Team Impact to resend it"                             |
| `/invite/invite-tufts-soccer-revoked-assistant` | "This invite was withdrawn"                                                         |
| `/invite/not-a-real-invite-token-123`           | "No such invite"                                                                    |
| `/invite/invite-tufts-lacrosse-first-coach`     | A live invite from staff for the lacrosse team's first coach (pat.nguyen@tufts.edu) |

### 5. The events log

Open `http://localhost:3000/dev/events` after the steps above. You should see, newest first:

- `coach.invite_expired`: **one** row, with `userId: null`, even if you opened the expired link
  several times;
- `coach.invite_revoked`;
- `coach.added`, by Dana, with `coachId` = the new coach;
- `coach.invite_accepted`, by the new coach;
- `coach.invited`, for each invite.

None of the rows should contain a token.

### 6. Staff in the portal

In the portal (`http://localhost:5173`), sign in as staff (Maya Chen). Open Teams → a team →
Coaches. Staff can invite and revoke there too; those invites show up in `/dev/outbox`, and their
revokes in `/dev/events`.

### Automated checks

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm format:check
```

The invite tests are in `apps/api/src/mock/team.test.ts` and `signup.test.ts`.

## Left out on purpose

| Item                              | Why                                                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Real email sending                | Needs an email provider (a Stack decision), DNS records for the domain, and an API key in the platform's secret store. Only `sendEmail` changes. |
| Database-backed invite routes     | Mock only. The database already has `coach_invites.token_hash`, `memberships.added_by` and `events_log`.                                         |
| Login screen                      | The auth ticket. Existing coaches sign in with the dev Mock sign-in for now.                                                                     |
| Recording "verified"              | Accepting implies the coach owns the email, but nothing records it. The backend should set `users.email_verified_at` on accept.                  |
| A friendlier bad-link screen      | The app shows the API's message in the generic "Couldn't load this" box. A problem card, like on `/scan`, would be clearer.                      |
| `coach.removed` in the events log | Not in the acceptance criteria. The accepted invite and `coach.added` keep the history.                                                          |
