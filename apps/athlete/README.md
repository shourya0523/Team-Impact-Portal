# Athlete app: routing skeleton

The athlete app (Expo SDK 57) uses **Expo Router**. Every screen from the hi-fi wireframes exists
as an unstyled placeholder route. Each placeholder shows its name, the wireframe board it stands for, and one
button per place that board navigates to. Feature tickets replace placeholders with real screens.
The navigation around them stays the same.

- **Source of the sitemap:** the "Team Impact hi-fi wireframes" design artifact
  (claude.ai/artifact/LuJVQiAtjENgNBTSq4Bpsf), page **Mobile app**. The Recruiter portal and Staff
  portal pages are web-only and live in `apps/portal`.
- **Roles:** `Role` from `@team-impact/contracts`.
- **Sign-in is a placeholder.** The chosen role only lives in memory (`src/navigation/role.tsx`),
  so a reload signs you out. The auth ticket replaces this.

## Running it

```bash
cd apps/athlete
npx expo start          # normal app (or from the repo root: pnpm --filter @team-impact/athlete dev)
pnpm demo:card          # opens straight into the athlete card demo
```

Always start Expo **from `apps/athlete`**. From the repo root it can't find the app, and it
creates a stray `tsconfig.json` and `.expo/` there.

## How Expo Router reads the folders

Routes are **files**. There's no route table anywhere. A file's path under `src/app/` is its URL:

| File                             | URL           | Notes                                                           |
| -------------------------------- | ------------- | --------------------------------------------------------------- |
| `src/app/welcome.tsx`            | `/welcome`    | the file's `export default` is the screen                       |
| `src/app/index.tsx`              | `/`           | `index` = the folder's own page                                 |
| `src/app/(app)/events/index.tsx` | `/events`     | `(app)` adds nothing to the URL (see below)                     |
| `src/app/(app)/events/[id].tsx`  | `/events/123` | `[id]` matches any value; read it with `useLocalSearchParams()` |
| `src/app/_layout.tsx`            | not a page    | wraps every screen in its folder and the folders below it       |

Some names are special:

- **`_layout.tsx`** wraps the routes beside it. The root one keeps `GestureHandlerRootView`, which the
  card's swipe needs, and the role provider. A layout that returns `<Stack />` gives its screens push and back
  navigation with a header.
- **`(name)/` is a route group.** It's a normal folder that groups files and can have its own
  `_layout.tsx`, but it **doesn't appear in the URL**. `(app)/` holds the signed-in screens, so its
  layout (the tab bar) only wraps them, while URLs stay clean (`/home`, not `/app/home`).
- **Only routes go in `src/app/`.** Shared code lives elsewhere in `src/`: `components/`,
  `navigation/`, `demos/`, `types/`.

## Folder map

```
src/
├── app/
│   ├── _layout.tsx           root: gesture root + RoleProvider + Stack
│   ├── index.tsx             "/" (card-demo redirect when EXPO_PUBLIC_DEMO=card)
│   ├── welcome.tsx           A-01 landing
│   ├── sign-up.tsx           A-03/05 pick a role
│   ├── onboarding/           details, terms, find-team, request, pending, under-13
│   ├── scan.tsx              A-11
│   ├── signed.tsx            A-10/11 → enters the app
│   ├── dev/card-demo.tsx     the card demo, outside the app's tabs
│   └── (app)/                signed-in area
│       ├── _layout.tsx       the role-based tab bar
│       ├── home/  events/  team/  card/  review/  lists/  me/   one folder per tab
│       └── child.tsx         parent's child tab (no sub-screens, so a single file)
├── components/Placeholder.tsx   the placeholder screen used by every route
├── navigation/
│   ├── role.tsx              RoleProvider / useRole (placeholder session)
│   └── tabs.ts               which tabs each role sees + firstTab()
├── demos/CardDemoScreen.tsx
└── types/assets.d.ts         lets TypeScript import .png files
```

## How the role-based tabs work

1. **Sign-up stores a role.** `sign-up.tsx` calls `setRole(role)` from `useRole()`, then goes to
   `/onboarding/details`.
2. **`TABS_BY_ROLE` in `src/navigation/tabs.ts`** is the single table of which tabs each role gets.
3. **`(app)/_layout.tsx` draws the tab bar.**
   - `ALL_TABS` lists every tab in display order. Each one is wrapped in
     `<Tabs.Protected guard={allowed.includes(tab.name)}>`.
   - A tab whose guard is `false` is hidden, and its URL is blocked for that role.
   - If no role is set, the layout redirects to `/welcome`.
   - Import `Tabs` from `expo-router/js-tabs`. The `expo-router` export is deprecated in SDK 57.
