# Athlete card

A flippable, baseball-card-style athlete card. The **front** is the athlete's resume, laid over
their photo. The **back** is their personal info. Swipe sideways or tap to turn it. The card's
colours are taken from the uploaded photo.

The same card renders in the Expo app (`apps/athlete`) and in the Vite portal (`apps/portal`). Both
renderers share one data model, one visual spec and one set of generated artwork, so the two look
the same.

## Using it

```tsx
// Expo app
import { AthleteCard, sampleAthlete } from '@team-impact/ui-primitives/native';
// Portal
import { AthleteCard, sampleAthlete } from '@team-impact/ui-primitives/web';

<AthleteCard
  athlete={{ ...sampleAthlete, photoUri }} // AthleteCardData, see types.ts
  width={340} // height follows CARD_HEIGHT / CARD_WIDTH
  flipped={flipped} // optional: controlled
  onFlippedChange={setFlipped} // optional
  palette={storedPalette} // optional: skip photo colour sampling
/>;
```

Leave out `flipped` (optionally passing `defaultFlipped`) and the card tracks its own flip state.
The demos are `apps/athlete/src/screens/CardDemoScreen.tsx` and
`apps/portal/src/AthleteCardPreview.tsx`.

### Product rules the caller must enforce (PRD §2, §6)

The card renders whatever it's given, so these rules are the caller's job:

- Never pass a **child profile** (under 13 or teen) to a card that will be exported or shown outside
  the athlete's team and family.
- Leave out `personal.contact` when the **viewer is a teen**. The contact strip then disappears.
- There is no field for **health or diagnosis** data. Don't put it in `facts`.

## File map

```
packages/ui-primitives/
├── assets/team-impact-logo.png    Logo crest, 240px tall so it only ever scales down
├── src/index.ts                   Platform-neutral exports (types, spec, art, palette)
├── src/athlete-card/              Shared: no React Native, no DOM
│   ├── types.ts                   AthleteCardData: the card's input
│   ├── model.ts                   prepareCard(), list limits, useFlipState, sampleAthlete
│   ├── spec.ts                    THE DESIGN FILE: sizes, colours, text, motion, photo bleed
│   ├── patterns.ts                Generated SVG artwork for both faces
│   ├── palette.ts                 Photo → colour palette, cache, useCardPalette
│   ├── png.ts                     Tiny PNG decoder (app-side colour sampling only)
│   └── flip.ts                    Flip-angle maths (runs on Reanimated's UI thread)
├── src/native/                    Expo / React Native renderer
│   ├── AthleteCard.tsx            Reanimated + Gesture Handler card
│   ├── CardArt.tsx                CardArt, PhotoBleed, Gradient (react-native-svg)
│   ├── samplePhoto.ts             expo-image-manipulator → 16×16 PNG → pixels
│   ├── assets.d.ts                Types `*.png` imports as Metro asset ids
│   └── tsconfig.json              App-side typecheck (also how the editor finds assets.d.ts)
└── src/web/                       Portal renderer
    ├── AthleteCard.tsx            DOM + CSS 3D transforms + pointer events
    ├── CardArt.tsx                CardArt, PhotoBleed, Gradient (<svg>)
    ├── samplePhoto.ts             <canvas> → pixels
    └── assets.d.ts                Types `*.png` imports as URLs
```

The package exports three entry points: `.` (shared), `./native` and `./web`. Each app only
bundles its own renderer.

## How a card is drawn

```
AthleteCardData ──prepareCard()──► PreparedCard (lists capped, initials, badge text…)
photoUri ──useCardPalette()──────► CardPalette (6 colours)
athlete id + palette ──frontArt()/backArt()──► SVG layers
                                       │
             native/ or web/ AthleteCard renders, back to front:
   FRONT  CardArt (gradient, glow, patterns) → PhotoBleed (masked photo, scrim, frame line)
          → logo, jersey badge, name, position badge, resume text
   BACK   CardArt (tint, dots, flow lines, shadow, wavy band, chrome rim, light work)
          → avatar, name, about, facts, interests, contact
```

Each face sits in its own animated layer, and the two are rotated 180° from each other.

