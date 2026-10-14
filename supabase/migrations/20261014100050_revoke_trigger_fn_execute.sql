-- Trigger functions are only ever invoked by their triggers; nobody should call them over RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
