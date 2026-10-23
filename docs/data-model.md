# Data model

The schema TI-14 implements: the TI-4 v2 model (PRD v2, see the TI-4 v2 validation doc) plus PRD
v2.1 team onboarding (TI-148/TI-149) and PRD v2.3 communities (migration `0002_communities`).
**32 tables.** Source of truth is
`apps/api/src/db/schema/`; this page explains it. If you change the schema, update the diagrams here.

## How the count gets to 32

| Step                                                                                                 | Tables |
| ---------------------------------------------------------------------------------------------------- | ------ |
| Original TI-4 model                                                                                  | 23     |
| + `device_tokens`, `shortlist_notes` (first TI-4 pass)                                               | 25     |
| + `children`, `join_codes`, `join_requests`, `blocks`, `org_domains`, `contact_visibility` (TI-4 v2) | 31     |
| − `seats`, `contact_requests` (gone in PRD v2)                                                       | 29     |
| + `coach_invites` (PRD v2.1); `schools` renamed `colleges`                                           | 30     |
| + `community_join_requests`, `notifications` (PRD v2.3); `groups` renamed `communities`              | **32** |

Identity-search auditing is an `events_log` event (`search.identity_filter`), not its own table.

## Rules the schema enforces

- **No health data, no minor flag.** No column stores a condition, diagnosis, injury or `is_minor`.
  Minor status is derived from `users.dob`.
- **Children never log in and have no birthdate.** They are rows in `children` (age only), owned
  by a parent user, never rows in `users`.
- **Consent is history, not a boolean.** `consent_records` is append-only; a flag's current value is
  its newest row.
- **Seasons.** `memberships.season` and `cards.season` let roster dedupe (TI-36) resolve one athlete
  across years. Cards are versioned (`season`, `version`).
- **Moderation first.** `posts`, `comments`, `events` and `communities` default to
  `status = pending`.
- **Community shape.** Check constraints: a `team` community has a `team_id` and no other kind
  does; only `interest` and `medical` can be `private`; only an open `interest` community can be
  `official`. Interest and medical names are unique per kind, ignoring case.
- **Every foreign key has an index**; the users soft-delete (`deleted_at`) has a partial index for the
  30-day erasure job.
- **Deletion.** Setting `users.deleted_at` hides an account at once; a scheduled job hard-deletes it
  with cascade after 30 days (TI-79). Foreign keys cascade for things a person owns and `set null`
  for records that outlive them (who invited, who decided, shortlist entries → "profile withdrawn").

Rules that live in the access layer, not the schema: child and teen profiles never appear in search,
recruiter views, card exports or any community outside their team; teens never see athletes'
contacts; `open_to_recruiting` requires a published card; only official interest communities with
a member's `recruiter_search_opt_in` can be a recruiter filter, behind the feature flag; medical
membership is never shown or searchable; teens and recruiters never join medical communities and
recruiters join none.

## Identity, teams and communities