### Data model (`types.ts`, `model.ts`)

`prepareCard()` turns `AthleteCardData` into display-ready data:

- **List limits:** lists are capped by `CARD_LIMITS` (3 stats, 3 experience entries, 5 skills,
  4 facts, 5 interests), because the card has a fixed size and can't grow.
- **Text built for display:** initials, `#8`-style jersey number, the sport · school line, the
  hometown · pronouns line, and contact lines.
- **Position badge:** shows `positionShort` (e.g. `MF`) if given, otherwise the first letters of
  `position`.
- **Screen reader text:** `describeCard()` builds the label that describes the visible side.

### Visual spec (`spec.ts`)

Every size is in **base units** on a `CARD_WIDTH × CARD_HEIGHT` card. Each renderer multiplies by
`width / CARD_WIDTH`, so the card scales to any width.

- **`cardColors`:** the fixed brand colours (badge yellow, stripe red, text). They come from the
  `palette` in `@team-impact/ui-tokens`.
- **`cardLayout`:** positions and sizes (photo window, badges, logo, back header, chips).
- **`photoBleed`:** the front photo's fade-out mask.
- **`cardText`:** every text style. Fonts: the portal asks for DM Sans; the app uses the system
  font until DM Sans is bundled with `expo-font`.
- **`cardMotion`:** flip duration and easing (from ui-tokens), 3D perspective, mid-flip lift, press
  scale.

### Generated artwork (`patterns.ts`)

All artwork is **SVG path strings** computed in plain TypeScript. Native draws them with
react-native-svg, the web with `<svg>`. The output is identical on both.

- **Seeded per athlete:** a random generator seeded by the athlete's `id` gives every athlete their
  own variation, and the same athlete always looks the same.
- **Cached:** `geometryFor(seed)` builds the shapes once per seed (up to 64 athletes are
  kept in memory). `frontArt()`/`backArt()` then only apply colours.
- **Front:** colour gradient + radial glow, topographic contour lines, halftone dots, corner speed
  stripes, a thin frame.
- **Back:** a light tint, dot grid, faint flow lines, and a **wavy header band** with:
  - a soft shadow under the curve (`SHADOW_STACK`)
  - a glossy chrome rim along the edge (`RIM_GLOW`)
  - clipped inside the band: a soft beam, "liquid metal" strands, paired light streaks, and one
    streak in the photo's colour
- **Glow without blur:** glows are made with `glowStack()`, which draws the same line several times,
  from wide and faint up to thin and bright. SVG blur filters are slow and inconsistent in
  react-native-svg, so they aren't used anywhere.
- **Clipping:** a layer with `clipped: true` is drawn inside the face's `clip` shape (the header
  band). `CardArt` groups consecutive clipped layers into one clipped group.

### Photo bleed (`PhotoBleed` in `native/` and `web/CardArt.tsx`)

The front photo isn't boxed in. It spans the card width and **dissolves into the card** through an
SVG mask, Topps-style:

- **Mask:** a vertical gradient (fade in at the top, dissolve at the bottom) combined with a
  horizontal one (fade at the sides).
- **Scrim:** a shade in the palette's `deep` colour, behind the name, that fades in and out with no
  hard edge, so the name stays readable.
- **Frame line:** a thin yellow line drawn over the photo where the old border was. The photo runs
  past it at the sides.
- **No photo:** a gradient takes the photo's place, with the initials on top.

An SVG mask is used rather than CSS `mask-image` because React Native has no CSS masks, and this
way one technique works on both platforms.

### Photo colours (`palette.ts`, `png.ts`, `*/samplePhoto.ts`)

```
photo URI ─► shrink to 16×16 ─► read RGBA pixels ─► paletteFromPixels() ─► CardPalette
            (platform-specific)                     (shared)
```

**1. Shrink (any resolution, any format the device can open):**

- **App:** `expo-image-manipulator` resizes natively, then saves a ~1 KB PNG as base64. `png.ts`
  decodes it in JS: base64 → bytes → `fflate` unzip → undo PNG row filters → RGBA. It handles 8-
  and 16-bit grey, grey+alpha, RGB and RGBA, which is what the iOS and Android encoders produce.
  This route works in Expo Go; no custom native module.
