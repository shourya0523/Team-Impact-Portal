# @team-impact/ui-tokens

Signing Day design tokens (TI-72). One source for Expo native, React Native Web and the Vite portal.
Plain numbers and strings only. Anything that only works on one platform is not a token.

| Group    | Module          | Notes                                                                                                                                                                                                                                                                |
| -------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colour   | `colors.ts`     | Logo navy `#1E3F7B` = `brand` (brand, links, focus, selection); logo red `#EA2642` = `red` (decorative) and `action` (primary buttons, nudged to `#E3233F` so white text is AA). Edit the constants at the top of the file                                           |
| Type     | `typography.ts` | Display: Barlow Condensed 800 uppercase (48/44/34/32, line-height 0.95). UI: Barlow 400/500/600. `letterSpacing` is in em                                                                                                                                            |
| Spacing  | `spacing.ts`    | Unchanged scale (4 to 80)                                                                                                                                                                                                                                            |
| Radius   | `radius.ts`     | 10 / 12 / 14 / 16 / 18 (`card` = Baseball Card)                                                                                                                                                                                                                      |
| Layout   | `layout.ts`     | Button heights 52/56, min touch target 44, avatar sizes                                                                                                                                                                                                              |
| Motion   | `motion.ts`     | Durations (ms), cubic-beziers, spring numbers, card tilt max (9 degrees)                                                                                                                                                                                             |
| Team     | `team.ts`       | Each team's optional colour is set by staff when creating the team (PRD v2.1 S2, TI-148) and stored on the team; default brand navy. `resolveTeamColor` applies the default, `onTeamColor` picks white or ink. Staff can't save a colour where neither reaches 4.5:1 |
| Contrast | `accessibility` | `textPairs` / `uiPairs` are asserted by the test suite; add new pairings there                                                                                                                                                                                       |
| CSS      | `tokens.css`    | Generated: `pnpm --filter @team-impact/ui-tokens build:css`. A test fails if it is stale                                                                                                                                                                             |

## Per-platform adapters (derived from these values)

- Expo: `apps/athlete/src/ui/motion.ts` (`Easing.bezier`, `withTiming` configs, `withSpring` config), `useReducedMotion`
- Portal: `apps/portal/src/ui/motion.ts` (Motion `transition` objects), `useReducedMotion`, `tokens.css` variables (`--ti-*`)

## Reduced motion

`useReducedMotion()` in both apps. When true: no stamp, no tilt, no shine, and movement becomes a fade
(`FadeSlideIn` and `Sheet` drop their translate). Tilt and shine components must check it too.

## Primitives

Implemented per app (RN vs DOM), using only these tokens: `Text`, `Button`, `Input`, `Card`, `Avatar`,
`TeamAvatar`, `Badge`, `Sheet`, plus `FadeSlideIn`.

| Primitive | Variants / states                                                                          |
| --------- | ------------------------------------------------------------------------------------------ |
| Button    | `primary` / `secondary`; `md` (52) / `lg` (56); default, pressed, focus, disabled          |
| Input     | default, focus (brand ring), error (warning chip + `aria-invalid`), disabled               |
| Card      | `plain` (16 radius, line border) / `dark` (card.surface, 18 radius)                        |
| Avatar    | `sm` 32 / `md` 44 / `lg` 64; image or initials. `TeamAvatar` adds `teamColor`              |
| Badge     | `neutral` / `brand` / `warning`                                                            |
| Sheet     | modal bottom sheet; Esc, scrim and back button close; fades only when reduced motion is on |

## Logo

`apps/athlete/assets/logo.png` and `apps/portal/public/logo.png`: the official Team IMPACT logo,
335 x 388 PNG with transparency, taken from Team IMPACT's own published PDF (the 2024 Game Day Gala
sell sheet on teamimpact.org). Its colours are exactly `brand` navy and `red`. Render it with the
`Logo` primitive (heights `layout.logo`, width from `layout.logoAspectRatio`). Use on light
backgrounds only (no white keyline). Never recolour or redraw it; swap in the official SVG when
Team IMPACT provides one.

## Where things live

Tokens are platform-neutral here (plain numbers, strings, hex). Primitives and animation adapters
depend on React Native or the DOM, so they live in each app (`apps/*/src/ui`), as CLAUDE.md and Notion TI-12 both say.

## Lint

`no-restricted-syntax` in the root `eslint.config.mjs` fails hardcoded hex or colour functions, and
non-zero literals for padding/margin/gap, border radius, font size and line height, in `apps/athlete` and
`apps/portal/src`. Runtime data such as team colours belongs in a fixture file with a scoped disable.
