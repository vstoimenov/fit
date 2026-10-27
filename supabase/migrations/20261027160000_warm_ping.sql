-- Test-phase keep-warm. With almost no traffic the Vercel functions go cold between visits and the
-- first page after a pause pays an extra second or more. Every five minutes the database asks for
-- two cheap public routes (a page and an API route; a bogus session id, nothing is written), so the
-- function pool stays warm. Harmless once real traffic keeps it warm by itself; remove with
--   select cron.unschedule('warm-every-5-min');
-- The site address comes from Vault (`app_url`, shared with the push job); without it nothing runs.
create function public.run_warm_ping() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url' limit 1;
  if v_url is null then
    return;
  end if;
  perform net.http_get(
    url := rtrim(v_url, '/') || '/podari/blagodarya?session_id=cs_keepwarm_00000000',
    headers := jsonb_build_object('x-keep-warm', '1'),
    timeout_milliseconds := 15000
  );
  perform net.http_get(
    url := rtrim(v_url, '/') || '/api/gift/status?session_id=cs_keepwarm_00000000',
    headers := jsonb_build_object('x-keep-warm', '1'),
    timeout_milliseconds := 15000
  );
end $$;
revoke execute on function public.run_warm_ping() from public, anon, authenticated;

select cron.schedule('warm-every-5-min', '*/5 * * * *', $$select public.run_warm_ping()$$);

-- For tests and the owner: is the job scheduled?
create function public.warm_cron_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('scheduled', true, 'schedule', j.schedule, 'active', j.active)
       from cron.job j where j.jobname = 'warm-every-5-min' limit 1),
    jsonb_build_object('scheduled', false)
  );
$$;
revoke execute on function public.warm_cron_status() from public, anon, authenticated;
grant execute on function public.warm_cron_status() to service_role;
