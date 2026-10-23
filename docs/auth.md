# Auth (TI-101)

Sign-in runs on [Better Auth](https://www.better-auth.com), an open-source library that runs inside
our Fastify API. There's no hosted provider: accounts, sessions and passwords live in our Postgres.
Our product rules are added through its hooks. Code: `apps/api/src/identity/`.

The mock API (`pnpm dev:mock`) is unchanged and keeps its dev sign-in. Real auth runs when the API
runs on the database.

## Endpoints

Better Auth serves everything under `/api/auth`. The ones the apps use:

| Call                                    | What it does                                                                                                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/sign-up/email`          | Create an account. Body: `email`, `password` (12+ characters), `name` (first name), `lastName`, `accountType`, `birthDate` (`YYYY-MM-DD`), `acceptTerms: true`, and for teens `parentAgreed: true` |
| `GET /api/auth/verify-email?token=…`    | The emailed link. Verifies, then redirects to the app or portal's `/verified` page                                                                                                                 |
| `POST /api/auth/sign-in/email`          | `email`, `password`. Sets the session cookie                                                                                                                                                       |
| `POST /api/auth/sign-out`               | Ends this session                                                                                                                                                                                  |
| `GET /api/auth/get-session`             | Who is signed in (null if nobody)                                                                                                                                                                  |
| `POST /api/auth/request-password-reset` | `email`, `redirectTo`. Always answers 200                                                                                                                                                          |
| `POST /api/auth/reset-password`         | `token`, `newPassword`. Signs out every device                                                                                                                                                     |
| `POST /api/auth/change-password`        | Signed in: `currentPassword`, `newPassword`                                                                                                                                                        |
| `POST /api/auth/revoke-sessions`        | Signed in: sign out on every device (`revoke-other-sessions` keeps this one)                                                                                                                       |

Errors come back as `{ code, message }`. The codes the apps should handle:

- `SIGNUP_REFUSED`: comes with a `field` (`birthDate`, `accountType`, `parentAgreed`, `email`, `acceptTerms`), so forms can show the message next to the field.
- `EMAIL_NOT_VERIFIED` (403): a fresh link has already been sent.
- `ACCOUNT_SUSPENDED` (403).
- `INVALID_EMAIL_OR_PASSWORD` (401): the same for a wrong password and an unknown email.
- `INVALID_REDIRECT` (400): a `callbackURL` or `redirectTo` outside our API, portal and app.
- `INVALID_TOKEN` (400): a reset link that is unknown, expired or already used.

## Rules we add (PRD §2, §3, §9)

Run in Better Auth's "before a user is created" hook, so no sign-up path can skip them. The rules
themselves are in `signup-rules.ts`:

- Under 13: refused, nothing stored. Children exist only as a profile their parent runs.
- 13 to 17: `accountType: 'teen'` only, with `parentAgreed: true`. 18 and over can't be teens.
- Anyone signs up as athlete, parent, teen, alumni or recruiter. Never staff or coach: coaches
  come in by invite (TI-149), staff are created by the server.
- Recruiters: an adult on a work email whose domain (or a parent domain) staff registered for an
  active company. The account is linked to that company (`users.org_id`).
- Consent: `terms` (and `parent_agreed` for teens) go into `consent_records` with the terms version.
- Account type, birth date, `status` and `org_id` are server-owned: no request can set them
  directly or change them later. Sign-up sends `accountType` and `birthDate`, which the hook checks
  and copies in.

Sign-in and every request also check the account: a suspended or deleted account, or a recruiter
whose company is suspended, is refused at once. A deleted account reads as "no such account".

## What else protects it

- **Passwords**: argon2id (64 MiB, 3 passes, 4 lanes), salted and one-way, stored in
  `auth_accounts.password`. 12 to 128 characters.
- **Only the endpoints we use are on.** Better Auth's update-user, change-email, delete-user,
  revoke-session, update-session and the social sign-in endpoints are switched off
  (`disabledPaths`). Profile edits and account deletion are our own routes, with our rules.
- **No session token ever appears in a response body**, only in the HttpOnly cookie, so a script
  injected into a page can't read it. The Expo client stores the session from the Set-Cookie header.
- **Links can't be turned into phishing links:** any `callbackURL` or `redirectTo` must point at
  our API, portal, athlete app or the `teamimpact://` scheme, or the request is refused.
- **Requests from other websites are refused** (Better Auth's origin check, plus SameSite=Lax).
- **Rate limits** per caller IP: 20 sign-ins and 20 sign-ups a minute (so a team can sign up
  together on one campus Wi-Fi), 3 verification or reset emails per 5 minutes, and Better Auth's
  defaults elsewhere. The IP comes from Fastify, trusting only our own
  proxy (`TRUST_PROXY`); any IP header the caller sends is replaced, so limits can't be dodged.
- **No account enumeration:** a taken email, an unknown email at sign-in and an unknown address at
  "forgot password" all answer like the real thing. Only the inbox owner learns anything.
- **Suspension and deletion take effect at once:** a blocked account's sessions are deleted the
  next time any of them is used.

## Sessions on each client

- **Portal and athlete app on web:** an HttpOnly, SameSite=Lax cookie (`ti.session_token`). Use
  Better Auth's client (`better-auth/react`) with `credentials: 'include'`.
- **Athlete app on iOS and Android:** Better Auth's Expo client (`@better-auth/expo`) keeps the
  session in `expo-secure-store` and sends it as a cookie header. The app's `teamimpact://` scheme
  is a trusted origin (Expo Go's `exp://` too, in development only).
- Sessions last 14 days from last use. There is no session cache, so sign-out, a password reset
  or a suspension takes effect on the next request.

Our own routes call `app.authenticate(request)`, which returns `{ id, userType }` or null (answer
401). It has the same shape as the stand-in in the uploads PR (#8), so those routes switch over
unchanged.

## Settings

See `.env.example`: `API_URL`, `PORTAL_URL`, `ATHLETE_APP_URL`, `SMTP_URL`, `MAIL_FROM`,
`TRUST_PROXY` (1 on DigitalOcean App Platform, 0 when the API is reached directly), plus the
existing `SESSION_SECRET`, which signs cookies and tokens. Without `SMTP_URL`, emails (links
included) print in the API log. Production refuses to start without it.

## Trade-offs to know

- Better Auth stores session tokens in `auth_sessions` as they are, not hashed. Anyone who can read
  the database could take over a session, so database access must stay tight.
- Verification links are signed tokens valid for 24 hours, not one-time. Verifying twice changes
  nothing.
- Rate limiting is Better Auth's own, on in production and kept in memory (per instance). Move it
  to Valkey when the API runs on more than one instance.

## Not done yet

- The apps' sign-in, verify and reset screens, wired to Better Auth's clients
- Coach invite acceptance (TI-149) and a staff-creation script
- Choosing an email provider (`SMTP_URL`), and SPF/DKIM for the sending domain
- Phone sign-in and the school-plus-personal email idea, if they're in for the pilot
