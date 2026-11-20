# Tanvi Agarwal: Parent (Pair C, partner Shourya Yadav)

Parent smoke test for the user-type smoke tests plan. Persona: **Lisa Gomez**, parent of Mateo (9),
on Tufts Women's Soccer, plus **Rosa Diaz** (new parent) for the join flow. Run with
`pnpm dev:mock` on `main` at `d7925b4`, using the athlete app on web at phone size (375 x 812).
Each check was also run against the API directly as each user type, so the rules are tested on the
server and not only in the app.

## Summary

- 10 flows tested. Joining, the Child tab, who can see Mateo, family contacts, blocking and
  account deletion all work.
- Hard rules: 4 hold, 2 are broken (B1 health text in the child bio, B2 medical community names its
  creator).
- 9 bugs filed. B5, B6, B7 and B8 are fixed in #37, #38 and #39.
- 3 pitches: a family space for adding children, keeping child profiles health-free and up to
  date, and family RSVP.

## Coverage

| Flow                                       | Result                                                                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Join a team (Rosa: college, team, request) | Works. Children are added in the request, a 13-year-old is refused ("sign up themselves as teammates"), the coach approves, Rosa is notified |
| Child tab (Mateo's card, edit, preview)    | Works. Health text is accepted in the bio (B1), age never changes (B3), no photo (B5, fixed)                                                 |
| What Mateo's profile shows, and to whom    | First name, age, interests, team, "Profile run by Lisa Gomez". See the hard-rule table                                                       |
| Team tab: athletes' family contacts        | Works. Only channels shared with families; an athlete with nothing shared says so; teens, athletes and coaches get 403                       |
| Feed and communities                       | Works. Parents read and comment but don't post (PRD F5, by design)                                                                           |
| Events and RSVP                            | RSVP works, but the mock events are all in October and the app calls one "Next up, today" (B9)                                               |
| Add a second child                         | No screen for it. A second join request to your own team works by accident (B4)                                                              |
| Leave the team                             | Not possible as a parent (B6, fixed)                                                                                                         |
| Block (Jordan blocks Lisa)                 | Works. Mateo disappears from Jordan's roster and profile view; Lisa stops seeing Jordan's contacts                                           |
| Delete account                             | Works (204). The children's profiles go with the parent                                                                                      |

## Hard-rule checks

| Rule                                                                           | Verdict                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A child never logs in                                                          | **Holds.** There is no child role (`ROLES` in `contracts/src/roles.ts`), so neither dev sign-in nor sign-up can create one. The `children` table has no email or password. Sign-up refuses under-13s ("Kids under 13 join through a parent or guardian")           |
| A child's profile is visible only to their team and family                     | **Holds.** `GET /profiles/<Mateo>`: 200 for Lisa, the coach, Jordan and Noah (all on the team). 404 for the recruiter, staff, Priya, Chris and the newcomers Rosa, Leo and Eli. A parent can't edit another family's child (404); a coach can't edit a child (403) |
| A child never appears in search, recruiter views, exports or other communities | **Holds.** Recruiter search has no Mateo or Lisa. Off the team, the team community and roster are 404, and no member list names a child. Parents can't publish or export a card, or turn on recruiting (403)                                                       |
| No health data is collected                                                    | **Broken (B1).** The child bio accepts "Has epilepsy, takes medication at 3pm" and shows it to the whole team                                                                                                                                                      |
| Medical community membership is never shown                                    | **Holds on Lisa's profile** (it only lists her team, to every viewer). **Broken through the community itself (B2):** non-members see that Lisa runs Heart warriors families                                                                                        |
| Teens never see athletes' contacts                                             | **Holds.** Noah gets 403 on `athlete-contacts`; teen profiles don't name a parent                                                                                                                                                                                  |

Open question: staff see children's first names on a team's roster (`GET /teams/:id/members`) but get
a 404 on the child's profile. Either is defensible, but they should agree.

## Bugs

### B1 (P1, rule breach): Health details in a child's bio go straight to the team

- **Steps:** Sign in as Lisa. Child tab, Edit, type "Has epilepsy, takes medication at 3pm" in
  Interests, Save. Sign in as Dana (coach) and open Mateo's profile.
- **Expected:** No health or diagnosis data is collected (PRD §6). At the least, it shouldn't show
  without review.
- **Actual:** Saved and shown at once to the coach, every athlete and the teen on the team. Only a
  grey hint under the box asks parents not to.
- **Where:** `PATCH /children/:id` (`apps/api/src/mock/routes/profiles.ts`), `ChildBio` in contracts.
  Same kind of problem as Aditya's B2 (card text).
- **Screenshots:** `05-child-edit-health-bio.png`, `06-child-health-bio-saved.png`
- **Status:** Open. Pitch 2 covers the fix.

### B2 (P0, rule breach): A medical community names its creator to non-members

- **Steps:** Sign in as Priya (not a member). Open Heart warriors families
  (`/me/communities/<id 303>`), or call `GET /communities/<id 303>`.
- **Expected:** Medical community membership is never shown (PRD §5).
- **Actual:** The page says "Lisa approves new members", and the API returns
  `createdBy: Lisa Gomez` and `memberCount: 2`. A parent who starts a support group for families like
  hers is outed to the whole network. This is Aditya's B1 (#36), confirmed from the parent side.
- **Screenshot:** `07-medical-community-as-non-member.png`
- **Status:** Open. Already reported by Aditya in #36, so it should be fixed once, there or in a follow-up.

### B3 (P2): A child's age is a fixed number and never goes up

- **Steps:** Join as Rosa with a child born 2017-05-02. Open the Child tab and Edit.
- **Expected:** The age follows the birthday, and a child who turns 13 moves to a teen account
  (PRD §2).
- **Actual:** The API keeps `age: 9` and drops the birth date (`NewChild` in `signup.ts`). The edit
  form has a plain Age box. Mateo stays 9 until his parent changes it, and nothing happens at 13.
- **Screenshot:** `11-child-age-is-a-number.png`
- **Status:** Open. Pitch 2 covers the fix.

### B4 (P2): No way to add a child after joining; a second join request does it by accident

- **Steps:** As Lisa (already on the team), `POST /join-requests` for the same team with a new child.
- **Expected:** An "Add a child" option in the app. A current member re-requesting their own team is
  refused.
- **Actual:** 201. The coach sees a new request, and approving it adds the child to Lisa's family.
  There is no button for this in the app.
- **Screenshot:** None, since there is no screen for it (API only).
- **Status:** Open. Pitch 1 covers the fix. Refusing the duplicate request should land with it,
  since today it is the only way to add a child.

### B5 (P2): No child photo

- **Steps:** Sign in as Lisa and open the Child tab.
- **Expected:** The parent can add a photo (PRD F3).
- **Actual:** Only an initial, and no way to add a photo.
- **Screenshot:** `02-child-tab.png`
- **Status:** **Fixed in #37.** "Add photo" on the Child tab, through the upload flow from #8
  (`fixed-b5-child-photo.png`).

### B6 (P2): A parent can't leave the team

- **Steps:** Sign in as Lisa, open the Team tab and look for a way to leave. Or call
  `DELETE /teams/:id/members/<Lisa>` as Lisa.
- **Expected:** A parent whose child has moved on can leave.
- **Actual:** No Leave button. The API says 403 "Only this team's coaches can do that". The family
  has to ask the coach or delete their account.
- **Screenshot:** `09-team-no-leave.png`
- **Status:** **Fixed in #38.** "Leave team" on the Team tab, with a confirm screen that says which
  children leave too (`fixed-b6-leave-team.png`).

### B7 (P3): The notification bell always shows a red dot

- **Steps:** Sign in as Lisa (0 unread notifications) and look at the bell on Home.
- **Expected:** A dot only when something is unread.
- **Actual:** Always a red dot (`home/index.tsx` passed `dot` unconditionally). Affects every user.
- **Screenshot:** `01-home-feed.png`
- **Status:** **Fixed in #39** (`fixed-b7-no-dot.png`).

### B8 (P3): "See as the team does" jumps to the Me tab; the tab label is cut off

- **Steps:** Sign in as Lisa, open the Child tab, tap "See as the team does".
- **Expected:** The preview opens within the Child tab, and the tab reads "Child".
- **Actual:** The tab bar switches to Me (the preview lived at `/me/profile/[id]`). On its own screen
  the Child tab's label reads "Child pro...".
- **Screenshots:** `02-child-tab.png`, `10-preview-under-me-tab.png`
- **Status:** **Fixed in #39** (`fixed-b8-preview-stays-on-child.png`).

### B9 (P3): Mock events are in the past, and the app calls one "today"

- **Steps:** Sign in as Lisa and open the Events tab.
- **Expected:** Upcoming events to RSVP to, and past events not shown as upcoming.
- **Actual:** The mock events are on 17, 19 and 22 Oct. On 20 Nov the tab says "This week" and
  shows the 17 Oct game as "Next up, today", with Going and Can't make it buttons.
- **Screenshot:** `08-events-all-past.png`
- **Status:** Open. Fixture dates should be relative to today, and the screen should check the event
  hasn't already started.

## Research: comparable products

| Product      | What parents use it for                                        | Child privacy                                                                                             | One thing to learn                                                      |
| ------------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| TeamSnap     | Schedule, availability per child, RSVP from the reminder email | Under-13s exist only as data a parent or admin enters; members can hide fields but admins always see them | One-tap RSVP (Going, Maybe, No, plus a note) straight from the reminder |
| GameChanger  | Live streams, scores, schedule                                 | Users 13 and over; player media treated as generally public; parents asked for approval of followers      | Family roles: guardian vs. secondary family with no logistics           |
| SportsEngine | Registration, schedule, RSVPs, team chat                       | Account holders 13 and over; children are sub-profiles in the parent's Household                          | Household: one parent holds the child profiles and invites a co-parent  |

Common parent complaints: too many apps per activity, notifications that flood or never arrive, and
ads or paywalls on family features. Our team-and-family-only child profile, enforced on the server
rather than left to settings, is a real difference worth saying out loud.

Sources: [TeamSnap availability](https://helpme.teamsnap.com/article/94-set-game-and-event-availability),
[TeamSnap RSVP from email](https://helpme.teamsnap.com/article/95-set-availability-from-automatic-reminder-emails),
[TeamSnap privacy](https://www.teamsnap.com/privacy-policy),
[TeamSnap roster privacy](https://helpme.teamsnap.com/article/109-make-roster-information-private),
[TeamSnap family contacts](https://helpme.teamsnap.com/article/108-add-family-or-contacts-to-a-profile),
[GameChanger privacy](https://gc.com/privacy),
[GameChanger roles](https://help.gc.com/hc/en-us/articles/42602635189901-Team-Roles),
[SportsEngine guardians](https://intercom.help/SportsEngine/en/articles/6304039-how-to-add-guardians),
[SportsEngine accounts](https://intercom.help/SportsEngine/en/articles/6304287-how-to-create-an-account),
[TeamSnap reviews (G2)](https://www.g2.com/products/TeamSnap/reviews),
[Scary Mommy on activity apps](https://www.scarymommy.com/parenting/why-are-there-apps-for-every-single-kid-activity-now).

## Pitches

### Pitch 1: A family space to add more children and a co-parent

- **Problem:** A parent can add children only inside their first join request. Once they're on the
  team there is no way to add another child: no button, and the only route that works is a second
  join request to their own team, by accident (B4). A family whose younger sibling joins later, or
  who forgot a child at sign-up, is stuck. Only one adult per family can be on the team, so two-parent
  and guardian households can't share the profile either. SportsEngine and TeamSnap both solve this
  with a household.
- **Change:** On the Child tab, "Add a child" (first name, last initial, birth month and year) sends
  a request the coach approves, like joining. "Invite a co-parent" emails a link; the co-parent signs
  up as a parent and joins the same family once the coach approves. Join requests from current
  members are refused.
- **Impact:** Affects any family with more than one child or more than one carer. High for the pilot.
- **Effort:** About 3 days. Backend (add-child request, family link), athlete app (Child tab).
- **Rules check:** Children still never log in. Every new child and adult is approved by the coach.
  A child's profile stays visible only to their team and family.
- **Story refs:** F3 (child profile), F4 (parent on the team).

### Pitch 2: Keep children's profiles health-free and up to date

- **Problem:** Health details typed into the bio show to the team at once (B1). A child's age never
  changes (B3), so a child who turns 13 keeps a child profile instead of moving to a teen account.
- **Change:** (a) Screen the bio the way posts are screened: anything that looks like health or
  diagnosis text is held, and the parent sees "Please leave out health details". (b) Store birth
  month and year instead of a fixed age, so the age updates itself. A month before 13, the parent
  gets "Mateo can join as a teammate" with a link that creates his teen account, linked to the
  parent.
- **Impact:** (a) closes a hard-rule gap and should land before the pilot. (b) is needed within a
  season.
- **Effort:** (a) about 1 day, backend, reusing the moderation screen. (b) 2 to 3 days, backend and
  app, together with Shourya's teen sign-up.
- **Rules check:** Month and year is not health data, and is less than the full birth date we
  already ask for. The child stays out of search and recruiting. Teen rules apply from 13.
- **Story refs:** F3 (child profile), T1 (teen sign-up with a parent's agreement).

### Pitch 3: Family RSVP with a headcount and "maybe"

- **Problem:** RSVP is one answer per account. A parent can't say "2 adults and Mateo", and families
  of children with serious illness often can't commit until the day. TeamSnap's best-liked parent
  feature is one-tap availability from the reminder.
- **Change:** RSVP with Going, Maybe or Can't, a headcount (adults and children) and an optional
  note. The reminder notification has the three buttons. Coaches see totals per event.
- **Impact:** Helps every family and coach plan game days and family nights. Used every week.
- **Effort:** About 2 days. Backend (RSVP fields), athlete app (event screen, notification actions).
- **Rules check:** The note is free text, so it goes through moderation. No health data is asked
  for. Children are counted, not named.
- **Story refs:** The events and RSVP story in PRD §10 (its ID isn't in the repo).

## Review

Reviewed by Shourya: pending.
