-- Defense in depth: PostgREST never needs these table-level privileges.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
