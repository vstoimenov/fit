-- Storage update/remove/upsert first look the object up, so admins also need SELECT on it.
create policy thumbnails_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'thumbnails' and (select public.is_admin()));

-- History must survive at the database level too: a workout somebody completed cannot be deleted
-- (RLS already hides such rows from admins; this stops service-role and SQL deletes as well).
alter table public.workout_completions
  drop constraint workout_completions_workout_id_fkey,
  add constraint workout_completions_workout_id_fkey
    foreign key (workout_id) references public.workouts (id) on delete restrict;
