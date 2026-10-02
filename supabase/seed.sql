-- Local dev data, ported from src/mock/products.ts. `supabase db reset` runs it
-- after the migrations; it never runs on the hosted project.

insert into public.categories (slug, name, position) values
  ('designers', 'Designers', 1),
  ('electronics', 'Electronics', 2),
  ('clothing', 'Clothing', 3),
  ('shoes', 'Shoes', 4),
  ('bags', 'Bags', 5);

-- Sellers. The on_auth_user_created trigger creates their profiles.
insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', s.id, 'authenticated', 'authenticated',
  s.phone, now(),
  '{"provider": "phone", "providers": ["phone"]}', '{}', now(), now(),
  '', '', '', ''
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid, '22376000001'),
  ('00000000-0000-4000-8000-000000000002'::uuid, '22376000002'),
  ('00000000-0000-4000-8000-000000000003'::uuid, '22376000003'),
  ('00000000-0000-4000-8000-000000000004'::uuid, '22376000004'),
  ('00000000-0000-4000-8000-000000000005'::uuid, '22376000005'),
  ('00000000-0000-4000-8000-000000000006'::uuid, '22376000006')
) as s (id, phone);

update public.profiles p
set full_name = s.full_name, avatar_url = s.avatar_url
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'Aïcha Traoré', 'https://images.pexels.com/photos/762020/pexels-photo-762020.jpeg'),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'Mamadou Diallo', 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg'),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'Fatou Koné', 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg'),
  ('00000000-0000-4000-8000-000000000004'::uuid, 'Ibrahim Touré', 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg'),
  ('00000000-0000-4000-8000-000000000005'::uuid, 'Sira Coulibaly', 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg'),
  ('00000000-0000-4000-8000-000000000006'::uuid, 'Yacouba Sanogo', 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg')
) as s (id, full_name, avatar_url)
where p.id = s.id;

-- likes_count is set directly: the mock counts have no matching users
with seeded as (
  insert into public.products (id, seller_id, category_id, title, price, size, condition, likes_count, created_at)
  select s.id, s.seller_id, c.id, s.title, s.price, s.size, s.condition::public.product_condition, s.likes, now() - s.age
  from (values
    ('10000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, 'clothing', 'Vintage Denim Jacket', 23000, 'M', 'like_new', 12, interval '1 hour'),
    ('10000000-0000-4000-8000-000000000002'::uuid, '00000000-0000-4000-8000-000000000002'::uuid, 'shoes', 'Nike Air Force 1', 17200, '42', 'used', 34, interval '3 hours'),
    ('10000000-0000-4000-8000-000000000003'::uuid, '00000000-0000-4000-8000-000000000003'::uuid, 'designers', 'Minimalist Leather Handbag', 35000, 'One size', 'new', 5, interval '5 hours'),
    ('10000000-0000-4000-8000-000000000004'::uuid, '00000000-0000-4000-8000-000000000004'::uuid, 'clothing', 'Oversized Hoodie', 40000, 'L', 'good', 0, interval '1 day'),
    ('10000000-0000-4000-8000-000000000005'::uuid, '00000000-0000-4000-8000-000000000005'::uuid, 'designers', 'Summer Floral Dress', 28000, 'S', 'like_new', 10, interval '2 days'),
    ('10000000-0000-4000-8000-000000000006'::uuid, '00000000-0000-4000-8000-000000000006'::uuid, 'shoes', 'Casual Canvas Sneakers', 32000, '43', 'used', 20, interval '3 days')
  ) as s (id, seller_id, category_slug, title, price, size, condition, likes, age)
  join public.categories c on c.slug = s.category_slug
  returning id
)
select count(*) from seeded;

insert into public.product_images (product_id, path, position) values
  ('10000000-0000-4000-8000-000000000001', 'https://images.pexels.com/photos/13662420/pexels-photo-13662420.jpeg', 0),
  ('10000000-0000-4000-8000-000000000002', 'https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg', 0),
  ('10000000-0000-4000-8000-000000000003', 'https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg', 0),
  ('10000000-0000-4000-8000-000000000004', 'https://images.pexels.com/photos/9367505/pexels-photo-9367505.jpeg', 0),
  ('10000000-0000-4000-8000-000000000005', 'https://images.pexels.com/photos/19895983/pexels-photo-19895983.jpeg', 0),
  ('10000000-0000-4000-8000-000000000006', 'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg', 0);

-- Descriptions, so the details screen shows that section
update public.products p set description = s.description
from (values
  ('10000000-0000-4000-8000-000000000001'::uuid, 'Authentic 90s denim, slightly worn for that perfect look. Size M but fits like an L.'),
  ('10000000-0000-4000-8000-000000000002'::uuid, 'Worn a few times, soles in good shape. Comes with the original box.'),
  ('10000000-0000-4000-8000-000000000003'::uuid, 'Genuine leather, never used. Fits a phone, wallet and keys.'),
  ('10000000-0000-4000-8000-000000000005'::uuid, 'Light cotton, perfect for the hot season. Worn once for a wedding.')
) as s (id, description)
where p.id = s.id;
