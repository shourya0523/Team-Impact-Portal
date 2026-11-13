# Moderation and what goes to OpenAI

How new community content is moderated before anyone but its author sees it (PRD §9). The code is
`apps/api/src/moderation.ts`; the routes call it through `screenNew` in
`apps/api/src/mock/activity.ts`.

## Who is screened

- **Team Impact staff:** their posts, comments, events and communities publish at once and are
  never sent to OpenAI. Outside Team Impact's own community their content can still be reported,
  and blocked by readers.
- **Everyone else:** every new post, comment, event and community is screened by OpenAI's
  moderation endpoint (`omni-moderation-latest`) before it is stored.

## What the screen decides

A category is _flagged_ when OpenAI flags it, or when its score is at or over `MODERATION_HOLD_AT`.

| Result                                                    | Outcome                                                 |
| --------------------------------------------------------- | ------------------------------------------------------- |
| Nothing flagged                                           | Published at once                                       |
| Flagged, every flagged score under `MODERATION_BLOCK_AT`  | Held for staff (`in_review`, an open moderation ticket) |
| A flagged score at or over `MODERATION_BLOCK_AT`          | Blocked: never published; a resolved ticket for staff   |
| `sexual/minors` flagged, whatever its score               | Blocked                                                 |
| OpenAI errors, times out (5 s), or answers without scores | Held for staff                                          |
| No `OPENAI_API_KEY` set                                   | Held for staff (everything waits, as before screening)  |

Defaults: `MODERATION_HOLD_AT=0.3`, `MODERATION_BLOCK_AT=0.85` (scores run 0 to 1). Both are
validated at startup (`apps/api/src/env.ts`): each must be between 0 and 1, and the hold threshold
can't be above the block one. A blocked author sees a 422 saying it went against the community
guidelines; staff see the blocked item on the moderation page and can warn or suspend its author.

## What is sent to OpenAI

Only what is being screened, with no account id, name, email, role, community or other identifier:

| Item      | Sent                                                                     |
| --------- | ------------------------------------------------------------------------ |
| Post      | Its text, and its photo's URL when it has one (OpenAI fetches the image) |
| Comment   | Its text                                                                 |
| Event     | Its title, details and location, joined into one text                    |
| Community | Its name and description, joined into one text                           |

Nothing is sent for staff content. The request goes to `https://api.openai.com/v1/moderations`
with the API key from the platform secret store (`OPENAI_API_KEY`). Photo URLs must be publicly
reachable for OpenAI to fetch them; one it can't fetch makes the call fail, so the post is held.
Check OpenAI's current API data-retention terms before launch, since posts can come from teens.
