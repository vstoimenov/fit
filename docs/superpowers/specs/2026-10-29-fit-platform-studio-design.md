# In-person trainings („На място“) — design

**Intent.** Аксения leads group trainings in a gym. Today clients book by private message and she keeps a paper notebook of how many visits each client's card has left; clients cannot see it. This feature replaces both: a public schedule with free spots where clients book themselves, punch cards tracked by the app, and a client page that shows how many visits are left and until when. The owner's brief: „максимално просто и лесно за работа и за нея и за клиентките“.

**Success.** Аксения stops taking bookings by DM and stops using the notebook. Her only routine work is (1) giving a client a card when she pays and (2) adding the occasional walk-in. A client knows at any time how many visits she has left.

## The rules (decided with the owner)

- **Cards** (from her price list):

  | Card | Price | Visits | Valid |
  |---|---|---|---|
  | Еднократна | 7 € | 1 | that one training |
  | Карта 8 | 50 € | 8 | 4 weeks |
  | Карта 12 | 60 € | 12 | 6 weeks |

- **A visit is used when she books**, not when she arrives. No QR, no check-in.
- **Cancel up to 6 hours before the start** → the visit comes back. Later than that she cannot cancel in the app; a no-show keeps the visit used.
- **Unused visits expire** with the card (the price list says „валидност“).
- **Payment is on site** (cash or bank), outside the app. Аксения gives the card in the admin once the client has paid.

## Who does what

**Client** (separate entry point, not the online club)
- `iamstrong.bg/na-myasto` — public, no login needed to look: the coming two weeks of trainings, each with day, time, title and „Остават N места“ / „Няма места“.
- „Запиши се“ → if signed out, a short sign-up on the same page: name, phone (required), e-mail, password, consent line linking /terms and /privacy. „Имам профил“ → `/login?next=/na-myasto`. No 7 questions, no install/push gate, no online membership needed.
- Signed in, the page also shows her card: „Карта 8 · остават 5 посещения · валидна до 26.11“, her upcoming bookings with „Откажи“ (until 6 h before), and her past visits.
- Booking with a valid card that covers the training date and has visits left → one visit is taken from it, shown immediately.
- Booking with no such card is still allowed: the booking is marked „Еднократна — плащаш 7 € на място“ and the confirmation says so.
- Warning shown on her page (and as a push if she happens to have push on): when 1 visit is left, and when the card ends within 3 days.

**Аксения** (admin, new nav item „На място“ → `/admin/na-myasto`)
- **График**: weekly repeating slots — weekday, start time, duration, title (e.g. „Кръгова тренировка“), number of spots. Set once; edits affect future trainings that have no bookings yet. She can cancel one dated training (e.g. a holiday); everyone booked gets the visit back and is notified.
- **Тренировки**: the upcoming dated trainings; opening one shows the list of booked clients (name, phone, which card or „7 € на място“). „Добави“ adds a walk-in by searching an existing client or quick-creating one by name + phone (no e-mail needed for a walk-in who will never log in — builder decides how such a profile is stored, see below). She can also remove a booking (mistake) — the visit comes back.
- **Клиентки**: everyone with an in-person card or booking — name, phone, current card, visits left, valid until, „изтича скоро“ highlight. „Дай карта“ → pick Карта 8 / Карта 12, start date (default today) → done. She can void a card given by mistake.

## Decisions I (Claude) made — the owner can overturn them

- Card validity: last valid day = start date + 7 × weeks − 1 (Карта 8 bought Monday 3.11 → valid through Sunday 30.11), Europe/Sofia dates. A booking may use the card only if the training's date is within that range.
- If she has two valid cards, the one that ends first is used.
- Prices and card types are fixed constants in code (three cards above), not editable in admin.
- Booking opens for the coming 14 days and closes at the training's start. Booking inside the last 6 h is allowed, with a note that it can no longer be cancelled.
- Drop-in (7 €) bookings count toward the spots like any other and can be cancelled on the same 6 h rule.
- One booking per client per training.
- In-person clients are ordinary accounts (`profiles`); they simply never do the online onboarding. Signing in from `/login` with no `next` must land them on `/na-myasto`, not bounce them into `/start`. An online member can use `/na-myasto` with the same account.
- The admin client detail page (`/admin/clients/[id]`) shows her in-person card and bookings too.
- **Moving the notebook over.** „Дай карта“ also takes an optional start date in the past and „вече използвани посещения“ (default 0), so a client mid-card on launch day gets e.g. Карта 8 from 20.10 with 5 used → 3 left. The used count is stored on the card and shown to the client as „пренесени от тефтера: 5“, so her number always has a visible reason.
- **Drop-in, then a card.** When Аксения gives a card, the client's existing „7 € на място“ bookings whose dates fall inside the card's range (today included, past ones too) move onto the card, oldest first, as far as its visits go — in the same step. The confirmation tells Аксения how many moved.
- **Walk-ins and their own login.** A walk-in Аксения adds is a real client profile with name + phone and no login. On that client's admin page she has „Покана“ → a one-time link (copy to WhatsApp/Viber) where the client sets e-mail and password on that same profile, so card and history follow her. No automatic matching by phone (a phone is not proof of identity).
- **Voiding a card** is possible only while no visit has been taken from it; a card already in use is fixed with „Коригирай“ (± visits, with a reason), shown in her history.
- **Full training.** Clients cannot book a full training; Аксения can still add a walk-in beyond the limit (she sees the room), with a „над лимита“ warning.
- **Online club stays clean.** In-person-only clients (no online onboarding, no subscription) are left out of the online club's admin reports (at-risk, activity, client stats) and of broadcast pushes; they appear under „На място“ and in the client list with an „На място“ badge.
- Privacy policy and terms get a short section: what we store for in-person trainings (bookings, visits, cards) and the booking/cancel/expiry rules.

## Non-goals

Online payment for cards; waiting list when full; QR or any arrival check-in; multiple trainers or locations; e-mail notifications (no mail provider is set up yet); editable price list; recurring automatic booking.

## Anti-goals (would make it a failure even if it works)

- Two clients get the last spot at the same time (overbooking).
- A client's visit count is wrong or changes without a visible reason — every change to her count must trace back to a booking, a cancellation, a card, or Аксения's action.
- Аксения has to do more steps than with the notebook.
- An in-person client gets pushed into the online club's questionnaire, install prompt or paywall.

## Constraints

- Existing stack and patterns: Next 16 (cacheComponents), React 19, Supabase with RLS, security-definer RPCs for state changes that must be atomic (see `attend_live`, `redeem_gift_voucher`), `audit_row` triggers on admin-edited tables, admin pages under `src/app/admin/(panel)`, nav in `src/components/admin/admin-nav.tsx`, push via `src/server/push/send.ts` `sendToUsers`.
- Booking, cancelling and walk-in must be atomic against the spot count and the card's remaining visits (row lock or equivalent in one DB function).
- All times in Europe/Sofia.
- Copy in Bulgarian, informal „ти“, female forms.
- TDD; DB behaviour covered by `supabase/tests` integration tests.
- Hosted migration and deploy are run by the owner (one copy-paste command each).

## Left to the builder

Table and function names and shapes; whether dated trainings are materialised ahead from the weekly slots or computed; how a walk-in without e-mail is represented (e.g. admin-created profile without login); page layout and components within the existing design system; how the 3-days/1-visit warnings are scheduled (existing push cron or computed on page view).
