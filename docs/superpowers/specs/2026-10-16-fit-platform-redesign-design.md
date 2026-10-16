# Fit platform — visual and UX redesign (client app + landing)

Date: 2026-10-16. Status: approved in conversation (palette, scope, navigation, screen flow, design rules, share button).

## Why

The owner saw the live build (fit-platform-sooty.vercel.app) and judged it "cheap / template-like", hard to
navigate, with the wrong colours and fonts, and not app-like enough on a phone. The product is a
subscription home-workout PWA for women 25–40 (Bulgarian UI). No brand or logo exists yet; the working
name "ФОРМА" is a placeholder.

## References

- **pumpandrun.fit** (Bulgarian, monochrome): black/white/light grey, large bold sans headlines, big black
  pill buttons, real photography of people training, phone-style bottom tab bar on mobile, glassy stat cards,
  "3 steps" explainer, results, FAQ. We borrow patterns, never their brand, copy or assets.
- **Sweat (Kayla Itsines)**: feminine warmth, large image-led workout cards with level and duration,
  motivating tone.

## Decisions (from the owner)

1. Palette direction: monochrome base + one soft feminine accent — **powder pink**.
2. Photos: **curated free stock** (Unsplash / Pexels, commercial-use licence) for now, swappable later.
3. Scope: **client app + landing** fully redesigned; **admin only inherits the new tokens** (colours, font,
   buttons) without layout changes.
4. Navigation and screen flow as below; a **share button** after a workout.
5. Light theme only for now.

## Design rules (tokens)

| Token | Value | Role |
| --- | --- | --- |
| ink | `#111111` | text, primary buttons, active outlines |
| white | `#FFFFFF` | page background |
| sand | `#F4F3F0` | cards, stat tiles, neutral chips |
| powder | `#E5A9AE` | accent: progress fills, active nav icon, selected state |
| powder-light | `#FBEFEF` / `#F4D6D6` | selected option background / level chip background |
| rose-deep | `#7A3B45` | text on powder backgrounds (never powder as text colour) |

- Font: **Manrope only** (Cyrillic), weights 400 / 600 / 800. Remove Unbounded. Scale (mobile): display 34/1.05
  (−0.02em), screen title 22/1.15, card title 16, body 15–16/1.6, small 12.
- Buttons: primary = ink pill (one per screen), secondary = 1.5px ink outline pill, text link underlined.
  Minimum touch target 44px.
- Cards: sand background, 16px radius, **no shadows, no gradients**. Chips are pills.
- Motion (`motion` package already installed): short, soft page/step transitions and the post-workout
  celebration; respect `prefers-reduced-motion`.
- Icons: one outline icon set (pick one, e.g. lucide-react or Tabler) used consistently.
- Accessibility: text contrast WCAG AA; focus-visible rings; labels on icon-only buttons.
- Photos: stored in `public/photos/` (optimised via `next/image`), with `public/photos/CREDITS.md` listing
  source URL, author and licence for each. Consistent style: women 25–40 training at home, warm natural light.

## Layout and navigation

- **Mobile**: bottom tab bar with 4 tabs — **Днес** (`/app`), **Тренировки** (`/app/library`),
  **Прогрес** (check-ins + charts; today's `/app/check-in` content), **Профил** (`/app/profile`, plans and
  subscription). The workout player is full screen without the tab bar.
- **Desktop (≥1024px)**: the same app, wider — a left sidebar with the same 4 items (and the placeholder name),
  content in a centred max-width column laid out as card grids. No website-style top navigation.
- Future: community becomes a 5th tab (stage 7); challenges surface inside Днес.

## Screens

1. **Landing** (`/`): large photo hero, clear promise, primary CTA „Започни безплатно“; „Как работи“ in 3
   steps; what's included; results/testimonial placeholders (clearly placeholder until real ones exist); price
   (monthly/yearly); FAQ; footer with legal links. Mobile-first.
2. **Onboarding questionnaire** (`/start`): one question per screen with big tappable option cards, a top progress
   bar with step count and back arrow: height + weight, goal, problem, level. Existing validation and storage
   logic stay; only presentation changes.
3. **Account** (`/start/finish`, `/login`): short single screen — e-mail + password (Google button when enabled).
4. **Днес** (`/app`): greeting + date, today's workout as a large photo card (level chip, duration), primary
   „Започни“, week strip with done days, stat tiles (this week x/5, streak). Locked/past_due/plan states keep their
   existing logic, restyled (including the „Обнови картата“ banner).
5. **Тренировки** (`/app/library`): image-led workout cards; filter chips (level, duration, focus) — existing
   filter logic.
6. **Workout** (`/app/workout/[id]`): video on top (existing YouTube player), title, chips (level, duration,
   equipment), short description, primary „Завърших тренировката“.
7. **After workout**: celebration (streak, week progress), „Как беше?“ (Лесно / Точно / Трудно — existing rating),
   **„Сподели“** (below), then „Към днес“. For the free first workout this is followed by the plan offer.
8. **Plans** (`/app/plan`): monthly and yearly cards, yearly marked as best value; existing payment states
   („Скоро“, card-update state) restyled.
9. **Welcome** (`/app/welcome`): short „Добре дошла“, then into Днес.
10. **Прогрес**: weekly check-in form (existing) + sparkline/charts restyled as cards.
11. **Профил**: personal data, subscription status and manage button, data export/deletion — restyled.

## Share button (new behaviour)

- On the after-workout screen: **„Сподели“**.
- Generates a share image (e.g. 1080×1920 story and 1080×1080 square) with the platform look: workout name,
  streak („4 дни поред“), week progress („3/5 тази седмица“). Rendered server-side (`next/og` ImageResponse) from a
  route that only accepts the signed-in member's own completion and reads only those non-health fields.
- **Never** includes weight, measurements, goals, problems or any health/questionnaire data.
- Mobile: Web Share API with the image file + short text (+ landing URL); fallback (desktop / unsupported):
  download the image and copy the text/link.
- **Community share** („Сподели в общността“) is reserved: the button slot exists but appears only once the
  community (stage 7) is built.

## Constraints

- Code on a new branch off `plan-1c` (payments are not merged into `main` yet). No database or migration changes;
  no change to payment, auth, RLS or data logic — presentation, layout, copy and the share route only.
- Next 16 `cacheComponents` page pattern; env read only in `app/**`.
- All existing unit and DB tests keep passing; components touched keep their behaviour tests.
- Bulgarian UI copy, code/commits English.

## Testing / acceptance

- Existing suites green (`pnpm test`, `pnpm test:db`, typecheck, lint, build).
- Unit tests for the share-image data selection (no health fields can leak) and the share fallback logic.
- Browser check of every screen at 375×812 and 1280×800: no horizontal scroll, bottom bar on mobile, sidebar on
  desktop, one primary button per screen, AA contrast on text, reduced-motion respected.
- Screenshots of the key screens committed under `docs/screenshots/redesign/` and deployed to the Vercel link for
  the owner's review.

## Out of scope

Full admin redesign, dark mode, community, challenges, automations, gift voucher (backlog), real brand/logo,
real testimonials.
