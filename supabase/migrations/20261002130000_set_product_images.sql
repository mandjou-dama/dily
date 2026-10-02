-- Replaces a listing's photos in one transaction: the app sends the final
-- ordered list of Storage paths (kept, reordered and newly uploaded), so an
-- edit can never leave a listing half updated. Runs as the caller: the
-- "Sellers manage their product images" policy still decides who may write.

create function public.set_product_images(product uuid, paths text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(array_length(paths, 1), 0) not between 1 and 8 then
    raise exception 'A listing needs between 1 and 8 photos'
      using errcode = 'check_violation';
  end if;

  -- Only files from the caller's own Storage folder
  if exists (
    select 1 from unnest(paths) as p
    where split_part(p, '/', 1) <> (select auth.uid())::text
  ) then
    raise exception 'Photos must be uploaded by the seller'
      using errcode = 'insufficient_privilege';
  end if;

  delete from public.product_images where product_id = product;

  insert into public.product_images (product_id, path, position)
  select product, t.path, (t.ord - 1)::smallint
  from unnest(paths) with ordinality as t (path, ord);
end;
$$;

revoke execute on function public.set_product_images(uuid, text[]) from public, anon;
grant execute on function public.set_product_images(uuid, text[]) to authenticated;
