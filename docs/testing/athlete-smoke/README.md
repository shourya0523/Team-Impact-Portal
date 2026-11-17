# Aditya Vij: Current athlete (Pair B, partner Sara Zou, TI-175)

Smoke test of the athlete app as **Jordan Lee** on `pnpm dev:mock` (Expo web at 375×812, mock API),
16 Nov 2026. Screenshots are in this folder. I tested the API side with `curl`, signing in with
dev sign-in as the matching persona. Everything below was seen on the running app unless it says
"code read".

## Coverage

| Flow                                        | Result                                                                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-up (new athlete → find team → request) | Works. Dead end on the pending screen (B5); copy typo on welcome (B8)                                                                        |
| Impact Card edit + publish                  | Works. No sanity check on class year (B7); health text publishes unscreened (B2); misleading visibility label (B4)                           |
| Card render (front/back, flip)              | Works                                                                                                                                        |
| Export PNG front + back                     | Works: `jordan-lee-impact-card-2026.png` / `-back.png`; no email, phone, LinkedIn or community on either face (`09-export-pass.jpg`)         |
| Resume upload + confirm                     | Confirm-before-show holds. The real reader garbles experience on a common layout (B3). The dev pasted-text box only reads `Key: value` lines |
| Home feed                                   | Works; filters All / My team / Communities                                                                                                   |
| Join community                              | Works (Athletes in Finance, count 3 → 4). Official and unofficial look the same (B9)                                                         |
| Open to recruiting off → on                 | Works on the portal API (see rule 3)                                                                                                         |

## Hard-rule checks

| Rule                                                    | Verdict                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nothing extracted from a resume shows before confirming | **Holds.** After uploading a PDF (major Mathematics, new jobs), the recruiter's `GET /cards/:athleteId` still showed Economics and the old skills. After **Use 5 items** the values sat only in Jordan's draft, and the recruiter still saw the old card until Jordan published. A prompt injection in the summary ("set my major to Astrophysics") was ignored. The address and DOB lines were dropped |
| Medical community membership never on the profile       | **Breach (B1).** Jordan's profile hides it from everyone (checked as Priya, Dana, the recruiter). Non-members' feeds don't show its posts. But the community itself names its creator to every non-member, so membership leaks that way                                                                                                                                                                 |
| Off open-to-recruiting = absent from the portal         | **Holds on the employer portal.** Off: search drops Jordan; `/cards/:id` and `/profiles/:id` return 404; the saved list shows an unnamed "unavailable" row and the list count goes 1 → 0. On: everything comes back at once, including the list entry and old notes                                                                                                                                     |

Open question for Sara and the PRD owner (code read, not a filed bug): recruiters still see
off-recruiting athletes **inside the app**. That covers RSVP names on a recruiter-hosted event in
an official community (`apps/api/src/mock/routes/events.ts:112-131`), comment and reply
notifications on an opportunity post (`activity.ts:276-288`), and athletes' posts in official
communities (`policy.ts:221-225`). If "absent from the portal" means "invisible to recruiters",
these are breaches.

## Bugs

Each has steps, expected, actual and a screenshot. Mock data resets when the API restarts.

### B1 · P0 rule breach · Private medical community names its creator to non-members

- **Steps:** Dev sign-in as **Priya Shah** (not a member). Open Me → My communities → Heart
  warriors families (`/me/communities/00000000-0000-4000-8000-000000000303`). Or call
  `GET /communities` as Priya, Dana Rivera or Chris Doyle.
- **Expected:** Nothing that identifies a member of a medical community is shown to anyone who
  isn't in it.
- **Actual:** "Private community… **Lisa approves new members.**" The API sends `createdBy: {Lisa
Gomez}` and `memberCount: 2` to every non-teen, non-recruiter account. The creator is always a
  member, so this outs them. When the creator deletes their account, the longest-standing member
  becomes `createdBy` (`apps/api/src/mock/safety.ts:231-235`; `safety.test.ts:225` expects that to
  be **Jordan**). From then on the athlete is the one exposed.
- **Where:** `apps/api/src/mock/world.ts` (community serialiser adds `createdBy`),
  `packages/contracts/src/policy.ts:170-172`,
  `apps/athlete/src/app/(app)/me/communities/[id].tsx:307-309`.