4. **Each tab folder has a `_layout.tsx` returning `<Stack />`**, so screens opened from a tab push
   on top of it with a back button. The tab bar's own header is hidden (`headerShown: false`), so the
   stack's header is the only one.
5. **Each tab layout sets `unstable_settings = { anchor: 'index' }`**, and `Placeholder` navigates
   with `{ withAnchor: true }`. When a button jumps into another tab, for example Notifications → "A group"
   lands on `/me/groups/1`, that tab's main screen is loaded underneath. Back and re-pressing the
   tab then return to it instead of getting stuck on the detail screen.
6. **One route, different content per role.** Where the wireframe shows a different version of a
   screen for some roles, the screen reads `useRole()` and shows that variant. This keeps one URL
   per place in the app. Examples: `home/index.tsx`, `home/compose.tsx`, `team/index.tsx`,
   `me/index.tsx`, `onboarding/details.tsx`.

## The sitemap (from the wireframe)

### Roles and tab bars

The tab bars come from each board's `tabs` array in the wireframe:

| Role (`Role`)    | Sign-up label           | Tabs                                  | Lands on  |
| ---------------- | ----------------------- | ------------------------------------- | --------- |
| `athlete`        | Athlete                 | Home · Events · Team · Card · Me      | `/home`   |
| `parent`         | Parent                  | Home · Events · Team · **Child** · Me | `/home`   |
| `teen`           | Teammate, 13–17         | Home · Events · Team · Me             | `/home`   |
| `coach`          | Coach                   | Home · Events · Team · Me             | `/team`   |
| `alumni_athlete` | Alumni (former athlete) | Home · Events · Card · Me ¹           | `/home`   |
| `alumni_mentor`  | Alumni (mentor)         | Home · Events · Me ¹                  | `/home`   |
| `recruiter`      | Recruiter               | Review · Lists · Me ²                 | `/review` |

¹ **Alumni.** The wireframe has no alumni tab bar, and has one "Alumni" sign-up option, while contracts
has two alumni roles. Former athletes keep a Card tab: contracts' `hasBaseballCard()` includes them,
and the wireframe's "Claim your pre-built card" (L5) flows into card review.

² **Recruiter.** The wireframe's recruiter bar is Review · Lists. Me is added so recruiters can sign out.

`staff` has no mobile screens; staff use the web portal.

### Signed-out flow

```
/welcome ─ Scan QR ──────────────────────────────────────────────► /scan ─► /signed ─► app
   └─ Create an account ─► /sign-up ─► /onboarding/details
                              │            ├─ athlete, parent, teen ─► /onboarding/terms ─► /onboarding/find-team
                              │            │        ├─ Request to join ─► /onboarding/request ─► /onboarding/pending ─► /scan
                              │            │        └─ Scan QR ─► /scan
                              │            ├─ coach ─► /team
                              │            ├─ alumni ─► /home
                              │            └─ recruiter ─► /review
                              └─ Under 13? ─► /onboarding/under-13 ─► /sign-up (as a parent) or /welcome
```

`/signed` → "Enter the app" lands on the role's first tab, using `firstTab()`. Parents also get
"Set up your child's profile".

### Every route and its wireframe board

