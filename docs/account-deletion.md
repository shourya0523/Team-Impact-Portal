# Account deletion (TI-79, PRD §9 P3)

Apple rejects apps without in-app deletion. In the app: Me › Safety › Delete account (asks twice).

## What happens

| When                     | What                                                                                                                                                                                                                                                                                                   | Where                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| At once (`DELETE /me`)   | `users.deleted_at` is set. Every session and push token is deleted, so the person is signed out on every device and gets no more pushes. Interest and medical communities they created pass to their longest-standing member. Sign-in answers as if there were no account.                             | `src/account-deletion.ts` `deleteAccount`                                |
| After 30 days            | A daily job erases the `users` row. Foreign keys cascade to everything they owned: card, media rows, posts (with the comments and reactions on them), comments, reactions, RSVPs, a parent's children's profiles, consent records, memberships, blocks, notifications, events-log rows, auth accounts. | `eraseDeletedAccounts`, run by `scheduleAccountErasure` from `server.ts` |
| Within 7 days after that | The erased rows leave the database backups.                                                                                                                                                                                                                                                            | DigitalOcean, see below                                                  |

Refused in the app: staff accounts (Team Impact closes those), and a live team's only coach, who
must have another coach added first (PRD §3). Suspended or deleted coaches don't count.

Deleting twice changes nothing; the 30 days count from the first time.

## What outlives the person

Foreign keys `set null` on records that belong to someone else: who invited or decided, who added
someone to a team, a recruiter's lists and notes (they belong to the company, and are shared
company-wide), events they hosted.

An erased athlete's entries on recruiters' lists become "profile withdrawn" (`status = withdrawn`,
`athlete_id` null), and the notes recruiters wrote about them are erased: they are about the person.

## Files

Media rows go with the cascade, but the files themselves live in object storage. The erase job
collects their storage keys (photos, resumes, children's photos) and passes them to `deleteFiles`
after the database commit; `server.ts` wires it to the uploads bucket (TI-111). Children's photos
are media rows too (owned by the parent, linked by `child_id`). Without a bucket (tests), the job
logs a warning whenever erased accounts left files.

## Backups

DigitalOcean Managed PostgreSQL takes a daily backup kept for 7 days, and point-in-time recovery
reaches back 7 days. Nothing is kept longer, so an erased account is gone from every backup at most
7 days after the erase, or 37 days after the person pressed Delete. Check the retention on the plan
we buy before launch, and keep any manual `pg_dump` exports inside the same window.

## Rules for routes still to come

The real API's read routes don't exist yet. Each one must treat `users.deleted_at is not null` as
"no such person", and hide a child whose parent is deleted, so the account disappears at once and
not only when it is erased. `isActiveUser` in `src/events-log.ts` is the existing check.
