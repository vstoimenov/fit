-- At most 10 browser subscriptions per account, enforced in the database: an account cannot pile up
-- endpoints (which would slow every broadcast and the hourly job). A new device pushes out her
-- oldest one. Serialised per member so parallel inserts cannot slip past the cap.
create function public.push_subscriptions_cap() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('push_devices:' || new.user_id::text, 0));
  delete from public.push_subscriptions
  where id in (
    select id from public.push_subscriptions
    where user_id = new.user_id
    order by coalesce(last_used_at, created_at) desc, created_at desc
    offset 9
  );
  return new;
end $$;
revoke all on function public.push_subscriptions_cap() from public, anon, authenticated;

create trigger push_subscriptions_cap before insert on public.push_subscriptions
  for each row execute function public.push_subscriptions_cap();
