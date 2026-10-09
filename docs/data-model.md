# Data model

The schema TI-14 implements: the TI-4 v2 model (PRD v2, see the TI-4 v2 validation doc) plus PRD
v2.1 team onboarding (TI-148/TI-149). **30 tables.** Source of truth is
`apps/api/src/db/schema/`; this page explains it. If you change the schema, update the diagrams here.

## How the count gets to 30

| Step                                                                                                 | Tables |
| ---------------------------------------------------------------------------------------------------- | ------ |
| Original TI-4 model                                                                                  | 23     |
| + `device_tokens`, `shortlist_notes` (first TI-4 pass)                                               | 25     |
| + `children`, `join_codes`, `join_requests`, `blocks`, `org_domains`, `contact_visibility` (TI-4 v2) | 31     |
| − `seats`, `contact_requests` (gone in PRD v2)                                                       | 29     |
| + `coach_invites` (PRD v2.1); `schools` renamed `colleges`                                           | **30** |

Identity-search auditing is an `events_log` event (`search.identity_filter`), not its own table.

## Rules the schema enforces

- **No health data, no minor flag.** No column stores a condition, diagnosis, injury or `is_minor`.
  Minor status is derived from `users.dob`. `schema-rules.test.ts` fails on any such column name.
- **Children never log in and have no birthdate.** They are rows in `children` (age only, checked
  0–12), owned by a parent user, never rows in `users`.
- **Consent is history, not a boolean.** `consent_records` is append-only; a flag's current value is
  its newest row.
- **Seasons.** `memberships.season` and `cards.season` let roster dedupe (TI-36) resolve one athlete
  across years. Cards are versioned (`season`, `version`).
- **Moderation first.** `posts`, `comments` and `events` default to `status = pending`.
- **Every foreign key has an index**; the users soft-delete (`deleted_at`) has a partial index for the
  30-day erasure job. Both are checked by `schema-rules.test.ts`.
- **Deletion.** Setting `users.deleted_at` hides an account at once; a scheduled job hard-deletes it
  with cascade after 30 days (TI-79). Foreign keys cascade for things a person owns and `set null`
  for records that outlive them (who invited, who decided, shortlist entries → "profile withdrawn").

Rules that live in the access layer, not the schema: child and teen profiles never appear in search,
recruiter views, card exports or the network feed; teens never see athletes' contacts;
`open_to_recruiting` requires a published card; only official affinity groups with a member's
`searchable` opt-in can be a recruiter filter, behind the feature flag.

## Identity, teams and groups

```mermaid
erDiagram
    COLLEGES ||--o{ TEAMS : "has"
    COLLEGES ||--o{ USERS : "attended by"
    TEAMS ||--o| GROUPS : "backs"
    TEAMS ||--o{ COACH_INVITES : "invites coaches"
    TEAMS ||--o{ JOIN_CODES : "QR codes"
    TEAMS ||--o{ JOIN_REQUESTS : "receives"
    TEAMS ||--o{ CHILDREN : "includes"
    USERS ||--o{ CHILDREN : "parents"
    USERS ||--o{ MEMBERSHIPS : "holds"
    GROUPS ||--o{ MEMBERSHIPS : "contains"
    JOIN_CODES ||--o{ MEMBERSHIPS : "resulted in"
    USERS ||--o{ JOIN_REQUESTS : "submits"
    USERS ||--o{ CONSENT_RECORDS : "writes"
    USERS ||--o{ CONTACT_VISIBILITY : "sets"
    USERS ||--o{ DEVICE_TOKENS : "registers"
    USERS ||--o{ BLOCKS : "blocks / is blocked"

    USERS {
        uuid id PK
        enum user_type "athlete, alumni, recruiter, staff, coach, parent, teen"
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
        smallint age "0-12, no birthdate"
        text bio
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
        enum status "live, archived"
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
    GROUPS {
        uuid id PK
        enum kind "team, college, affinity, org, platform"
        uuid team_id FK
        bool official "staff-set, affinity only"
        uuid created_by FK
    }
    MEMBERSHIPS {
        uuid id PK
        uuid user_id FK
        uuid group_id FK
        enum role "member, coach, admin"
        text season "e.g. 2025-26"
        enum source
        bool searchable "affinity opt-in"
        uuid join_code_id FK
        uuid added_by FK "coach who added a coach"
    }
    JOIN_CODES {
        uuid id PK
        uuid team_id FK
        text code UK
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
        jsonb payload "everything else, incl. experience"
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
        enum kind "photo, resume"
        text storage_key UK
        enum parse_status "nothing shown until confirmed"
        jsonb parsed_payload
    }
```

## Community and safety

```mermaid
erDiagram
    GROUPS ||--o{ POSTS : "holds"
    USERS ||--o{ POSTS : "writes"
    POSTS ||--o{ COMMENTS : "has"
    POSTS ||--o{ REACTIONS : "has"
    GROUPS ||--o{ EVENTS : "hosts"
    EVENTS ||--o{ RSVPS : "collects"
    USERS ||--o{ REPORTS : "files"
    MODERATION_ACTIONS ||--o{ MODERATION_ACTIONS : "appeal / outcome"
    USERS ||--o{ EVENTS_LOG : "emits"

    POSTS {
        uuid id PK
        uuid author_id FK
        uuid group_id FK
        enum type "text, photo, announcement"
        jsonb payload
        enum visibility "group, network"
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
        uuid group_id FK
        uuid host_id FK
        timestamptz starts_at
        enum status "pending until moderated"
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
        bool is_default "one per org"
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

- `schools` → `colleges` everywhere (`users.college_id`, `groups.college_id`,
  `ingested_records.college_id`, group kind `college`), per PRD v2.1.
- `users` gains `first_name`, `last_name` (signup collects them) and `open_to_recruiting`.
- `groups` gains `org_id` (for `kind = org`) and `created_by` (user-created affinity groups).
- `events` gains `status`, since events go through moderation too.
- `join_codes` gains `code`, the value the QR encodes.
- `cards` gains `ingested_record_id`, and `athlete_id` is nullable, so an alumni card can exist
  before it is claimed.
- `ingested_records.claim_proof` is `claim_token_hash`: the hash of the single-use claim token.
- Enum values TI-4 left open (group visibility, membership role/source, org tier, reaction kinds,
  report severity) are first guesses; change them in `schema/enums.ts`.