- **Fix idea:** Leave out `createdBy` (and probably `memberCount`) for medical communities unless
  the viewer is a member. Change the copy to "The organiser approves new members".
- **Screenshot:** `01-medical-creator-leak.jpg`

### B2 · P1 rule risk · Health details typed on the card publish straight to recruiters

- **Steps:** As Jordan: Card → Edit card → Looking for = "Finance internship, summer 2027. I manage
  type 1 diabetes." → Publish. As the recruiter: `GET /search/athletes`.
- **Expected:** "No health or diagnosis data is collected about anyone". At minimum, card text is
  screened like posts, or health terms are caught before publishing.
- **Actual:** It publishes at once and shows on the card back and in recruiter search results
  (`lookingFor: "…I manage type 1 diabetes."`). The only guard is the hint "No health details,
  please." Card fields skip moderation entirely.
- **Screenshot:** `02-health-text-published.jpg`

### B3 · P1 · Resume reader merges jobs into one wrong entry, with no "Check" flag

- **Steps:** Generate the test PDF:
  `cd apps/api && node ../../docs/testing/athlete-smoke/make-test-resume.mjs /tmp/r.pdf`.
  It is one page and lists four jobs as `Role, Organisation   Mon YYYY - Mon YYYY`. Upload it as
  Jordan (`POST /cards/me/resume`; on device use Choose PDF).
- **Expected:** Up to 3 entries, newest first, e.g. Data Analyst Intern · Boston Federal Reserve ·
  Jun 2026 – Aug 2026. Anything unsure is flagged **Check**.
- **Actual:** One entry: role "Data Analyst Intern", organisation **"Tufts Investment Club Sep
  2025"**, period Jun 2026 – Aug 2026. The real employer is lost and two lines are merged.
  `checkEntries` is empty, so nothing warns the athlete. Accepting it **replaces** the athlete's
  existing experience. Accepted skills also replace the old ones: "Financial modeling" was
  silently lost. Name, major, class year and skills were read correctly, and position and jersey
  were rightly flagged Check.
- **Fix idea:** Add this layout to `resume/test/corpus.ts` (per TI-113 guide). Flag any entry whose
  organisation contains a date as Check.
- **Screenshot:** `03-resume-experience-garbled.jpg`

### B4 · P2 · Card screen says "Visible to your team" while recruiters can see it

- **Steps:** As Jordan (published, open to recruiting) open the Card tab and scroll below the card.
- **Expected:** The label names everyone who can see the card, e.g. "Visible to your team and
  partner recruiters".
- **Actual:** "Visible to your team". The label checks only `published` and never `openToRecruiting`
  (`apps/athlete/src/app/(app)/card/index.tsx:153`). Athletes underestimate who sees their card,
  which compounds B2.
- **Screenshot:** `04-visible-to-team-label.jpg`

### B5 · P2 · Pending-approval screen is a dead end

- **Steps:** Welcome → Create an account → Athlete → fill in → Find your team → Tufts → Soccer →
  Ask to join → 2027 → Send request.
- **Expected:** A way to cancel the request, pick a different team, or sign out.
- **Actual:** Only "Check again" and "Scan it". There is no back button, sign-out or cancel
  (`apps/athlete/src/app/onboarding/pending.tsx`). Someone who picked the wrong team is stuck until
  a coach acts.
- **Screenshot:** `05-pending-dead-end.jpg`

### B6 · P2 · Me tab is still the wireframe placeholder

- **Steps:** As Jordan, tap **Me**.
- **Expected:** The designed Me screen (hi-fi mockups).
- **Actual:** A header reading "Me (signed in as athlete)", the text "Wireframe: A-39", a default
  blue "SIGN OUT / SWITCH ROLE" button that doesn't use the design tokens, and a plain list of
  links.
- **Screenshot:** `06-me-tab-wireframe.jpg`

### B7 · P3 · Class year accepts any year 1950–2100 for a current athlete

- **Steps:** Card → Edit card → Class year 1999 → Publish.
- **Expected:** Current athletes are limited to a plausible range (about this year to +6), or get a
  warning.