```mermaid
erDiagram
    COLLEGES ||--o{ TEAMS : "has"
    COLLEGES ||--o{ USERS : "attended by"
    TEAMS ||--o| COMMUNITIES : "backs"
    TEAMS ||--o{ COACH_INVITES : "invites coaches"
    TEAMS ||--o{ JOIN_CODES : "QR codes"
    TEAMS ||--o{ JOIN_REQUESTS : "receives"
    TEAMS ||--o{ CHILDREN : "includes"
    USERS ||--o{ CHILDREN : "parents"
    USERS ||--o{ MEMBERSHIPS : "holds"
    COMMUNITIES ||--o{ MEMBERSHIPS : "contains"
    COMMUNITIES ||--o{ COMMUNITY_JOIN_REQUESTS : "private: creator decides"
    JOIN_CODES ||--o{ MEMBERSHIPS : "resulted in"
    USERS ||--o{ JOIN_REQUESTS : "submits"
    USERS ||--o{ CONSENT_RECORDS : "writes"
    USERS ||--o{ CONTACT_VISIBILITY : "sets"
    USERS ||--o{ DEVICE_TOKENS : "registers"
    USERS ||--o{ BLOCKS : "blocks / is blocked"

    USERS {
        uuid id PK
        enum user_type "athlete, alumni_athlete, alumni_mentor, recruiter, staff, coach, parent, teen"
        text email UK
        date dob "minor status derived from this"
        enum status "active, suspended"
        bool open_to_recruiting
        enum channel_preference
        timestamptz deleted_at "hidden; erased after 30 days"
        uuid college_id FK
        uuid org_id FK "verified recruiting org"
        text current_employer "alumni"
        text phone
        text linkedin_url
    }
    CONSENT_RECORDS {
        uuid id PK
        uuid user_id FK
        text flag
        bool value
        text terms_version
        timestamptz created_at "append-only"
    }
    CHILDREN {
        uuid id PK
        uuid parent_user_id FK
        uuid team_id FK
        text first_name
        smallint age "no birthdate"
        text bio
        uuid photo_media_id FK "current photo"
    }
    CONTACT_VISIBILITY {
        uuid user_id FK
        enum scope "family, recruiter"
        enum channel "phone, email, linkedin"
        bool visible
    }
    COLLEGES {
        uuid id PK
        text name UK "managed list"
        text region
    }
    TEAMS {
        uuid id PK
        uuid college_id FK
        text sport
        enum gender "unique with college + sport"
        text division
        text display_name
        text color "optional hex"
        text about
        enum status "invited, live, archived"
    }
    COACH_INVITES {
        uuid id PK
        uuid team_id FK
        text email
        text token_hash UK
        uuid invited_by FK
        timestamptz expires_at
        timestamptz accepted_at
        timestamptz revoked_at
    }
    COMMUNITIES {
        uuid id PK
        enum kind "team, team_impact, medical, interest"
        text name
        text about
        uuid team_id FK "team kind only"
        bool private "interest or medical, set at creation"
        bool official "staff-set, open interest only"
        enum status "pending until moderated"
        uuid created_by FK
    }
    COMMUNITY_JOIN_REQUESTS {
        uuid id PK
        uuid user_id FK
        uuid community_id FK
        enum status "pending, approved, declined"
        uuid decided_by FK "the creator"
    }
    MEMBERSHIPS {
        uuid id PK
        uuid user_id FK
        uuid community_id FK
        enum role "member, coach, admin"
        text season "e.g. 2025-26"
        enum source
        bool recruiter_search_opt_in "official interest only"
        uuid join_code_id FK
        uuid added_by FK "coach who added a coach"
    }
    JOIN_CODES {
        uuid id PK
        uuid team_id FK
        text code UK "the QR token"
        text short_code UK "read out by the coach"
        text label
        enum lifetime "tonight, day, week"
        timestamptz expires_at "default 1 week"
        timestamptz revoked_at
    }
    JOIN_REQUESTS {
        uuid id PK
        uuid user_id FK
        uuid team_id FK
        enum status "pending, approved, declined"
        uuid decided_by FK
    }
```

## Cards, media and alumni

```mermaid
erDiagram
    USERS ||--o{ CARDS : "owns versions"
    INGESTED_RECORDS ||--o{ CARDS : "pre-built for"
    INGESTED_RECORDS }o--o| USERS : "claimed by"
    COLLEGES ||--o{ INGESTED_RECORDS : "rosters"
    USERS ||--o{ MEDIA : "uploads"
    CHILDREN ||--o{ MEDIA : "photos of"

    CARDS {
        uuid id PK
        uuid athlete_id FK "null while unclaimed"
        uuid ingested_record_id FK
        text season
        int version
        enum status "draft, published, unclaimed, archived"
        smallint completeness "0-100"
        text sport "indexed filter"
        int grad_year "indexed filter"
        text major "indexed filter"
        text region "indexed filter"
        text city "indexed filter"
        text division "indexed filter"
        jsonb payload "everything else, incl. experience: up to 3 role/organization/period entries"
    }
    INGESTED_RECORDS {
        uuid id PK
        text source
        text source_ref
        text name
        uuid college_id FK
        enum status
        uuid claimed_by_user_id FK
        text claim_token_hash UK "single-use"
    }
    MEDIA {
        uuid id PK
        uuid owner_user_id FK
        enum purpose "card_photo, child_photo, post_image, resume"
        enum status "pending, ready, taken_down"
        uuid child_id FK "child photos only"
        text storage_key UK "private bucket, read via GET /media/:id"
        text mime_type
        int size_bytes
        timestamptz rights_affirmed_at "required on photos"
        timestamptz taken_down_at
        enum parse_status "nothing shown until confirmed"
        jsonb parsed_payload
    }
```

## Community and safety