- **Web:** `drawImage` onto a 16×16 `<canvas>`, then `getImageData`.

**2. Pick the colours (`paletteFromPixels`):**

1. Group pixels into colour buckets (4 bits per channel), skipping transparent ones.
2. Score each bucket by how many pixels it holds, boosted by saturation and damped near black and
   white, so a vivid jersey beats a big grey wall.
3. The top bucket is the **dominant** colour. The best bucket at least 25° away in hue is the
   **secondary**; if none qualifies, the secondary is the dominant hue shifted 35°.
4. Six colours are built from those two: `deep` and `base` (front gradient), `glow`, `band` (back
   header), and `tint` and `tintDeep` (back background). The dark colours are darkened until
   white text reaches roughly 5:1 contrast (`DARK_CEILING`).
   Near-greyscale photos get a near-grey card instead of an invented colour.

**3. Use it (`useCardPalette`):**

- Order of preference: the `palette` prop, then the photo's colours, then `brandPalette` (navy).
- While a new photo is sampled, the previous colours stay, so there's no flash back to navy.
- `paletteForPhoto()` caches results per **URI**, in memory only (32 entries; when full, the oldest
  is dropped). This covers remounts and several cards showing the same photo.
  It doesn't deduplicate re-uploads: pickers create a new URI each time.

**4. Fallback:** any failure falls back to `brandPalette`. That covers unreadable formats,
cross-origin photos without CORS on the portal, and fully transparent images.

### Flip and swipe (`flip.ts`, both `AthleteCard.tsx`)

**The angle model:** the rotation is one unbounded angle in degrees.

- Multiples of 180° are resting positions; odd multiples show the back.
- Dragging one full card width turns the card 180°.
- On release, `settleAngle()` pushes the angle forward by the flick speed, rounds to the nearest
  180°, and never moves more than one flip from where the drag started.

**App (`react-native-reanimated`, `react-native-gesture-handler`):**

- **Shared values:** `angle` (live rotation), `restAngle` (settled rotation), `dragStart` and
  `pressed`.
- **`Gesture.Pan()`:**
  - It starts after 10px of sideways movement and gives up after 14px of vertical movement, so the
    page still scrolls.
  - While dragging, `angle` follows the finger on the UI thread.
  - On release it springs to `settleAngle()` (`flipSpring`) and calls `scheduleOnRN(setFlipped)`.
- **`Gesture.Tap()`:** shrinks the card slightly on press and flips on release.
- **`Gesture.Race(pan, tap)`:** whichever gesture activates first wins.
- **Buttons and the `flipped` prop:** these go through a `useEffect` that animates
  `restAngle + 180` with the `cardMotion` timing.
- **Faces:** each face rotates with `rotateY` and also hides itself when edge-on (Android doesn't
  honour `backfaceVisibility` reliably). `edgeAmount()` drives the mid-flip lift.
- **Screen readers:** the card is one button with a label for the visible side and an `activate`
  action. Reduced motion makes flips instant.

**Web (pointer events + CSS 3D):**

- **Rest state:** `restAngle` is React state, rendered as `rotateY()` with a CSS transition.
- **While dragging:**
  - After `DRAG_SLOP` (8px) of sideways movement the card captures the pointer.
  - From then on, the rotation and lift are written straight to the DOM through refs, so React
    doesn't re-render on every frame.
  - `touch-action: pan-y` keeps vertical page scrolling working on touch screens.
- **On release:** `settleAngle()` → restore the transition → update React state.
- **Clicks, Enter and Space** flip the card. A click right after a drag is ignored.
- **Mid-flip lift on clicks:** done with the Web Animations API.

## Changing the design