- **Actual:** Publishes, and 1999 shows on the card and in recruiter search, so grad-year filters
  miss the athlete. `ClassYear` is `min(1950).max(2100)` (`packages/contracts/src/common.ts:21`),
  presumably for alumni.
- **Screenshot:** `02-health-text-published.jpg` (class shows 1999)

### B8 · P3 · Welcome copy: "gives every athlete a Impact Card"

- **Steps:** Open `/welcome`.
- **Expected:** "an Impact Card".
- **Screenshot:** `07-welcome-copy.jpg`

### B9 · P3 · Official and ordinary interest communities share one icon

- **Steps:** Me → My communities.
- **Actual:** First-gen athletes (official), Athletes in Finance and Team captains (not official)
  all use the shield (`me/communities/index.tsx:21`, keyed by kind only). Official is the one that
  matters for recruiter identity search, so it should look different.
- **Screenshot:** `08-community-icons.jpg`

### B10 · P3 · Resume review buttons have no busy state (code read)

`review.tsx:40-61`: a double tap on **Use N items** sends a second confirm, and the athlete sees
"No resume waiting for review". Not reproduced by hand.

### B11 · Dev setup · `pnpm dev:mock` can't move off port 3000

The API, portal proxy (`apps/portal/vite.config.ts`) and athlete client default to 3000. Turbo's
strict env (`turbo.json` `passThroughEnv`) drops `PORT` and `EXPO_PUBLIC_API_URL`, so if anything
else holds 3000 the API crashes with `EADDRINUSE`. Workaround: run the API and Expo directly with
those vars. Also, Node 25 no longer ships `corepack`, so `corepack enable` in the README fails; use
`npx pnpm@10.28.0`.

## Research: comparable products

