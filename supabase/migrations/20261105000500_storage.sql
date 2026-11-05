-- =============================================================================
-- Tropa · 0005 · Storage
--
--   branding    (público)  {club_id}/logo-*.webp              → staff del club escribe
--   avatars     (público)  {user_id}/*.webp                   → cada usuario lo suyo
--   club-files  (privado)  {club_id}/{categoria}/{user_id}/…   → URLs firmadas
--       categorías del staff (las ve todo el club): announcements, products, events
--       categorías personales (las ve el dueño + staff): receipts, medical
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('branding',   'branding',   true,  2097152, array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('avatars',    'avatars',    true,  1048576, array['image/png','image/jpeg','image/webp']),
  ('club-files', 'club-files', false, 5242880, array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do nothing;

-- branding
create policy "branding: public read" on storage.objects for select
  using (bucket_id = 'branding');
create policy "branding: staff upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.club_id_from_path(name) in (select public.my_staff_club_ids()));
create policy "branding: staff update" on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.club_id_from_path(name) in (select public.my_staff_club_ids()));
create policy "branding: staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and public.club_id_from_path(name) in (select public.my_staff_club_ids()));

-- avatars
create policy "avatars: public read" on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars: own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);
create policy "avatars: own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);
create policy "avatars: own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

-- club-files
create policy "club-files: read" on storage.objects for select to authenticated
  using (
    bucket_id = 'club-files' and (
      public.club_id_from_path(name) in (select public.my_staff_club_ids())
      or (
        public.club_id_from_path(name) in (select public.my_club_ids())
        and (
          split_part(name, '/', 2) in ('announcements', 'products', 'events')
          or split_part(name, '/', 3) = (select auth.uid())::text
        )
      )
    )
  );
create policy "club-files: upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'club-files' and (
      (split_part(name, '/', 2) in ('announcements', 'products', 'events')
        and public.club_id_from_path(name) in (select public.my_staff_club_ids()))
      or (split_part(name, '/', 2) in ('receipts', 'medical')
        and public.club_id_from_path(name) in (select public.my_club_ids())
        and split_part(name, '/', 3) = (select auth.uid())::text)
    )
  );
create policy "club-files: delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'club-files' and (
      public.club_id_from_path(name) in (select public.my_staff_club_ids())
      or (public.club_id_from_path(name) in (select public.my_club_ids())
          and split_part(name, '/', 3) = (select auth.uid())::text)
    )
  );
