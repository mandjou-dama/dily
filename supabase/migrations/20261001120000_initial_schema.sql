-- Dily initial schema: profiles, catalog, likes and chat.
-- Prices are whole F CFA (XOF has no minor unit). Image columns hold a Storage
-- path; a value starting with "http" is an external URL (seed data only).

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user, created by trigger on sign-up)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) between 1 and 80),
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table public.categories (
  id smallint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  position smallint not null default 0
);

create type public.product_status as enum ('active', 'sold', 'archived');
create type public.product_condition as enum ('new', 'like_new', 'good', 'used');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  category_id smallint references public.categories (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 2000),
  price integer not null check (price >= 0),
  currency char(3) not null default 'XOF',
  size text check (char_length(size) <= 20),
  condition public.product_condition not null default 'good',
  status public.product_status not null default 'active',
  -- Maintained by the likes trigger, never written by clients
  likes_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_feed_idx on public.products (status, created_at desc);
create index products_category_feed_idx on public.products (category_id, status, created_at desc);
create index products_seller_idx on public.products (seller_id, created_at desc);
create index products_title_trgm_idx on public.products using gin (title extensions.gin_trgm_ops);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, position)
);

-- ---------------------------------------------------------------------------
-- Likes (+ counter on products)
-- ---------------------------------------------------------------------------

create table public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index likes_product_idx on public.likes (product_id);

create function public.update_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.products set likes_count = likes_count + 1 where id = new.product_id;
  elsif tg_op = 'DELETE' then
    update public.products set likes_count = greatest(likes_count - 1, 0) where id = old.product_id;
  end if;
  return null;
end;
$$;

create trigger likes_update_count
  after insert or delete on public.likes
  for each row execute function public.update_likes_count();

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (product_id, buyer_id),
  check (buyer_id <> seller_id)
);

create index conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index conversations_seller_idx on public.conversations (seller_id, last_message_at desc);

create table public.messages (
  -- Client-generated ids allow optimistic sends without duplicates
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

create function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return null;
end;
$$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

create function public.is_conversation_member(conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id = conversation
      and (select auth.uid()) in (c.buyer_id, c.seller_id)
  );
$$;

alter publication supabase_realtime add table public.messages;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.likes enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Profiles: public (seller name and avatar on cards), editable by their owner
create policy "Profiles are public"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- The phone comes from auth and is not editable here
revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- Categories: read-only for clients
create policy "Categories are public"
  on public.categories for select
  to anon, authenticated
  using (true);

-- Products: active and sold are public, archived only for the seller
create policy "Visible products are public"
  on public.products for select
  to anon, authenticated
  using (status <> 'archived' or (select auth.uid()) = seller_id);

create policy "Sellers create their own products"
  on public.products for insert
  to authenticated
  with check ((select auth.uid()) = seller_id);

create policy "Sellers update their own products"
  on public.products for update
  to authenticated
  using ((select auth.uid()) = seller_id)
  with check ((select auth.uid()) = seller_id);

create policy "Sellers delete their own products"
  on public.products for delete
  to authenticated
  using ((select auth.uid()) = seller_id);

-- Clients edit listing fields only: likes_count is written by the trigger
revoke update on public.products from anon, authenticated;
grant update (category_id, title, description, price, currency, size, condition, status)
  on public.products to authenticated;

-- Product images follow their product
create policy "Images of visible products are public"
  on public.product_images for select
  to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id));

create policy "Sellers manage their product images"
  on public.product_images for all
  to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id and p.seller_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.products p
    where p.id = product_id and p.seller_id = (select auth.uid())
  ));

-- Likes: each user sees and changes only their own
create policy "Users read their own likes"
  on public.likes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users like as themselves"
  on public.likes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users unlike as themselves"
  on public.likes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Conversations: only the two participants; a buyer opens one on someone
-- else's active product
create policy "Participants read their conversations"
  on public.conversations for select
  to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));

create policy "Buyers start a conversation"
  on public.conversations for insert
  to authenticated
  with check (
    (select auth.uid()) = buyer_id
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.seller_id = conversations.seller_id and p.status = 'active'
    )
  );

-- Messages: participants read and send; only read_at can be updated, and only
-- on messages received
create policy "Participants read messages"
  on public.messages for select
  to authenticated
  using (public.is_conversation_member(conversation_id));

create policy "Participants send messages as themselves"
  on public.messages for insert
  to authenticated
  with check (
    (select auth.uid()) = sender_id
    and public.is_conversation_member(conversation_id)
  );

create policy "Recipients mark messages as read"
  on public.messages for update
  to authenticated
  using (public.is_conversation_member(conversation_id) and (select auth.uid()) <> sender_id)
  with check (public.is_conversation_member(conversation_id) and (select auth.uid()) <> sender_id);

revoke update on public.messages from anon, authenticated;
grant update (read_at) on public.messages to authenticated;
