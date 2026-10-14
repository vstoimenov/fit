-- Postgres 17 added the MAINTAIN table privilege (VACUUM, ANALYZE, REINDEX, CLUSTER, LOCK ...).
-- PostgREST never needs it for API roles. Guarded so the migration also applies on older servers.
do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on all tables in schema public from anon, authenticated';
    execute 'alter default privileges in schema public revoke maintain on tables from anon, authenticated';
  end if;
end $$;