```mermaid
erDiagram
    COMMUNITIES ||--o{ POSTS : "holds"
    USERS ||--o{ POSTS : "writes"
    POSTS ||--o{ COMMENTS : "has"
    POSTS ||--o{ REACTIONS : "has"
    COMMUNITIES ||--o{ EVENTS : "hosts"
    USERS ||--o{ NOTIFICATIONS : "receives"
    EVENTS ||--o{ RSVPS : "collects"
    USERS ||--o{ REPORTS : "files"
    MODERATION_ACTIONS ||--o{ MODERATION_ACTIONS : "appeal / outcome"
    USERS ||--o{ EVENTS_LOG : "emits"

    POSTS {
        uuid id PK
        uuid author_id FK
        uuid community_id FK
        enum type "text, photo, announcement"
        jsonb payload
        enum status "pending until moderated"
    }
    COMMENTS {
        uuid id PK
        uuid post_id FK
        uuid author_id FK
        enum status "pending until moderated"
    }
    EVENTS {
        uuid id PK
        uuid community_id FK
        uuid host_id FK
        text details
        timestamptz starts_at
        timestamptz ends_at
        enum status "pending until moderated"
    }
    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        enum kind "join_approved, reply, event, announcement, warning"
        uuid actor_id FK "null = Team Impact"
        text text
        enum target_kind "post, event, community"
        uuid target_id
        uuid community_id FK "hidden once unseeable"
        bool read
    }
    RSVPS {
        uuid event_id FK
        uuid user_id FK
        enum state
    }
    REPORTS {
        uuid id PK
        uuid reporter_id FK
        enum target_type
        uuid target_id
        enum severity
        enum state
    }
    MODERATION_ACTIONS {
        uuid id PK
        uuid actor_id FK "null = classifier"
        enum action
        uuid parent_action_id FK
        jsonb content_snapshot
    }
    EVENTS_LOG {
        uuid id PK
        uuid user_id FK
        text event "incl. team/coach changes, identity searches"
        jsonb properties
    }
```

## Employer side

```mermaid
erDiagram
    ORGS ||--o{ ORG_DOMAINS : "verified domains"
    ORGS ||--o{ USERS : "recruiters"
    ORGS ||--o{ SAVED_SEARCHES : "owns"
    ORGS ||--o{ SHORTLISTS : "shares"
    SHORTLISTS ||--o{ SHORTLIST_ENTRIES : "contains"
    SHORTLIST_ENTRIES ||--o{ SHORTLIST_NOTES : "has"
    USERS ||--o{ SHORTLIST_ENTRIES : "listed as"

    ORGS {
        uuid id PK
        text name
        enum tier "standard, premium"
        enum status "active, suspended"
    }
    ORG_DOMAINS {
        uuid org_id FK
        text domain UK
    }
    SAVED_SEARCHES {
        uuid org_id FK
        jsonb filter_json
        jsonb last_result_ids
    }
    SHORTLISTS {
        uuid id PK
        uuid org_id FK
        bool is_default "swipe target"
    }
    SHORTLIST_ENTRIES {
        uuid shortlist_id FK
        uuid athlete_id FK "null = profile withdrawn"
        enum status "active, withdrawn"
    }
    SHORTLIST_NOTES {
        uuid shortlist_entry_id FK
        uuid author_id FK
        text body
    }
```

## Decisions beyond the TI-4 doc

Small calls made while implementing, flagged for review:

- `schools` → `colleges` everywhere (`users.college_id`, `ingested_records.college_id`), per
  PRD v2.1.
- `users` gains `first_name`, `last_name` (signup collects them) and `open_to_recruiting`.
- `groups` became `communities` in `0002_communities` (PRD v2.3). Kinds map team → team,
  platform → team_impact, affinity → interest; college and org groups had no equivalent and were
  dropped. Network-wide posts (`posts.visibility = network`) now live in the Team Impact community.
  The down migration is lossy where the old model has no slot (see its header).
- Team Impact's community has no membership rows for ordinary users: everyone but recruiters is in
  it, so the access layer treats it as joined.
- `events` gains `status`, since events go through moderation too.
- `join_codes` gains `code`, the value the QR encodes.
- `cards` gains `ingested_record_id`, and `athlete_id` is nullable, so an alumni card can exist
  before it is claimed.
- `ingested_records.claim_proof` is `claim_token_hash`: the hash of the single-use claim token.
- Enum values TI-4 left open ( membership role/source, org tier, reaction kinds,
  report severity) are first guesses; change them in `schema/enums.ts`.

## Seeds

`pnpm --filter @team-impact/api db:seed` loads the mock API's fixtures (`src/db/seed/fixtures.ts`),
with the same ids, so Postgres and `MOCK_API=1` start from the same world. `db:seed:bulk` loads the
large Faker dataset (`src/db/seed/bulk.ts`) for performance work. Fixture fields with no column yet
(join request role and class year, list colour, note and sharing, recruiter title, post kind and
opportunity, which sit in `posts.payload`) are added as the real routes need them.