| You want to change                     | Edit                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| Card proportions                       | `CARD_HEIGHT` in `spec.ts` (width stays the 320 base)                                         |
| Sizes, spacing, badge/logo size        | `cardLayout` in `spec.ts`                                                                     |
| Fonts and text sizes                   | `cardText` in `spec.ts`                                                                       |
| Fixed brand colours                    | `cardColors` in `spec.ts` (or the ui-tokens palette)                                          |
| Flip speed, depth, lift                | `cardMotion` in `spec.ts`; spring feel: `flipSpring` in `native/AthleteCard.tsx`              |
| How the photo fades                    | `photoBleed` in `spec.ts`                                                                     |
| Pattern shapes and placement           | `geometryFor()` in `patterns.ts`                                                              |
| Pattern colours, opacity, which layers | `frontArt()` / `backArt()` layers in `patterns.ts`                                            |
| Glow strength                          | `LIQUID_GLOW`, `STREAK_GLOW`, `BEAM_GLOW`, `RIM_GLOW`, `SHADOW_STACK` in `patterns.ts`        |
| Back curve height                      | `right` / `left` in `geometryFor()`; if you lower it a lot, raise `cardLayout.backHeader` too |
| Photo-derived colours                  | lightness/saturation values in `paletteFromPixels()`; no-photo look: `brandPalette`           |
| How much content fits                  | `CARD_LIMITS` in `model.ts`                                                                   |
| Layout (what goes where)               | `FrontFace` / `BackFace` + `createStyles` in **both** `native/` and `web/AthleteCard.tsx`     |

The two `createStyles` blocks mirror each other on purpose. They can't share code because React
Native and the DOM treat styles differently: for example, a unitless `lineHeight` is a multiplier
on the web but points in React Native. If you change one, mirror the change in the other.

## Dependencies

App-side native modules must be installed from `apps/athlete` with `npx expo install` (never
`pnpm add`). All of them are included in Expo Go.

| Package                                             | Used for                                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| `react-native-reanimated` + `react-native-worklets` | Flip animation on the UI thread; `scheduleOnRN` reports back to React      |
| `react-native-gesture-handler`                      | Swipe and tap. The app root must be wrapped in `GestureHandlerRootView`    |
| `react-native-svg`                                  | All artwork, the photo mask and gradients in the app                       |
| `expo-image-manipulator`                            | Shrinks photos for colour sampling                                         |
| `expo-image-picker`                                 | Demo only: choosing a photo                                                |
| `fflate`                                            | Unzips PNG data in JS (~4 KB). The only runtime dependency of this package |

The portal needs nothing extra. In `ui-primitives`, the app-side packages are optional
peer dependencies, so the portal never installs or bundles them.

## Checking your changes

```bash
pnpm --filter @team-impact/ui-primitives typecheck   # web/shared project, then src/native
pnpm --filter @team-impact/ui-primitives test        # art, PNG decoder, palette
pnpm --filter @team-impact/portal test               # card flips via click and button
```

To see it running: `pnpm --filter @team-impact/athlete dev` (or `npx expo start` **from
`apps/athlete`**) and `pnpm --filter @team-impact/portal dev`.

## Gotchas

- **Start Expo from `apps/athlete`, not the repo root.** From the root, Expo can't find the entry
  point ("Unable to resolve module ../../App"), and it creates a stray root `tsconfig.json` and
  `.expo/`. Delete both if they appear.
- **After installing a native module, restart Metro:** `npx expo start -c`, then reopen the app.
  Otherwise Expo SDK 57 can show a misleading "Cannot find native module 'ExpoAsset'" error.
- **`src/native/tsconfig.json` must stay.** It's how the editor knows about `assets.d.ts`. Without
  it, the PNG import in `native/AthleteCard.tsx` shows "Cannot find module".
- **Photos from other sites need CORS on the portal.** Without it the browser blocks reading the
  pixels and the card falls back to navy. Uploads from the user's own device are always fine.
- **The palette isn't saved anywhere.** It's recomputed on every device and after every reload.
  To compute it once, save it with the profile at upload and pass it back through the `palette`
  prop.

## Open items

- `design/signing-day-tokens` replaces the ui-tokens API this card uses (`palette`,
  `duration.emphasis`, `duration.fast`). That branch's CLAUDE.md also places primitives in
  `apps/*/src/ui` (TI-12) rather than in this shared package. Agree on a direction before merging.
  That branch also adds an official SVG logo, which could replace `assets/team-impact-logo.png`.
- Saving the palette with the athlete profile is waiting on a profile endpoint.
- DM Sans isn't bundled in the app yet (`expo-font`).
