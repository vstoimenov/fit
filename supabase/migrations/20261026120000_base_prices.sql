-- Base prices for the public site: €29 / month, €257 / year. Offers (founders etc.) are
-- separate plan rows; Stripe price ids are attached when payments go live.
update public.plans set price_cents = 2900
 where name = 'Месечен' and interval = 'month' and active;
update public.plans set price_cents = 25700
 where name = 'Годишен' and interval = 'year' and active;
