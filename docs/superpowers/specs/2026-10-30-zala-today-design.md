# „Днес“ — attendance for in-person trainings — design

**Intent.** Аксения opens „На място“ on her phone at the start of a training and, in a few taps, sees who booked, ticks who came, adds whoever walks in, and knows how much cash to collect. The notebook becomes unnecessary. Approved in chat on 30.10.2026 (variant A).

**Rules (unchanged):** a visit is still taken at booking; the tick is information only (who came, who owes 7 €). No „Не дойде“ button: not ticked = did not come. No push to Аксения on bookings.

## Screen „Днес“ (`/admin/zala`, first and default tab, key `dnes`)
- Shows today's trainings (Sofia date); if today has none, the next date that has a non-cancelled training, with that date in the heading.
- One card per training: „10:00 · Събота сила“ and „Дошли 5 от 8“.
- One large row per booked client: name; phone as a `tel:` link; payment („Карта 8 · остават 5“ or a pink „7 € на място“; „над лимита“ when over the limit); a large toggle „Дошла ✓“ (tap = ticked, tap again = unticked). Optimistic, no page reload.
- Under the list: „7 € на място: N записани · M дошли = M×7 €“ (cash to collect = ticked drop-ins).
- „+ На вратата“: a search box over **all** clients (gym and online, by name or phone, min 2 characters, up to 10 results, those already on the list are left out). Tap a result → booked for that training and ticked at once. „Нова клиентка“ (name + phone) does the same for someone not in the system.
- A cancelled training shows „Отменена“ and no toggles.

## Elsewhere
- The roster page of any training (also from „Тренировки“ / „Минали“) shows the same tick, so past trainings can be checked and corrected.

## Data
- `studio_bookings.attended_at timestamptz null`.
- `studio_set_attended(p_booking_id uuid, p_attended boolean)`: admin only, booked bookings only.
- Door add = existing `studio_admin_add` (over the limit allowed) + `studio_set_attended`.

## Non-goals
Attendance affecting the visit count; notifications; client-side display of attendance; statistics.
