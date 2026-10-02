-- Where a seller meets buyers. Dily is local-first: buyers pick sellers
-- they can reach, so the details screen shows "Hamdallaye ACI, Bamako".
-- Free text for now; a fixed list of quartiers can replace it later.

alter table public.profiles
  add column neighbourhood text check (char_length(neighbourhood) between 1 and 60),
  add column city text not null default 'Bamako' check (char_length(city) between 1 and 40);

-- Column grants from the initial schema: owners edit these too
grant update (neighbourhood, city) on public.profiles to authenticated;
