# Hi-fi mockups

Clickable mockups of the three surfaces in PRD v2, built from the approved hi-fi canvas
(Signing Day design language). Design reference only: not shipped, no API, demo data lives in the
browser (`localStorage`). Not part of the production deploy (DigitalOcean); a preview copy is
hosted on Vercel for walkthroughs.

- `#/app`: mobile app in a phone frame, with a persona switcher (athlete, parent, teen, coach,
  alumni, recruiter) and the full sign-up flow
- `#/portal`: recruiter portal
- `#/staff`: staff portal

All three share one demo "world" (`src/shared/store.tsx`), so actions in one surface show up in the
others: an athlete turning off open to recruiting leaves the portal, staff suspending a company
blocks its recruiters, marking a group official adds a recruiter filter. "Reset demo data" in the
top bar restores the seed data.

```sh
pnpm --filter @team-impact/mockups dev
pnpm --filter @team-impact/mockups build   # static site in dist/
```

Tokens live in `src/shared/styles.css` as CSS variables and mirror the design-language ticket
(TI-72). `packages/ui-tokens` still holds placeholders; port these values there when TI-12 lands.
