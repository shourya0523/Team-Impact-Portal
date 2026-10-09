# @team-impact/contracts

Zod 4 schemas for every API request and response, following PRD v2.1 (Notion). The API validates
with them; the Expo app and the portal import their types. Change a schema and every package that
relies on the old shape stops compiling, so breaking changes surface in CI the same day instead of
in production.

| File               | What                                                               |
| ------------------ | ------------------------------------------------------------------ |
| `common.ts`        | Ids, timestamps, colours, audiences, pagination, `ApiError`        |
| `roles.ts`         | Roles, sign-up roles, age bands                                    |
| `auth.ts`          | Login, sign-up, coach invite acceptance, recruiter sign-up         |
| `users.ts`         | `UserSummary`, `Me`, notification prefs, child and alumni profiles |
| `colleges.ts`      | The managed college list                                           |
| `teams.ts`         | Teams, coach invites, members                                      |
| `join-requests.ts` | Team join requests (athlete, parent, teen)                         |
| `qr-codes.ts`      | Team join QR codes                                                 |
| `cards.ts`         | Baseball Card fields, audience views, resume ingest                |
| `contacts.ts`      | Contact details and who they're shared with                        |
| `posts.ts`         | Posts, announcements, sponsor opportunities, comments              |
| `events.ts`        | Events and RSVPs                                                   |
| `groups.ts`        | Affinity groups and recruiter-search opt-in                        |
| `companies.ts`     | Partner companies, email domains, recruiters                       |
| `lists.ts`         | Recruiter lists and notes                                          |
| `moderation.ts`    | Moderation status and reports                                      |

## Conventions

- Each schema and its type share a name: `export const Team = z.object(...)` and
  `export type Team = z.infer<typeof Team>`. Requests are `CreateXRequest`, `UpdateXRequest` and so on.
- Types describe what's on the wire: timestamps are ISO strings, not `Date`. Query schemas coerce
  strings, so their exported type is `z.input` (what a client sends).
- Request schemas carry the rules (lengths, formats, cross-field checks) and the user-facing messages.
  Response schemas mostly just describe shape.
- **Response schemas are allow-lists.** The API parses every response through its route's schema
  (`apps/api/src/zod.ts`), so fields a schema doesn't list never leave the server. Privacy rules are
  separate schemas per audience, not optional fields: teens get `CardFace`, which has no contact
  details; staff get `TeamQrCodeHistoryEntry`, which has no token.
- Rules that need the database or the viewer's role (a teen posting outside their team, a recruiter
  opening a card that isn't open to recruiting) belong in the API. Doc comments on the schemas say
  where those apply.
- Adding an optional request field or a response field is safe. Renaming, removing or narrowing
  anything is breaking, so let the type errors guide the fix in each app.

Clients get types only (`import type`), so Zod isn't bundled into the apps.