| Route                   | Screen                                                                | Wireframe                                                                   |
| ----------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `/welcome`              | Welcome                                                               | A-01                                                                        |
| `/sign-up`              | Create account, pick a role                                           | A-03/05                                                                     |
| `/onboarding/under-13`  | Under 13                                                              | A-04                                                                        |
| `/onboarding/details`   | Details, per role                                                     | Details: athlete / parent / teen / coach (A-12) / alumni (A-47) / recruiter |
| `/onboarding/terms`     | House rules (teen: parent agreed)                                     | A-06                                                                        |
| `/onboarding/find-team` | Find your team                                                        | A-07/08                                                                     |
| `/onboarding/request`   | Request to join (parent / athlete)                                    | A-09 / A1                                                                   |
| `/onboarding/pending`   | Request pending                                                       | A-10                                                                        |
| `/scan`                 | Scan QR                                                               | A-11                                                                        |
| `/signed`               | Signed                                                                | A-10/11                                                                     |
| `/home`                 | Home feed (parent: no composer)                                       | A-13 / F5                                                                   |
| `/home/notifications`   | Notifications                                                         | P1                                                                          |
| `/home/compose`         | Composer (teen: team only)                                            | A-14 / T3                                                                   |
| `/home/posts/[id]`      | Post, report, block                                                   | A-15/16                                                                     |
| `/home/posts/report`    | Report reason                                                         | P5                                                                          |
| `/events`               | Events                                                                | A-20                                                                        |
| `/events/[id]`          | Event detail                                                          | A-21                                                                        |
| `/events/new`           | Create event                                                          | A3/C7                                                                       |
| `/team`                 | Roster (parent/athlete), roster (teen), or coach requests and members | A-23 / A-23 teen / A-26/27                                                  |
| `/team/qr`              | Coach QR code                                                         | A-28/29                                                                     |
| `/team/remove`          | Remove member                                                         | C3                                                                          |
| `/team/add-coach`       | Add a coach                                                           | C4                                                                          |
| `/team/edit`            | Edit team details                                                     | C5                                                                          |
| `/child`                | Child profile                                                         | A-38                                                                        |
| `/card`                 | Card start / my card                                                  | A-32 / A-32/36                                                              |
| `/card/upload`          | Upload resume                                                         | A-33                                                                        |
| `/card/review`          | Review extracted fields                                               | A-34                                                                        |
| `/card/editor`          | Card editor                                                           | A-35                                                                        |
| `/card/export`          | Export card as image                                                  | A8                                                                          |
| `/card/history`         | Card history by season                                                | A9                                                                          |
| `/card/claim`           | Claim pre-built card                                                  | L5                                                                          |
| `/review`               | Quick review (swipe)                                                  | A-49                                                                        |
| `/review/filters`       | Review filters                                                        | R7                                                                          |
| `/review/athletes/[id]` | Recruiter: card and contacts                                          | Recruiter card                                                              |
| `/lists`                | Recruiter lists                                                       | A-50                                                                        |
| `/lists/new`            | New list                                                              | R5                                                                          |
| `/me`                   | Me (rows depend on role) + sign out                                   | A-39                                                                        |
| `/me/recruiting`        | Contacts and recruiting                                               | A-40/41/42                                                                  |
| `/me/safety`            | Notifications, blocked, delete                                        | A-43/44/45                                                                  |
| `/me/groups`            | Groups                                                                | A-17                                                                        |
| `/me/groups/[id]`       | Group detail                                                          | A-18                                                                        |
| `/me/groups/new`        | Create group                                                          | A6                                                                          |
| `/me/alumni`            | Browse alumni                                                         | A7                                                                          |
| `/me/alumni/[id]`       | Alumni profile                                                        | L4                                                                          |
| `/dev/card-demo`        | Athlete card demo (not in the wireframe)                              |                                                                             |

**Left out:** the wireframe's three "Prototype" boards (Onboarding, CardFlow, RecruiterFlow). They
chain existing screens together rather than adding new ones.

## Common changes

| Task                                                       | What to do                                                                                                                                                                              |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Build a real screen**                                    | Replace the route file's `<Placeholder …/>` with your component. Keep the file and the `export default`                                                                                 |
| **Add a screen inside a tab**                              | Add a file in that tab's folder, e.g. `(app)/events/rsvp.tsx` → `/events/rsvp`, and link to it with `<Link href>` or `router.push()`                                                    |
| **Add a tab**                                              | Add the name to `TabName` and the relevant roles in `tabs.ts`, add it to `ALL_TABS` in `(app)/_layout.tsx`, then create `(app)/<name>/_layout.tsx` (copy another tab's) and `index.tsx` |
| **Add or change a role's tabs**                            | Edit `TABS_BY_ROLE` in `tabs.ts`. Add new roles to `OPTIONS` in `sign-up.tsx`                                                                                                           |
| **A rule inside a screen** (e.g. teens can't see contacts) | Branch on `useRole()` inside the screen. Tabs only decide which tabs a role sees                                                                                                        |
| **Navigate**                                               | `<Link href="/x">` for links shown on screen; `router.push('/x')` after doing work, e.g. a form submit; `router.replace('/x')` when Back shouldn't return, e.g. after sign-up           |

**Typed routes.** `typedRoutes` is on, so every `href` is checked against the real files, and a
typo or a link to a missing screen is a type error. Expo regenerates the list whenever it runs, so
a red underline on a brand-new route disappears once `npx expo start` is running.

## Card demo

The athlete card demo lives at `src/demos/CardDemoScreen.tsx`. Its route,
`src/app/dev/card-demo.tsx`, sits outside the tab area, so it never interferes with the
routing. There are three ways to open it:

- **`pnpm demo:card`.** It sets `EXPO_PUBLIC_DEMO=card`, and `src/app/index.tsx` redirects to the
  demo. Restart Expo when switching between this and a normal start; add `-c` if it seems stuck.
- **Deep link:** `teamimpact://dev/card-demo`, or `/dev/card-demo` on web.
- **The "Open card demo" link** on `/`, in development builds only.

## Checking changes

```bash
pnpm --filter @team-impact/athlete typecheck   # also validates every href (typed routes)
pnpm --filter @team-impact/athlete test        # bundles the app for web via expo-router/entry
pnpm format:check
```

This skeleton was checked by crawling a web build for all seven roles: sign up, go through
onboarding, check the tab bar, and press every button on every screen. Every route was reached,
and no button led to a missing page.
