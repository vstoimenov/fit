# Fit platform (I AM STRONG) — nutrition: food diary with calorie count, then generated menus

Date: 2026-10-23. Status: talked through with the owner in chat; the owner said „ок“ to the playback below.
Where a line says *(controller's call)* the owner handed the decision over („направи го както трябва“).

## Why

Members want to know what they eat, not just how they train. The owner asked for two things:
1. „да вкара какво е яла и да го изчисли и накрая на деня да има резултат … 1 месец назад ден по ден колко калории“ —
   a food diary that counts calories, with a day result and a 30-day day-by-day history.
2. „отделно да има изготвяне на менюта“ — menus made by the system itself, from meals the owner controls in the
   admin panel; the member is asked which way of eating she prefers and whether she has allergies.
And „да е интерактивно“.

Built in two parts, each planned, reviewed and merged separately: **Part 1 — diary + calorie target + nutrition
questions**, then **Part 2 — meal library in admin + generated menus**.

## Goals

- She types what she ate in her own words and gets calories and macros in seconds, with a breakdown she can correct.
- She sees today against her target, the day's result, and the last 30 days day by day.
- She answers a few questions once (diet, allergies, foods she avoids, meals per day, birth year, activity).
- Part 2: she gets a daily menu that fits her target and never contains her allergens; she can swap a dish or mark it
  eaten (it lands in the diary).
- The owner manages the meals; menus are composed automatically from them.

## Non-goals

- Barcode scanning, photo recognition of food, water tracking, micronutrients, sync with health apps (the existing
  „Скоро“ card stays).
- Medical or clinical nutrition (diabetes, pregnancy plans, eating disorders treatment).
- Coach/admin access to her diary (not in this spec; same privacy stance as progress photos).
- Points for logging food (would invite fake logging) *(controller's call)*.
- Shopping lists, weekly meal prep, recipes written by AI without the owner's approval.

## Anti-goals (failure even if it works)

- A dish containing one of her declared allergens appears in her menu.
- A calorie target that pushes a woman below a safe intake, or shaming copy („провал“, red alarms, „прекали“).
- Calorie numbers presented as exact when they are estimates.
- Her food text being used as instructions by the AI (prompt injection) or sent anywhere except the estimate call.
- The app breaks or becomes unusable when the AI is unavailable or the API key is missing.

## Part 1 — diary, target, questions

### Nutrition questions
Asked in onboarding for new members (new step after the existing questions) and, for existing members, the first
time they open „Хранене“; editable in Профил. Stored on `profiles`:
- `birth_year` (1940 … current year − 16), `activity_level`: `sedentary` „Седя през повечето време“, `light`
  „Малко движение“, `moderate` „Движа се доста“, `active` „Много активна“.
- `diet`: `omnivore` „Ям всичко“, `vegetarian` „Вегетарианка“, `vegan` „Веган“, `pescatarian` „Пескетарианка“.
- `allergens text[]` from the 14 EU allergens: gluten, crustaceans, eggs, fish, peanuts, soy, milk, nuts, celery,
  mustard, sesame, sulphites, lupin, molluscs (Bulgarian labels: Глутен, Ракообразни, Яйца, Риба, Фъстъци, Соя,
  Мляко и лактоза, Ядки, Целина, Синап, Сусам, Сулфити, Лупина, Мекотели).
- `avoid_foods text` (free, ≤ 200 chars) „Храни, които не ям“.
- `meals_per_day` 3 | 4 | 5 (used in Part 2).
These count as health data: covered by the existing health-data consent; included in export; deleted with the account.

### Calorie target (pure TS, unit-tested)
- Mifflin-St Jeor for women: `10·kg + 6.25·cm − 5·age − 161`; × activity 1.2 / 1.375 / 1.55 / 1.725.
- Weight = latest check-in weight, else profile weight. Missing height/weight/birth year → no target, the diary
  still works and shows „Добави ръст, тегло и година на раждане, за да изчислим целта ти“.
- Goal `lose_weight` → −15 %; other goals → maintenance. Never below **1 200 kcal**. Rounded to 10.
- Macros guide: protein 1.6 g/kg (capped at 30 % of kcal), fat 30 % of kcal, carbs the rest.
- Shown with „≈“ and a one-line note: „Ориентир, не медицински съвет.“

### Food diary — screen „Хранене“ (`/app/nutrition`)
- Header: date with ‹ › and horizontal swipe between days (no future days); a ring that fills as she logs
  („1 340 / 1 650 ккал“, „остават 310“) and three thin bars for protein / carbs / fat.
- Four meal groups: Закуска, Обяд, Вечеря, Междинно — each lists its entries (name, amount, ≈ kcal) and has
  „+ Добави“.
- **Add flow (interactive):** a sheet with a text field („Какво яде?“, e.g. „пилешка салата и филия пълнозърнест
  хляб“) and the meal pre-selected. „Изчисли“ sends it to the estimate; the breakdown appears item by item (name,
  grams, kcal, P/C/F); each row's grams can be changed inline and its values rescale live; rows can be removed;
  „Запиши“ saves all rows as entries. The ring animates to the new total.
- **Quick add:** her 10 most recent distinct foods as chips (one tap adds with the last amount) and, from Part 2,
  today's menu dishes.
- **Manual entry** is always available („Въведи ръчно“: name + kcal, optional P/C/F) — also the fallback when the AI
  is off or fails.
- Entries are editable (amount) and deletable in place; the day total updates optimistically.
- **Day result** (shown for past days, and today after 20:00 Sofia): „В целта“ (within ±10 %), „Под целта“,
  „Над целта“, neutral colours (powder/sand/ink; no red), with the day's macros.
- **History** (`/app/nutrition/history`): 30 days, a bar per day with the target line, and a list „чт, 22 окт —
  1 580 ккал“; days without entries say „няма записи“; tapping a day opens it.
- Начало gets a small card „Хранене днес: 1 340 / 1 650 ккал“ → `/app/nutrition`.
- Nav gets a tab „Хранене“ *(controller's call; the planned Общност tab will need a nav decision in its phase)*.

### AI estimate *(controller's call: AI free-text, owner chose „направи го както трябва“)*
- Server-side only (server action / route under `src/app/**`), Claude **Haiku 5.5** (`claude-haiku-5-5`), structured
  JSON output validated with zod: up to 12 items `{ name, grams, kcal, protein_g, carbs_g, fat_g }`; per item kcal
  0…3 000, grams 1…2 000. Implementation loads the `claude-api` skill first.
- Her text (≤ 300 chars) goes into the user message as data; the system prompt tells the model to treat it only as a
  food description, Bulgarian portions, and to return an empty list for anything that is not food.
- Limit: 60 estimates per member per Sofia day (counted in a small table); over the limit → „Днес достигна лимита
  за изчисления. Въведи ръчно.“
- Key `ANTHROPIC_API_KEY` in env (read only in `src/app/**`). No key → the text field is replaced by manual entry
  with „Изчисляването с думи скоро ще е включено.“ Tests use a stub estimator behind an interface.
- Errors/timeouts (10 s) → „Не успяхме да изчислим. Опитай пак или въведи ръчно.“

### Data
- `food_entries(id, user_id → profiles cascade, eaten_on date, meal enum breakfast|lunch|dinner|snack, name text
  ≤ 120, grams numeric null, kcal int 0…5 000, protein_g/carbs_g/fat_g numeric(6,1) ≥ 0, source enum
  ai|manual|recent|menu, created_at)`; RLS: she reads/writes only her own rows; `eaten_on` not in the future
  (Sofia) and not older than 1 year; max 100 entries per day.
- `nutrition_ai_calls(user_id, called_at)` for the daily limit (no text stored).
- Export includes food entries and the nutrition answers; account deletion cascades.
- New migrations only, explicit revokes, `search_path = ''` on definer functions (project rules).

## Part 2 — meal library and generated menus

### Admin: „Ястия“ (`/admin/meals`)
- List with filters (meal type, diet, published), counts per diet and meal type („за вегани: 4 закуски, 2 обяда…“) so
  the owner sees gaps.
- Meal form: title, meal types (one or more of закуска/обяд/вечеря/междинно), ingredients `{name, grams}[]`,
  kcal + P/C/F per portion, diets it fits (vegetarian / vegan / pescatarian flags; omnivore always), allergens (the
  14), preparation steps (Markdown, same renderer as articles), optional photo (thumbnails bucket pattern), published.
- „Попълни с AI“: from the title (and optional notes) the AI drafts ingredients, macros and allergens into the form;
  nothing is saved until the owner presses „Запази“. Allergen checkboxes stay the owner's responsibility (a note
  under them says so).
- Audit trigger like other admin tables.

### Member: „Меню за днес“ (tab inside „Хранене“)
- Slots by `meals_per_day`: 3 → закуска 25 % / обяд 40 % / вечеря 35 %; 4 → 25/35/30 + междинно 10; 5 → 20/35/25 +
  2 × междинно 10.
- For each slot the system picks a published meal of that type that fits her diet, contains none of her allergens
  and none of her `avoid_foods` words (case-insensitive match on title + ingredient names), not used in her menu in
  the previous 2 days, closest to the slot's kcal; portion factor 0.75–1.5 (shown „порция ×1,2“) to land the day
  within ±10 % of target. Deterministic per (member, date) so the menu is stable; swaps are stored
  (`menu_swaps(user_id, menu_date, slot, meal_id)`).
- Each dish card: photo, title, ≈ kcal, P/C/F, „Смени“ (next best candidate), „Изядох го“ (adds a `menu` entry to
  the diary with the portion's values), tap → recipe.
- Not enough meals for her filters → „Менюто ти се подготвя — скоро ще има ястия за теб.“ (admin sees the gap).
- Allergy note under the menu: „Провери етикетите на продуктите — при алергия бъди внимателна.“
- Без цел (missing data) → the menu uses 1 800 kcal and says so.

## Settled after the builder check

- **Access (owner):** „Хранене“ is for members with access (`my_access()`, the one access rule — covers admins,
  grace, canceled-until-period-end). Without access she sees her past diary and history read-only, with the plan
  CTA; no new entries, no AI estimates, no menu. The Начало card shows only with access.
- **Meals for Part 2 (owner):** the owner enters the recipes in the admin panel before launch; no seed set is built.
  Until meals exist the „Меню за днес“ tab shows the „Менюто ти се подготвя“ state.

- **Audience:** the product is for women (brand, landing, copy); the female formula and feminine copy stand.
- **Under 18** (from `birth_year`): maintenance target only, never a deficit *(controller's call)*.
- **Day boundaries:** Europe/Sofia for everyone, like the rest of the app *(controller's call)*.
- **Model:** `claude-haiku-5-5` as the default, overridable by env `NUTRITION_AI_MODEL`; `@anthropic-ai/sdk` is added.
  Admin „Попълни с AI“ has its own limit of 200 drafts per day for all admins *(controller's call)*.
- **Third-party processing:** the add sheet says „Текстът се изпраща за изчисление на калориите. Не пиши лични данни.“;
  the go-live checklist gets „privacy policy: list Anthropic as a processor for the nutrition estimate“ *(controller's
  call; legal pages are an existing open item)*.
- **Branching:** Part 1 branches from `progress-photos`; Part 2 stacks on Part 1. Migrations are timestamped after
  `20261023100000_progress_photos.sql`.

## Constraints

Redesign rules (tokens ink/sand/powder/powder-light/powder-chip/rose-deep/ink-soft/line, Manrope, powder never as
text colour, one primary button per screen, 44 px targets, lucide, Bulgarian copy); motion for the ring/sheet
animations; Next 16 cacheComponents page pattern (sync export → Suspense → async inner with `await connection()`);
env only in `src/app/**`; services testable without env; TDD; vitest unit + `supabase/tests` DB tests; branch from
`progress-photos` *(controller's call: the owner has not yet chosen how to merge earlier branches)*.

## Left to the builder

Component split, exact animation timings, chart rendering (SVG like the existing sparkline), the stub estimator,
query shapes for the 30-day summary, minor labels within the rules above.
