-- Public buckets: anyone can read through the public URL. Uploads go under a
-- folder named after the user id, e.g. "<uid>/avatar.jpg" or
-- "<uid>/<product id>/0.jpg", so each user only writes their own folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']),
  ('product-images', 'product-images', true, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Users upload to their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('avatars', 'product-images')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users update their own files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('avatars', 'product-images')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users delete their own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('avatars', 'product-images')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Needed for upserts (overwriting an avatar), which read the existing object
create policy "Users read their own files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('avatars', 'product-images')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
