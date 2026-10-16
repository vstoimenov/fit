-- Stricter cover URLs: next/image cannot resolve a local file with a query string, so a local cover
-- is a plain /photos/ path (letters, digits, . _ / -) and an https one has no whitespace. The looser
-- inline check from the previous migration stays; this one is the stricter of the two.
alter table public.articles
  add constraint articles_cover_url_strict_check check (
    cover_url is null
    or (
      length(cover_url) <= 500
      and (cover_url ~ '^https://\S+$' or cover_url ~ '^/photos/[A-Za-z0-9._/-]+$')
    )
  );

-- Only the owner-admin writes articles, through RLS: take away the table-level extras explicitly.
revoke truncate, references, trigger on table public.articles from anon, authenticated;

do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on table public.articles from anon, authenticated';
  end if;
end $$;