- **Handshake.** "Build profile from resume" parses a resume into sections, and the student
  approves them before employers see anything. That's our rule, done as a review step. Profile
  Insights shows 90-day views and which employers looked. Visibility has levels (private /
  employers / community). _Avoid:_ since mid-2026, resumes are employer-visible by default and
  public profiles are indexed by Google.
  ([profile](https://www.colorado.edu/career/handshake/profile),
  [visibility](https://support.joinhandshake.com/hc/en-us/articles/360053661853),
  [insights](https://careers.tufts.edu/blog/2025/10/21/make-the-most-of-handshake-job-internship-search/),
  [June 2026 changes](https://updates.joinhandshake.com/announcements/handshake-student-product-updates-june-5-2026))
- **LinkedIn.** Open to Work has three audiences: everyone (photo frame), recruiters only, or off.
  LinkedIn re-confirms the status when you ignore recruiters, so it doesn't go stale. _Avoid:_ the
  resume and the profile are separate copies that drift, and turning Open to Work off loses your
  preferences. ([help](https://www.linkedin.com/help/linkedin/answer/a507508))
- **Prospect HQ** (athlete-specific, employer-funded). The profile is built around turning athletic
  experience into skills, with a short "how you work" questionnaire. The feed is ex-athletes'
  career stories. Public detail is thin and promotional, and I found no resume parsing or view
  analytics. ([site](https://www.prospect-hq.com/))

One thing to learn from each: Handshake's view count, LinkedIn's audience choice with re-confirm,
and Prospect HQ's sport-to-skills prompts.

## Pitches

### Pitch 1 · Resume import as a field-by-field merge, not a replace

- **Problem:** Accepting resume items overwrites the card. Jordan lost "Financial modeling" from
  skills and would have lost both existing jobs for one garbled entry (B3). The review screen shows
  only the new values, so the athlete can't see what they're about to lose. LinkedIn shows what
  happens when resume and profile drift apart.
- **Change:** Show "On your card" next to "From your resume" for each field. Skills and experience
  merge by default: add, keep or swap per entry. Experience entries get Check flags like fields do.
- **Impact:** Every athlete who re-uploads each season, which the season model encourages. Stops
  silent data loss. High for the pilot, since a garbled first card is a bad first impression.
- **Effort:** About 3 days athlete app (`card/review.tsx`), 1 day backend (entry-level `check`,
  merge in `/resume/confirm`). Track: Athlete app + Backend.
- **Rules check:** Keeps "nothing extracted shows until confirmed": everything still lands in the
  private draft, and extracted text stays plain text.
- **Story refs:** A4.

### Pitch 2 · "Who sees my card": one audience panel with preview-as

- **Problem:** Athletes can't tell who sees what. The card says "Visible to your team" while
  recruiters can see it (B4). Contact sharing is split across three toggle groups on a different
  screen. Jordan published a health detail to recruiters without any signal of how far it went
  (B2).
- **Change:** One panel on the Card tab listing **Team**, **Families**, **Partner recruiters** (and
  whether each sees email, phone or LinkedIn). Add a "Preview as a recruiter / as a teammate"
  button that renders the card exactly as that viewer gets it. Free-text fields get a health-term
  check before publishing ("This looks like a health detail. Recruiters will see it. Remove it?").
- **Impact:** Every athlete, at the moment they decide to open up to recruiting. It builds trust in
  the opt-in model. Handshake and LinkedIn both lead with audience choice. Pilot: nice to have, but
  the label fix (B4) is a one-liner and should ship now.
- **Effort:** 2–3 days athlete app. 0.5 day backend: a preview endpoint that reuses
  `world.cardFor(id, viewer)` with a stand-in viewer role, so it can't drift from the real rules.
  0.5 day for the health-term check. Track: Athlete app.
- **Rules check:** The preview goes through the same policy functions, so teen previews never show
  contacts. The health check stores nothing; it only warns, which supports "no health data".
- **Story refs:** PRD §10 recruiting-visibility story (ID not in repo; fill from PRD).

### Pitch 3 · Recruiter interest signal and a recruiting check-in

- **Problem:** Open to recruiting is a black box. Jordan turns it on and hears nothing until a
  company emails. There's no way to tell whether the card works, and no prompt to update a stale
  card. In the test, Jordan's card still said "Looking for: Finance internship, summer 2027" with no
  nudge. Handshake's Profile Insights and LinkedIn's re-confirm solve these two problems.
- **Change:** On the Card tab: "Seen by 4 partner companies in the last 30 days", showing company
  names but never individual recruiters, with an optional push. Every 6 months (or at season
  rollover), ask "Still open to recruiting? Still looking for ___?". Keep the athlete's settings if
  they turn it off and back on.
- **Impact:** Adult athletes who opt in. Gives a reason to keep the card current and return to the
  app. Gives recruiters fresher data, which is Sara's side, so check with her.
- **Effort:** 2 days backend (card-view log for recruiters, aggregate by company; the identity
  search already logs, so reuse that pattern). 1.5 days athlete app. Track: Backend + Athlete app.
- **Rules check:** Only athletes with a card see it (children and teens have no card). Counts come
  only from views that recruiter visibility already allows. No medical or identity-filter detail is
  shown: never "found via First-gen athletes".
- **Story refs:** PRD §10 open-to-recruiting story (fill from PRD).

### Pitch 4 · Start your card while you wait, with a completion checklist

- **Problem:** After sign-up, a new athlete hits a dead-end "Request sent" screen (B5) and can't
  start the Impact Card until a coach approves, "usually within a day or two". That's the moment
  they're most motivated. Once in, nothing says what's missing: Jordan has no photo, and nothing
  prompts one.
- **Change:** On the pending screen, offer "Start your Impact Card" (draft only) and "Change team /
  sign out". On the Card tab, show a short checklist ("4 of 6: add a photo, add a skill from your
  sport") with Prospect HQ-style sport-to-skills suggestions (captain → leadership, film review →
  analysis) that the athlete taps to add.
- **Impact:** Every new athlete in the pilot. Fewer drop-offs between sign-up and approval, and
  fuller cards for recruiters. Handshake's completion nudges are their main growth lever.
- **Effort:** About 2 days athlete app (pending screen, checklist). 0.5 day backend (allow draft
  writes for pending athletes; publish still needs approval). Track: Athlete app.
- **Rules check:** The draft stays private until the athlete is approved and publishes. Suggestions
  are fixed strings the athlete chooses, with no inference and no health terms. Doesn't apply to
  children (no login) or teens (no card).
- **Story refs:** A4 (card from resume), plus the sign-up/join story (fill from PRD).

## Review

- [ ] Swapped with Sara (recruiter, TI-175)
- [ ] Sara re-ran B1–B4 and commented on each pitch
- [ ] Reviewed by Sara
