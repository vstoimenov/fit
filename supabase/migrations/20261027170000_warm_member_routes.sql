-- Vercel keeps a separate function per route, so warming two public routes left every member page
-- cold after a pause (measured: 1.3 s instead of 0.4 s). The job now also asks for the member
-- pages, carrying `x-keep-warm: <cron_secret>` (Vault): the proxy lets such a request through and the
-- page answers with a redirect once its function is awake. Still removable with
--   select cron.unschedule('warm-every-5-min');
create or replace function public.run_warm_ping() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
  v_path text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url' limit 1;
  if v_url is null then
    return;
  end if;
  v_url := rtrim(v_url, '/');
  perform net.http_get(
    url := v_url || '/podari/blagodarya?session_id=cs_keepwarm_00000000',
    headers := jsonb_build_object('x-keep-warm', '1'),
    timeout_milliseconds := 15000
  );
  perform net.http_get(
    url := v_url || '/api/gift/status?session_id=cs_keepwarm_00000000',
    headers := jsonb_build_object('x-keep-warm', '1'),
    timeout_milliseconds := 15000
  );
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if v_secret is null then
    return;
  end if;
  foreach v_path in array array[
    '/app', '/app/library', '/app/nutrition', '/app/learn', '/app/profile', '/app/community',
    '/app/progress', '/app/challenges', '/app/plan', '/admin'
  ] loop
    perform net.http_get(
      url := v_url || v_path,
      headers := jsonb_build_object('x-keep-warm', v_secret),
      timeout_milliseconds := 15000
    );
  end loop;
end $$;
revoke execute on function public.run_warm_ping() from public, anon, authenticated;
