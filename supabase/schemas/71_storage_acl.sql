-- Storage authorization is intentionally narrow. Avatar reads are public by
-- product decision; uploads and deletes happen only through a signed URL or
-- the server-side service adapter. No browser role receives object DML.
create policy storage_avatars_public_read on storage.objects
for select to public
using (bucket_id = 'avatars');

create policy storage_question_assets_private on storage.objects
for select to authenticated
using (false);
