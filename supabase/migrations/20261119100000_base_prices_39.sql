-- Official base prices from 19 November 2026: €39 / month and the year at 40% off twelve months
-- (12 × €39 = €468 → €280.80). Offers (founders, campaigns) stay separate plan rows.
update public.plans set price_cents = 3900
 where name = 'Месечен' and interval = 'month' and active;
update public.plans set price_cents = 28080
 where name = 'Годишен' and interval = 'year' and active;
