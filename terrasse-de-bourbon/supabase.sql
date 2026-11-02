-- La Terrasse de Bourbon · base de réservations (Supabase)
-- À coller une seule fois dans Supabase > SQL Editor > New query > Run.
--
-- Principe :
--   • Le public n'accède jamais directement aux tables. Il passe par trois fonctions :
--     submit_reservation (envoyer une demande), reservation_status (suivre sa demande
--     avec son jeton secret) et cancel_reservation (l'annuler).
--   • Seuls les comptes listés dans la table staff lisent et modifient les réservations.

create extension if not exists pgcrypto;

-- ── Tables ─────────────────────────────────────────────────
create table if not exists public.staff (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id           uuid primary key default gen_random_uuid(),
  access_token uuid not null unique default gen_random_uuid(),   -- lien de suivi du client
  name         text not null check (char_length(name) between 1 and 80),
  tel          text check (char_length(tel) <= 30),
  guests       int  not null check (guests between 1 and 40),
  date         date not null,
  time         text not null check (time ~ '^[0-2][0-9]h[0-5][0-9]$'),
  zone         text not null default '' check (zone in ('', 'int', 'ext', 'ter', 'rof')),
  notes        text check (char_length(notes) <= 500),
  table_id     text not null default '',
  status       text not null default 'pending' check (status in ('pending', 'confirmed', 'declined', 'cancelled')),
  src          text not null default 'web' check (src in ('web', 'staff', 'scan')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.reservations add column if not exists marketing_opt_in boolean not null default false;
create index if not exists reservations_date_idx   on public.reservations (date);
create index if not exists reservations_status_idx on public.reservations (status);

create table if not exists public.occupancy (          -- tables marquées occupées à la main
  key        text primary key,                          -- ex. 2026-11-06_soir
  tables     jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists reservations_touch on public.reservations;
create trigger reservations_touch before update on public.reservations
  for each row execute function public.touch_updated_at();
drop trigger if exists occupancy_touch on public.occupancy;
create trigger occupancy_touch before update on public.occupancy
  for each row execute function public.touch_updated_at();

-- ── Accès équipe ───────────────────────────────────────────
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid());
$$;

alter table public.staff        enable row level security;
alter table public.reservations enable row level security;
alter table public.occupancy    enable row level security;

drop policy if exists staff_read_self on public.staff;
create policy staff_read_self on public.staff for select to authenticated using (user_id = auth.uid());

drop policy if exists staff_reservations on public.reservations;
create policy staff_reservations on public.reservations for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists staff_occupancy on public.occupancy;
create policy staff_occupancy on public.occupancy for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ── Fonctions publiques (page client) ──────────────────────
drop function if exists public.submit_reservation(text, text, int, date, text, text, text);
create or replace function public.submit_reservation(
  p_name text, p_tel text, p_guests int, p_date date, p_time text, p_zone text, p_notes text, p_opt_in boolean default false
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_today  date := (now() at time zone 'Indian/Reunion')::date;
  v_out    json;
  v_svc    text;
  v_closed jsonb;
begin
  -- Champs obligatoires : nom, téléphone joignable, nombre de personnes, date et heure.
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'nom_requis'; end if;
  if length(regexp_replace(coalesce(p_tel, ''), '[^0-9]', '', 'g')) not between 9 and 15 then raise exception 'tel_requis'; end if;
  if p_guests is null or p_guests < 1 then raise exception 'personnes_requis'; end if;
  if p_date is null or p_time is null then raise exception 'creneau_requis'; end if;
  if p_date < v_today or p_date > v_today + 180 then
    raise exception 'date_invalide';
  end if;
  -- Jours de fermeture par service, réglés dans le hub (Réglages > Services et horaires).
  v_svc := case when split_part(p_time, 'h', 1)::int < 16 then 'midi' when split_part(p_time, 'h', 1)::int < 19 then 'hh' else 'soir' end;
  select coalesce(data->'closed', '{"hh":[0],"soir":[0]}'::jsonb) into v_closed from settings where id = 1;
  if coalesce(v_closed, '{"hh":[0],"soir":[0]}'::jsonb)->v_svc @> to_jsonb(extract(dow from p_date)::int) then
    raise exception 'service_ferme';
  end if;
  -- Garde-fous contre les envois en rafale.
  if nullif(trim(p_tel), '') is not null and (
    select count(*) from reservations
    where tel = trim(p_tel) and status = 'pending' and created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'trop_de_demandes';
  end if;
  if (select count(*) from reservations where src = 'web' and created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'trop_de_demandes';
  end if;

  insert into reservations (name, tel, guests, date, time, zone, notes, src, status, marketing_opt_in)
  values (trim(p_name), nullif(trim(p_tel), ''), p_guests, p_date, p_time,
          coalesce(p_zone, ''), nullif(trim(p_notes), ''), 'web', 'pending', coalesce(p_opt_in, false))
  returning json_build_object('id', id, 'token', access_token) into v_out;
  return v_out;
end $$;

create or replace function public.reservation_status(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('name', name, 'guests', guests, 'date', date, 'time', time,
                           'zone', zone, 'notes', notes, 'tel', tel, 'status', status, 'updated_at', updated_at)
  from reservations where access_token = p_token;
$$;

create or replace function public.cancel_reservation(p_token uuid) returns json
language plpgsql security definer set search_path = public as $$
declare v_out json;
begin
  update reservations set status = 'cancelled'
  where access_token = p_token and status in ('pending', 'confirmed')
  returning json_build_object('status', status) into v_out;
  return v_out;
end $$;

grant execute on function public.submit_reservation(text, text, int, date, text, text, text, boolean) to anon, authenticated;
grant execute on function public.reservation_status(uuid) to anon, authenticated;
grant execute on function public.cancel_reservation(uuid) to anon, authenticated;
grant execute on function public.is_staff() to authenticated;

-- ── Fichier clients (base de la fidélité et des offres) ───
-- Chaque réservation avec un téléphone crée ou met à jour la fiche du client, identifiée par son numéro.
-- marketing_opt_in : le client a accepté de recevoir les offres (obligatoire avant toute prospection).
create or replace function public.norm_phone(p text) returns text
language sql immutable as $$
  select case
    when d = '' then null
    when d like '00%' then nullif(substr(d, 3), '')
    when length(d) = 10 and d like '0%' then
      (case when substr(d, 1, 4) in ('0692', '0693', '0262', '0263', '0639') then '262' else '33' end) || substr(d, 2)
    when length(d) = 9 and (d like '692%' or d like '693%' or d like '262%') then '262' || d
    when length(d) >= 11 then d
    else null end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x
$$;

create table if not exists public.customers (
  id               uuid primary key default gen_random_uuid(),
  phone            text not null unique,              -- format international, ex. 262692123456
  name             text not null,
  email            text,
  marketing_opt_in boolean not null default false,
  opt_in_at        timestamptz,
  opt_out_at       timestamptz,
  requests         int not null default 0,            -- demandes et réservations enregistrées
  visits           int not null default 0,            -- réservations confirmées
  first_seen       timestamptz not null default now(),
  last_seen        timestamptz not null default now(),
  notes            text,
  auth_user_id     uuid unique references auth.users(id) on delete set null   -- futur compte client
);
alter table public.reservations add column if not exists customer_id uuid references public.customers(id) on delete set null;
create index if not exists reservations_customer_idx on public.reservations (customer_id);

alter table public.customers enable row level security;
drop policy if exists staff_customers on public.customers;
create policy staff_customers on public.customers for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create or replace function public.link_customer() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_phone text := public.norm_phone(new.tel); v_id uuid;
begin
  if v_phone is null then return new; end if;
  insert into customers (phone, name, marketing_opt_in, opt_in_at, requests, visits)
  values (v_phone, new.name, new.marketing_opt_in, case when new.marketing_opt_in then now() end, 1,
          case when new.status = 'confirmed' then 1 else 0 end)
  on conflict (phone) do update set
    name = excluded.name,
    requests = customers.requests + 1,
    visits = customers.visits + excluded.visits,
    last_seen = now(),
    marketing_opt_in = customers.marketing_opt_in or excluded.marketing_opt_in,
    opt_in_at = case when excluded.marketing_opt_in and not customers.marketing_opt_in then now() else customers.opt_in_at end
  returning id into v_id;
  new.customer_id := v_id;
  return new;
end $$;
drop trigger if exists reservations_link_customer on public.reservations;
create trigger reservations_link_customer before insert on public.reservations
  for each row execute function public.link_customer();

create or replace function public.customer_visits() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.customer_id is not null and old.status is distinct from new.status then
    update customers set visits = greatest(0, visits
      + (case when new.status = 'confirmed' then 1 else 0 end)
      - (case when old.status = 'confirmed' then 1 else 0 end))
    where id = new.customer_id;
  end if;
  return new;
end $$;
drop trigger if exists reservations_customer_visits on public.reservations;
create trigger reservations_customer_visits after update of status on public.reservations
  for each row execute function public.customer_visits();

-- Reprise des réservations déjà enregistrées (sans effet si déjà faite).
insert into public.customers (phone, name, requests, visits, first_seen, last_seen)
select public.norm_phone(tel), (array_agg(name order by created_at desc))[1], count(*),
       count(*) filter (where status = 'confirmed'), min(created_at), max(created_at)
from public.reservations
where customer_id is null and public.norm_phone(tel) is not null
group by 1
on conflict (phone) do nothing;
update public.reservations r set customer_id = c.id
from public.customers c
where r.customer_id is null and c.phone = public.norm_phone(r.tel);

-- ── Rôles de l'équipe ──────────────────────────────────────
-- admin : réglages du restaurant et gestion de l'équipe ; staff : réservations, clients et carte.
alter table public.staff add column if not exists role text not null default 'staff';
alter table public.staff add column if not exists display_name text;
do $$ begin
  alter table public.staff add constraint staff_role_check check (role in ('admin', 'staff'));
exception when duplicate_object then null; end $$;
-- Le premier compte ajouté devient administrateur s'il n'y en a encore aucun.
update public.staff set role = 'admin'
where not exists (select 1 from public.staff where role = 'admin')
  and user_id = (select user_id from public.staff order by created_at limit 1);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.list_staff()
returns table (user_id uuid, email text, role text, display_name text, created_at timestamptz, is_me boolean)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_staff() then raise exception 'non_autorise'; end if;
  return query
    select s.user_id, u.email::text, s.role, s.display_name, s.created_at, s.user_id = auth.uid()
    from public.staff s join auth.users u on u.id = s.user_id
    order by s.created_at;
end $$;

create or replace function public.add_staff(p_email text, p_role text default 'staff') returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'non_autorise'; end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  if v_id is null then raise exception 'compte_introuvable'; end if;
  insert into public.staff (user_id, role) values (v_id, coalesce(p_role, 'staff'))
  on conflict (user_id) do update set role = excluded.role;
end $$;

create or replace function public.set_staff_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'non_autorise'; end if;
  if p_role <> 'admin' and (select count(*) from staff where role = 'admin' and user_id <> p_user) = 0 then
    raise exception 'dernier_admin';
  end if;
  update staff set role = p_role where user_id = p_user;
end $$;

create or replace function public.remove_staff(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'non_autorise'; end if;
  if (select count(*) from staff where role = 'admin' and user_id <> p_user) = 0 then raise exception 'dernier_admin'; end if;
  delete from staff where user_id = p_user;
end $$;

revoke all on function public.list_staff() from public, anon;
revoke all on function public.add_staff(text, text) from public, anon;
revoke all on function public.set_staff_role(uuid, text) from public, anon;
revoke all on function public.remove_staff(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.list_staff() to authenticated;
grant execute on function public.add_staff(text, text) to authenticated;
grant execute on function public.set_staff_role(uuid, text) to authenticated;
grant execute on function public.remove_staff(uuid) to authenticated;

-- ── Réglages du restaurant (lus par le site, modifiés par les administrateurs) ──
create table if not exists public.settings (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to anon, authenticated using (true);
drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ── Carte (lue par le site, modifiée par l'équipe) ─────────
create table if not exists public.menu_categories (
  id      text primary key,
  label   text not null,
  icon    text not null default 'c-plats',
  color   text not null default 'green' check (color in ('green', 'orange', 'rose')),
  note    text,
  food    boolean not null default false,
  alcohol boolean not null default false,
  sort    int not null default 0,
  visible boolean not null default true
);
create table if not exists public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  category_id text not null references public.menu_categories(id) on update cascade on delete cascade,
  grp         text not null default '',          -- sous-titre dans la rubrique (ex. « Rhums »)
  name        text not null check (char_length(name) between 1 and 120),
  description text,
  price       numeric(8,2),                      -- prix unique…
  prices      jsonb,                             -- …ou plusieurs formats : [["12,5 cl", 6], ["75 cl", 25]]
  allergens   text[] not null default '{}',
  photo_url   text,
  featured    boolean not null default false,    -- mis en avant sur l'accueil
  available   boolean not null default true,     -- false : affiché « Épuisé »
  sort        int not null default 0,
  updated_at  timestamptz not null default now()
);
create index if not exists menu_items_category_idx on public.menu_items (category_id, sort);
drop trigger if exists menu_items_touch on public.menu_items;
create trigger menu_items_touch before update on public.menu_items
  for each row execute function public.touch_updated_at();

alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
drop policy if exists menu_categories_read on public.menu_categories;
create policy menu_categories_read on public.menu_categories for select to anon, authenticated using (true);
drop policy if exists menu_categories_staff on public.menu_categories;
create policy menu_categories_staff on public.menu_categories for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists menu_items_read on public.menu_items;
create policy menu_items_read on public.menu_items for select to anon, authenticated using (true);
drop policy if exists menu_items_staff on public.menu_items;
create policy menu_items_staff on public.menu_items for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ── Photos de la carte (Supabase Storage, lecture publique, envoi par l'équipe) ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-photos', 'menu-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists menu_photos_read on storage.objects;
create policy menu_photos_read on storage.objects for select using (bucket_id = 'menu-photos');
drop policy if exists menu_photos_insert on storage.objects;
create policy menu_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'menu-photos' and public.is_staff());
drop policy if exists menu_photos_update on storage.objects;
create policy menu_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'menu-photos' and public.is_staff());
drop policy if exists menu_photos_delete on storage.objects;
create policy menu_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'menu-photos' and public.is_staff());

-- ── Données de départ (reprises de la page, insérées une seule fois) ──
insert into public.settings (id, data) values (1, $seed${"name": "La Terrasse de Bourbon", "tagline": "Restaurant & cocktail bar", "city": "à Saint-Denis", "phone": "+262 692 25 35 38", "instagram": "@LaTerrasseDeBourbon", "address": "", "hoursText": "Le midi tous les jours. Le soir du lundi au jeudi jusqu'à 23h, le vendredi et le samedi jusqu'à minuit. Fermé le dimanche soir.", "services": {"midi": {"label": "Midi", "time": "12h30", "hours": "12h–14h30", "what": "Déjeuner & Happy Hour", "slots": ["12h00", "12h30", "13h00", "13h30"]}, "hh": {"label": "Happy Hour", "time": "18h00", "hours": "17h–19h", "what": "Cocktails & tapas", "slots": ["17h00", "17h30", "18h00", "18h30"]}, "soir": {"label": "Soir", "time": "19h30", "hours": "19h–23h", "what": "Dîner", "slots": ["19h00", "19h30", "20h00", "20h30", "21h00"]}}, "happyHours": [["12h00", "14h30"], ["17h00", "19h00"]], "closed": {"midi": [], "hh": [0], "soir": [0]}, "zones": [{"short": "int", "label": "Intérieur", "tables": [{"id": "bar1", "name": "Bar 1", "cap": 2}, {"id": "bar2", "name": "Bar 2", "cap": 2}, {"id": "bar3", "name": "Bar 3", "cap": 2}, {"id": "t100", "name": "100", "cap": 8}, {"id": "t101", "name": "101", "cap": 6, "maxCap": 7}, {"id": "coin1", "name": "Coin 1", "cap": 2, "maxCap": 3}, {"id": "coin2", "name": "Coin 2", "cap": 2, "maxCap": 3}, {"id": "t102", "name": "102", "cap": 6, "maxCap": 7}, {"id": "t103", "name": "103", "cap": 6, "maxCap": 7}, {"id": "t104", "name": "104", "cap": 4}, {"id": "t104b", "name": "104bis", "cap": 2}, {"id": "t105", "name": "105", "cap": 4}, {"id": "t106", "name": "106", "cap": 2}, {"id": "t106b", "name": "106bis", "cap": 2}, {"id": "t107", "name": "107", "cap": 2}, {"id": "t108", "name": "108", "cap": 4}, {"id": "t108bis", "name": "108bis", "cap": 2}, {"id": "t108ter", "name": "108ter", "cap": 2}, {"id": "t109", "name": "109", "cap": 2}, {"id": "t109b", "name": "109bis", "cap": 2}, {"id": "t110", "name": "110", "cap": 2}, {"id": "t110b", "name": "110bis", "cap": 2}, {"id": "t111", "name": "111", "cap": 3}, {"id": "gtbl", "name": "Grande Table", "cap": 14, "maxCap": 16, "salon": true}], "txt": "Salle & bar"}, {"short": "ter", "label": "Terrasse", "tables": [{"id": "t200a", "name": "200 Asc.", "cap": 2}, {"id": "t200b", "name": "200bis", "cap": 4}, {"id": "t201", "name": "201", "cap": 4}, {"id": "t202", "name": "202", "cap": 4}, {"id": "t203", "name": "203", "cap": 4}, {"id": "t204", "name": "204", "cap": 4}, {"id": "t206", "name": "206", "cap": 2}, {"id": "t208", "name": "208", "cap": 2}, {"id": "t210", "name": "210", "cap": 2}], "txt": "En plein air"}, {"short": "rof", "label": "Rooftop", "tables": [{"id": "t300", "name": "Salon 300", "cap": 6, "maxCap": 10, "salon": true}, {"id": "t301", "name": "301", "cap": 2}, {"id": "t302", "name": "302", "cap": 2}, {"id": "t303", "name": "303", "cap": 4}, {"id": "t304", "name": "304", "cap": 4}, {"id": "t307", "name": "Canapé 307", "cap": 10, "maxCap": 20, "salon": true}, {"id": "t308", "name": "308", "cap": 4}, {"id": "t310", "name": "310", "cap": 4, "maxCap": 6}, {"id": "t312", "name": "312", "cap": 4}], "txt": "Vue sur la ville"}]}$seed$::jsonb) on conflict (id) do nothing;

insert into public.menu_categories (id, label, icon, color, note, food, alcohol, sort)
select x.id, x.label, x.icon, x.color, x.note, x.food, x.alcohol, x.sort
from jsonb_to_recordset($seed$[{"id": "tapas", "label": "Tapas", "icon": "c-entrees", "color": "orange", "note": "À partir de 17h", "food": true, "alcohol": false, "sort": 0}, {"id": "burgers", "label": "Burgers", "icon": "c-burger", "color": "orange", "note": "Servis avec 2 accompagnements au choix · Sup. 3 € : œuf, bacon ou cheddar fondu · Sup. 5 € : foie gras", "food": true, "alcohol": false, "sort": 1}, {"id": "salades", "label": "Salades", "icon": "c-leaf", "color": "green", "note": "Servies dans cette composition · Sup. 5 € : burrata", "food": true, "alcohol": false, "sort": 2}, {"id": "vege", "label": "Végétarien", "icon": "c-leaf", "color": "green", "note": "Servis dans cette composition · Sup. 5 € : burrata", "food": true, "alcohol": false, "sort": 3}, {"id": "viandes", "label": "Viandes", "icon": "c-plats", "color": "orange", "note": null, "food": true, "alcohol": false, "sort": 4}, {"id": "poissons", "label": "Poissons", "icon": "c-fish", "color": "green", "note": null, "food": true, "alcohol": false, "sort": 5}, {"id": "accomp", "label": "Garnitures & sauces", "icon": "c-plats", "color": "green", "note": null, "food": true, "alcohol": false, "sort": 6}, {"id": "enfant", "label": "Menu enfant", "icon": "c-star", "color": "rose", "note": null, "food": true, "alcohol": false, "sort": 7}, {"id": "desserts", "label": "Desserts", "icon": "c-desserts", "color": "rose", "note": "Sup. 1 € : chantilly", "food": true, "alcohol": false, "sort": 8}, {"id": "hh", "label": "Happy Hour", "icon": "c-cocktails", "color": "orange", "note": "De 12h à 14h30 et de 17h à 19h", "food": false, "alcohol": true, "sort": 9}, {"id": "cocktails", "label": "Cocktails", "icon": "c-cocktails", "color": "orange", "note": null, "food": false, "alcohol": true, "sort": 10}, {"id": "mocktails", "label": "Mocktails", "icon": "c-softs", "color": "green", "note": null, "food": false, "alcohol": false, "sort": 11}, {"id": "bieres", "label": "Bières", "icon": "c-beer", "color": "orange", "note": null, "food": false, "alcohol": true, "sort": 12}, {"id": "softs", "label": "Softs", "icon": "c-softs", "color": "green", "note": null, "food": false, "alcohol": false, "sort": 13}, {"id": "chaud", "label": "Cafés, thés & frappés", "icon": "c-cup", "color": "orange", "note": null, "food": false, "alcohol": false, "sort": 14}, {"id": "vins", "label": "Vins & champagnes", "icon": "c-wine", "color": "rose", "note": null, "food": false, "alcohol": true, "sort": 15}]$seed$::jsonb)
  as x(id text, label text, icon text, color text, note text, food boolean, alcohol boolean, sort int)
on conflict (id) do nothing;

insert into public.menu_items (category_id, grp, name, description, price, prices, allergens, featured, sort)
select x.category_id, x.grp, x.name, x.description, x.price, x.prices, coalesce(x.allergens, '{}'), x.featured, x.sort
from jsonb_to_recordset($seed$[{"category_id": "tapas", "grp": "", "name": "Assiette de frites", "description": "Frites classiques ou frites de patate douce", "price": 5, "prices": null, "allergens": [], "featured": false, "sort": 0}, {"category_id": "tapas", "grp": "", "name": "Gyozas aux légumes", "description": "8 pièces", "price": 8, "prices": null, "allergens": ["G", "SO"], "featured": false, "sort": 1}, {"category_id": "tapas", "grp": "", "name": "Sticks de mozzarella", "description": "8 pièces", "price": 10, "prices": null, "allergens": ["G", "L"], "featured": false, "sort": 2}, {"category_id": "tapas", "grp": "", "name": "Rillettes de poissons", "description": null, "price": 10, "prices": null, "allergens": ["P", "L", "G"], "featured": false, "sort": 3}, {"category_id": "tapas", "grp": "", "name": "Wings de poulet", "description": "8 pièces, sauce BBQ", "price": 12, "prices": null, "allergens": [], "featured": false, "sort": 4}, {"category_id": "tapas", "grp": "", "name": "Camembert rôti au miel", "description": "Avec ou sans oignons confits, servi avec son pain toasté", "price": 16, "prices": null, "allergens": ["L", "G"], "featured": false, "sort": 5}, {"category_id": "tapas", "grp": "", "name": "Mi-cuit de foie gras", "description": "Accompagné de son chutney du moment et de son pain toasté", "price": 19, "prices": null, "allergens": ["G"], "featured": false, "sort": 6}, {"category_id": "tapas", "grp": "", "name": "Planche Végé", "description": "Guacamole, boulettes de falafel, sauce vierge aux pommes vertes, sauce salsa, tomates confites, feta", "price": 19, "prices": null, "allergens": ["L", "G"], "featured": false, "sort": 7}, {"category_id": "tapas", "grp": "", "name": "Planche Charcuterie & Fromage", "description": "Magret séché, saucisson sec, serrano, Piton Maïdo, Cap Noir, fromage de chèvre, beurre & cornichons", "price": 19, "prices": null, "allergens": ["L", "G"], "featured": false, "sort": 8}, {"category_id": "tapas", "grp": "", "name": "Mix Créole", "description": "4 pièces de chaque : samoussas, nems de poulet, bouchons de poulet frit, accras de morue, bonbons piment", "price": 20, "prices": null, "allergens": ["G", "P", "L"], "featured": true, "sort": 9}, {"category_id": "tapas", "grp": "", "name": "Planche Crousti Mix", "description": "4 pièces de chaque : beignets de calamar, oignons rings, wings de poulet, crevettes croustillantes, sticks de mozzarella", "price": 25, "prices": null, "allergens": ["G", "ML", "L"], "featured": false, "sort": 10}, {"category_id": "tapas", "grp": "", "name": "Planche Terre & Mer", "description": "Tartare de thon, beignets de calamars, brochette de crevettes, rillettes de thon, samoussas poisson, crevettes panko, gravelax de magret, jambon de dinde (Duchemann), pommes de terre sautées et brochette de poulet", "price": 35, "prices": null, "allergens": ["G", "P", "L"], "featured": false, "sort": 11}, {"category_id": "burgers", "grp": "", "name": "Burger Boeuf", "description": "Pain burger artisanal, cheddar tranché, steak de boeuf, salade, tomate, oignons, cheddar, sauce BBQ", "price": 21, "prices": null, "allergens": ["G", "O", "L", "SE"], "featured": false, "sort": 0}, {"category_id": "burgers", "grp": "", "name": "Burger Poulet", "description": "Pain burger artisanal, cheddar tranché, poulet pané maison, salade, tomate, oignons, cheddar, sauce tartare", "price": 21, "prices": null, "allergens": ["G", "O", "L", "SE"], "featured": false, "sort": 1}, {"category_id": "burgers", "grp": "", "name": "Burger Poisson", "description": "Pain burger artisanal, cheddar tranché, poisson pané maison, salade, tomate, oignons, cornichons, sauce tartare", "price": 21, "prices": null, "allergens": ["G", "O", "P", "L", "SE"], "featured": false, "sort": 2}, {"category_id": "burgers", "grp": "", "name": "Burger Veggie", "description": "Pain burger artisanal, galette de pomme de terre, salade, tomates confites, aubergine rôtie, cornichons, guacamole", "price": 21, "prices": null, "allergens": ["G", "O", "L", "SE"], "featured": false, "sort": 3}, {"category_id": "burgers", "grp": "", "name": "Burger du chef", "description": "Boeuf ou poulet. Pain burger artisanal, cheddar tranché, bacon de volaille (Duchemann), salade, tomates, oignons confits, oeuf au plat", "price": 23, "prices": null, "allergens": ["G", "O", "L", "SE"], "featured": true, "sort": 4}, {"category_id": "salades", "grp": "", "name": "Salade Burrata", "description": "Burrata, tagliatelles de carottes & courgettes, salade, tomates, tomates confites, fruit du moment, vinaigrette framboise & persillade", "price": 18, "prices": null, "allergens": ["L"], "featured": false, "sort": 0}, {"category_id": "salades", "grp": "", "name": "Salade César", "description": "Salade & mix de choux, poulet crispy, oeuf dur, tomates cerises, parmesan, croûtons de pain, sauce César", "price": 19, "prices": null, "allergens": ["G", "O", "L", "MO"], "featured": false, "sort": 1}, {"category_id": "salades", "grp": "", "name": "Avocado Toast", "description": "Toast grillé, saumon fumé, guacamole, tomates cerises, salade, oignons frits & persillade", "price": 19, "prices": null, "allergens": ["P", "G", "O", "L"], "featured": false, "sort": 2}, {"category_id": "salades", "grp": "", "name": "Bruschetta", "description": "Toast grillé, tartare de tomate, jambon serrano, tomates cerises, tomates séchées, parmesan", "price": 19, "prices": null, "allergens": ["L", "G", "MO"], "featured": false, "sort": 3}, {"category_id": "salades", "grp": "", "name": "Salade Chèvre-Miel", "description": "Salade, mix de choux, tomates cerises, toasts de chèvre miel, noix et lardons de volaille", "price": 19, "prices": null, "allergens": ["FC", "G", "MO", "L"], "featured": false, "sort": 4}, {"category_id": "salades", "grp": "", "name": "Salade Zourite", "description": "Salade & mix de choux, tomates cerises, concombres, ananas, zourite, coto mili et sa vinaigrette créole", "price": 20, "prices": null, "allergens": ["G", "MO", "ML"], "featured": true, "sort": 5}, {"category_id": "salades", "grp": "", "name": "Terrine de Foie Gras", "description": "Accompagnée de son chutney du moment, de son pain toasté et de la salade", "price": 25, "prices": null, "allergens": ["G", "MO"], "featured": false, "sort": 6}, {"category_id": "vege", "grp": "", "name": "Aubergine Croustillante", "description": "Sauce tomate sucrée salée, feta, tomates cerises, concombres, sauce salsa, oignons, figues séchées & poivrons", "price": 18, "prices": null, "allergens": ["O", "G", "L"], "featured": false, "sort": 0}, {"category_id": "vege", "grp": "", "name": "Linguine burrata", "description": "Et son crémeux au parmesan et à l'huile de truffe noire", "price": 23, "prices": null, "allergens": ["G", "L"], "featured": false, "sort": 1}, {"category_id": "viandes", "grp": "Avec 2 accompagnements au choix", "name": "Brochettes de poulet aux sésames", "description": "Laquées sauce soja & miel", "price": 22, "prices": null, "allergens": ["SO", "SE"], "featured": false, "sort": 0}, {"category_id": "viandes", "grp": "Avec 2 accompagnements au choix", "name": "Travers de porc", "description": "Sauce BBQ", "price": 25, "prices": null, "allergens": [], "featured": false, "sort": 1}, {"category_id": "viandes", "grp": "Avec 2 accompagnements au choix", "name": "Côtelette d'agneau grillée", "description": "Au beurre d'ail et mix cajun", "price": 27, "prices": null, "allergens": [], "featured": false, "sort": 2}, {"category_id": "viandes", "grp": "Avec 2 accompagnements au choix", "name": "Souris d'agneau", "description": "Assaisonnée au miel & gingembre", "price": 28, "prices": null, "allergens": [], "featured": false, "sort": 3}, {"category_id": "viandes", "grp": "Avec 2 accompagnements et une sauce maison au choix", "name": "Filet mignon de porc", "description": "Avec sa croûte d'herbes", "price": 25, "prices": null, "allergens": [], "featured": false, "sort": 4}, {"category_id": "viandes", "grp": "Avec 2 accompagnements et une sauce maison au choix", "name": "Filet de kangourou", "description": null, "price": 26, "prices": null, "allergens": ["SO"], "featured": false, "sort": 5}, {"category_id": "viandes", "grp": "Avec 2 accompagnements et une sauce maison au choix", "name": "Magret de canard", "description": "Laqué sauce soja & miel", "price": 29, "prices": null, "allergens": ["SO"], "featured": false, "sort": 6}, {"category_id": "viandes", "grp": "Avec 2 accompagnements et une sauce maison au choix", "name": "Pièce du boucher", "description": null, "price": 33, "prices": null, "allergens": [], "featured": false, "sort": 7}, {"category_id": "viandes", "grp": "Servis dans cette composition", "name": "Risotto et ses brochettes de boeuf", "description": null, "price": 25, "prices": null, "allergens": ["G", "L"], "featured": false, "sort": 8}, {"category_id": "viandes", "grp": "Servis dans cette composition", "name": "Risotto poulet à l'huile de truffe", "description": "Ballottine de poulet farcie aux petits légumes", "price": 26, "prices": null, "allergens": ["G", "L"], "featured": false, "sort": 9}, {"category_id": "poissons", "grp": "Avec 2 accompagnements au choix", "name": "Tartare du moment", "description": "Selon composition du jour", "price": 22, "prices": null, "allergens": ["C", "P"], "featured": false, "sort": 0}, {"category_id": "poissons", "grp": "Avec 2 accompagnements au choix", "name": "Tataki du moment", "description": "Sauce soja & miel", "price": 23, "prices": null, "allergens": ["C", "P", "SO", "SE"], "featured": false, "sort": 1}, {"category_id": "poissons", "grp": "Avec 2 accompagnements au choix", "name": "Poisson grillé du moment", "description": "Selon arrivage, sauce à base de fumet de poisson", "price": 24, "prices": null, "allergens": ["C", "P"], "featured": false, "sort": 2}, {"category_id": "poissons", "grp": "Avec 2 accompagnements au choix", "name": "Pavé de saumon mi-cuit", "description": "Laqué sauce soja & miel", "price": 25, "prices": null, "allergens": ["C", "P", "SO"], "featured": false, "sort": 3}, {"category_id": "poissons", "grp": "Avec 2 accompagnements au choix", "name": "Zourite grillé", "description": "Sauce vierge aux pommes vertes et sa persillade", "price": 27, "prices": null, "allergens": ["C", "P"], "featured": false, "sort": 4}, {"category_id": "poissons", "grp": "Avec 2 accompagnements au choix", "name": "Duo de Thon & Saumon", "description": "Pavé de thon mi-cuit, carpaccio de saumon et sauce vierge aux pommes vertes", "price": 28, "prices": null, "allergens": ["C", "P", "SO"], "featured": false, "sort": 5}, {"category_id": "poissons", "grp": "Servis dans cette composition", "name": "Fish & Chips", "description": "Accompagné de frites, salade & sa sauce tartare", "price": 19, "prices": null, "allergens": ["G", "C", "O", "P"], "featured": false, "sort": 6}, {"category_id": "poissons", "grp": "Servis dans cette composition", "name": "Risotto Gambas", "description": "Crémeux safrané au combava et ses gambas", "price": 29, "prices": null, "allergens": ["G", "C", "L", "ML"], "featured": true, "sort": 7}, {"category_id": "accomp", "grp": "Accompagnements · inclus pour les plats « 2 accompagnements au choix », sinon en supplément", "name": "Frites", "description": null, "price": 3, "prices": null, "allergens": [], "featured": false, "sort": 0}, {"category_id": "accomp", "grp": "Accompagnements · inclus pour les plats « 2 accompagnements au choix », sinon en supplément", "name": "Frites de patate douce", "description": null, "price": 3, "prices": null, "allergens": [], "featured": false, "sort": 1}, {"category_id": "accomp", "grp": "Accompagnements · inclus pour les plats « 2 accompagnements au choix », sinon en supplément", "name": "Salade", "description": null, "price": 3, "prices": null, "allergens": [], "featured": false, "sort": 2}, {"category_id": "accomp", "grp": "Accompagnements · inclus pour les plats « 2 accompagnements au choix », sinon en supplément", "name": "Légumes rôtis", "description": null, "price": 3, "prices": null, "allergens": [], "featured": false, "sort": 3}, {"category_id": "accomp", "grp": "Accompagnements · inclus pour les plats « 2 accompagnements au choix », sinon en supplément", "name": "Riz", "description": null, "price": 3, "prices": null, "allergens": [], "featured": false, "sort": 4}, {"category_id": "accomp", "grp": "Accompagnements · inclus pour les plats « 2 accompagnements au choix », sinon en supplément", "name": "Écrasé de pomme de terre", "description": "Sup. 1 € : à l'huile de truffe", "price": 3, "prices": null, "allergens": [], "featured": false, "sort": 5}, {"category_id": "accomp", "grp": "Sauces maison · incluses pour les plats « sauce au choix », sinon en supplément", "name": "Sauce poivre", "description": null, "price": 2, "prices": null, "allergens": [], "featured": false, "sort": 6}, {"category_id": "accomp", "grp": "Sauces maison · incluses pour les plats « sauce au choix », sinon en supplément", "name": "Sauce roquefort", "description": null, "price": 2, "prices": null, "allergens": [], "featured": false, "sort": 7}, {"category_id": "accomp", "grp": "Sauces maison · incluses pour les plats « sauce au choix », sinon en supplément", "name": "Sauce forestière", "description": null, "price": 2, "prices": null, "allergens": [], "featured": false, "sort": 8}, {"category_id": "enfant", "grp": "", "name": "Menu enfant", "description": "Une boisson : eau, Coca-Cola, Sprite, sirop, diabolo ou jus de fruit. Un plat : steak haché, poisson pané ou nuggets, avec frites ou pâtes. Un dessert : une boule de glace au parfum de votre choix.", "price": 12, "prices": null, "allergens": [], "featured": false, "sort": 0}, {"category_id": "desserts", "grp": "", "name": "Boule de glace", "description": "Parfum au choix : vanille, chocolat, café, coco, fraise, sorbet passion, sorbet goyavier, sorbet tangor, gianduja, bubblegum, arc-en-ciel et parfum du mois", "price": 3, "prices": null, "allergens": ["L"], "featured": false, "sort": 0}, {"category_id": "desserts", "grp": "", "name": "Crème brûlée à la vanille de Bourbon", "description": null, "price": 8, "prices": null, "allergens": ["O", "L"], "featured": false, "sort": 1}, {"category_id": "desserts", "grp": "", "name": "Tiramisu du moment", "description": null, "price": 9, "prices": null, "allergens": ["G", "O", "L"], "featured": false, "sort": 2}, {"category_id": "desserts", "grp": "", "name": "Fondant au chocolat", "description": "Sur son coulis de fruits rouges, accompagné d'une boule de glace vanille & chantilly", "price": 10, "prices": null, "allergens": ["G", "O", "L"], "featured": false, "sort": 3}, {"category_id": "desserts", "grp": "", "name": "Carpaccio d'ananas", "description": "Arrosé de son sirop de vanille avec sa boule de sorbet citron combava", "price": 10, "prices": null, "allergens": [], "featured": false, "sort": 4}, {"category_id": "desserts", "grp": "", "name": "Café / Thé gourmand", "description": "Les 5 mignardises du jour avec le café ou le thé de votre choix", "price": 12, "prices": null, "allergens": ["G", "O", "L"], "featured": false, "sort": 5}, {"category_id": "desserts", "grp": "", "name": "Brioche perdue", "description": "Coulis caramel beurre salé, accompagnée d'une boule de glace gianduja & chantilly", "price": 12, "prices": null, "allergens": ["G", "O", "L"], "featured": true, "sort": 6}, {"category_id": "desserts", "grp": "", "name": "Profiteroles", "description": "Coulis de chocolat, choux & leurs boules de glace vanille, amandes grillées & chantilly", "price": 12, "prices": null, "allergens": ["G", "O", "L"], "featured": false, "sort": 7}, {"category_id": "desserts", "grp": "", "name": "Champagne gourmand", "description": "Les 5 mignardises du jour avec une coupe de brut ou de demi-sec au choix", "price": 18, "prices": null, "allergens": ["G", "O", "L"], "featured": false, "sort": 8}, {"category_id": "hh", "grp": "Cocktails", "name": "Mojito", "description": "Rhum blanc Isautier, menthe, citron vert, sucre roux, limonade (fruits rouges, passion ou pêche)", "price": 5, "prices": null, "allergens": [], "featured": false, "sort": 0}, {"category_id": "hh", "grp": "Cocktails", "name": "Ti-Punch", "description": "Rhum blanc Isautier, citron vert, sucre roux", "price": 5, "prices": null, "allergens": [], "featured": false, "sort": 1}, {"category_id": "hh", "grp": "Cocktails", "name": "Gin Tonic", "description": null, "price": 5, "prices": null, "allergens": [], "featured": false, "sort": 2}, {"category_id": "hh", "grp": "Cocktails", "name": "Caïpiroska", "description": "Vodka, citron vert, sucre roux (fruits rouges, passion ou pêche)", "price": 5, "prices": null, "allergens": [], "featured": false, "sort": 3}, {"category_id": "hh", "grp": "Cocktails", "name": "Vodka Red Tea", "description": "Vodka, purée de fruits rouges & passion, jus de cranberry, jus de citron", "price": 6, "prices": null, "allergens": [], "featured": false, "sort": 4}, {"category_id": "hh", "grp": "Cocktails", "name": "Planteur", "description": "Rhum blanc Isautier, jus d'ananas & mangue, grenadine", "price": 6, "prices": null, "allergens": [], "featured": false, "sort": 5}, {"category_id": "hh", "grp": "Cocktails", "name": "Water Melon Tonic", "description": "Gin, pastèque, jus de citron, sirop de sucre, tonic", "price": 6, "prices": null, "allergens": [], "featured": false, "sort": 6}, {"category_id": "hh", "grp": "Bières pression · 50 cl", "name": "Dodo / Phoenix", "description": null, "price": 4, "prices": null, "allergens": [], "featured": false, "sort": 7}, {"category_id": "hh", "grp": "Bières pression · 50 cl", "name": "Affligem / Kéwès", "description": null, "price": 5, "prices": null, "allergens": [], "featured": false, "sort": 8}, {"category_id": "hh", "grp": "Bières pression · 50 cl", "name": "Grimbergen Rouge", "description": null, "price": 5, "prices": null, "allergens": [], "featured": false, "sort": 9}, {"category_id": "hh", "grp": "Mocktails", "name": "Virgin Mojito", "description": "Menthe, citron vert, sucre roux, limonade (fruits rouges, passion ou pêche)", "price": 5, "prices": null, "allergens": [], "featured": false, "sort": 10}, {"category_id": "hh", "grp": "Mocktails", "name": "Passionada", "description": "Purée de passion, jus de citron, sirop de sucre, eau gazeuse", "price": 5, "prices": null, "allergens": [], "featured": false, "sort": 11}, {"category_id": "hh", "grp": "Mocktails", "name": "Passiontonic", "description": "Purée de passion, jus de citron, sirop de sucre, tonic", "price": 5, "prices": null, "allergens": [], "featured": false, "sort": 12}, {"category_id": "hh", "grp": "Mocktails", "name": "Virgin Red Tea", "description": "Purée de fruits rouges & passion, jus de cranberry, jus de citron", "price": 5, "prices": null, "allergens": [], "featured": false, "sort": 13}, {"category_id": "hh", "grp": "Mocktails", "name": "Virgin Water Melon Tonic", "description": "Pastèque, jus de citron, sirop de sucre, tonic", "price": 5, "prices": null, "allergens": [], "featured": false, "sort": 14}, {"category_id": "hh", "grp": "Softs · servis au verre", "name": "Coca-Cola", "description": null, "price": 2, "prices": null, "allergens": [], "featured": false, "sort": 15}, {"category_id": "hh", "grp": "Softs · servis au verre", "name": "Sprite", "description": null, "price": 2, "prices": null, "allergens": [], "featured": false, "sort": 16}, {"category_id": "hh", "grp": "Softs · servis au verre", "name": "Jus en brique", "description": "Ananas, pomme, orange ou mangue", "price": 2, "prices": null, "allergens": [], "featured": false, "sort": 17}, {"category_id": "cocktails", "grp": "Rhums", "name": "Mojito", "description": "Rhum blanc Isautier, menthe, citron vert, sucre roux, limonade. Sup. 1 € : fruits rouges, passion ou pêche", "price": 8, "prices": null, "allergens": [], "featured": false, "sort": 0}, {"category_id": "cocktails", "grp": "Rhums", "name": "Daïquiri", "description": "Rhum blanc Isautier, jus de citron, sirop de sucre. Sup. 1 € : fruits rouges, passion ou pêche", "price": 8, "prices": null, "allergens": [], "featured": false, "sort": 1}, {"category_id": "cocktails", "grp": "Rhums", "name": "Ti-Punch", "description": "Rhum blanc Isautier, citron vert, sucre roux", "price": 8, "prices": null, "allergens": [], "featured": false, "sort": 2}, {"category_id": "cocktails", "grp": "Rhums", "name": "Planteur", "description": "Rhum blanc Isautier, jus d'ananas & mangue, grenadine", "price": 9, "prices": null, "allergens": [], "featured": false, "sort": 3}, {"category_id": "cocktails", "grp": "Rhums", "name": "Kalou", "description": "Rhum ambré Isautier, citron vert, sucre roux", "price": 9, "prices": null, "allergens": [], "featured": false, "sort": 4}, {"category_id": "cocktails", "grp": "Rhums", "name": "Caïpirinha", "description": "Cachaça, citron vert, sucre roux. Sup. 1 € : fruits rouges, passion ou pêche", "price": 10, "prices": null, "allergens": [], "featured": false, "sort": 5}, {"category_id": "cocktails", "grp": "Rhums", "name": "Malibu Sunrise", "description": "Rhum blanc Isautier, Malibu, jus de citron, jus d'ananas & coco, grenadine", "price": 10, "prices": null, "allergens": [], "featured": false, "sort": 6}, {"category_id": "cocktails", "grp": "Rhums", "name": "Pina Colada", "description": "Rhum blanc Isautier, jus d'ananas & coco, glace vanille, crème de coco", "price": 10, "prices": null, "allergens": [], "featured": false, "sort": 7}, {"category_id": "cocktails", "grp": "Rhums", "name": "Maï Taï", "description": "Rhum blanc Isautier, Amaretto, triple sec, jus de citron, sirop de sucre, sirop d'orgeat", "price": 12, "prices": null, "allergens": [], "featured": false, "sort": 8}, {"category_id": "cocktails", "grp": "Rhums", "name": "Blue Hawaïen", "description": "Malibu, glace vanille, purée de coco, jus d'ananas & coco, curaçao", "price": 12, "prices": null, "allergens": [], "featured": false, "sort": 9}, {"category_id": "cocktails", "grp": "Whisky", "name": "Whisky Sour", "description": "Whisky, jus de citron, sirop de sucre", "price": 8, "prices": null, "allergens": [], "featured": false, "sort": 10}, {"category_id": "cocktails", "grp": "Whisky", "name": "Whisk'Int", "description": "Whisky, menthe, citron vert, purée de fruits rouges, sucre roux, limonade", "price": 10, "prices": null, "allergens": [], "featured": false, "sort": 11}, {"category_id": "cocktails", "grp": "Whisky", "name": "Jackito", "description": "Jack Daniel's, menthe, citron vert, sucre roux, limonade", "price": 12, "prices": null, "allergens": [], "featured": false, "sort": 12}, {"category_id": "cocktails", "grp": "Whisky", "name": "Honey Ice Tea", "description": "Jack Daniel's Honey, ice tea maison, jus de citron, sirop de sucre", "price": 12, "prices": null, "allergens": [], "featured": false, "sort": 13}, {"category_id": "cocktails", "grp": "Whisky", "name": "Old Fashioned", "description": "Black Label, angostura, sirop de sucre", "price": 12, "prices": null, "allergens": [], "featured": false, "sort": 14}, {"category_id": "cocktails", "grp": "Vodka", "name": "Caïpiroska", "description": "Vodka, citron vert, sucre roux. Sup. 1 € : fruits rouges, passion ou pêche", "price": 8, "prices": null, "allergens": [], "featured": false, "sort": 15}, {"category_id": "cocktails", "grp": "Vodka", "name": "Cosmopolitain", "description": "Vodka, triple sec, jus de cranberry, jus de citron", "price": 9, "prices": null, "allergens": [], "featured": false, "sort": 16}, {"category_id": "cocktails", "grp": "Vodka", "name": "Sex On The Beach", "description": "Vodka, jus d'orange, jus de cranberry, sirop de fraise, sirop de pêche", "price": 10, "prices": null, "allergens": [], "featured": false, "sort": 17}, {"category_id": "cocktails", "grp": "Vodka", "name": "Vodka Red Tea", "description": "Vodka, purée de fruits rouges & passion, jus de cranberry, jus de citron", "price": 10, "prices": null, "allergens": [], "featured": false, "sort": 18}, {"category_id": "cocktails", "grp": "Vodka", "name": "Moscow Mule", "description": "Vodka, jus de citron, ginger ale", "price": 11, "prices": null, "allergens": [], "featured": false, "sort": 19}, {"category_id": "cocktails", "grp": "Vodka", "name": "Espresso Martini", "description": "Vodka, café, arôme de vanille, sirop de sucre", "price": 12, "prices": null, "allergens": [], "featured": false, "sort": 20}, {"category_id": "cocktails", "grp": "Vodka", "name": "Pornstar Martini", "description": "Vodka, triple sec, jus de citron, purée de passion, sirop de sucre, + 1 shooter de champagne", "price": 13, "prices": null, "allergens": [], "featured": false, "sort": 21}, {"category_id": "cocktails", "grp": "Gin", "name": "Gin Fizz", "description": "Gin, jus de citron, tonic, sirop de sucre", "price": 9, "prices": null, "allergens": [], "featured": false, "sort": 22}, {"category_id": "cocktails", "grp": "Gin", "name": "Razeberry Fizz", "description": "Gin, purée de fruits rouges, jus de citron, tonic, sirop de sucre", "price": 10, "prices": null, "allergens": [], "featured": false, "sort": 23}, {"category_id": "cocktails", "grp": "Gin", "name": "Red Carpet", "description": "Gin, purée de fruits rouges, gingembre, jus de citron, tonic, sirop de sucre", "price": 11, "prices": null, "allergens": [], "featured": false, "sort": 24}, {"category_id": "cocktails", "grp": "Gin", "name": "Basilic Smash", "description": "Gin, sirop de basilic, jus de citron, sirop de sucre", "price": 10, "prices": null, "allergens": [], "featured": false, "sort": 25}, {"category_id": "cocktails", "grp": "Gin", "name": "WaterMelon Tonic", "description": "Gin, pastèque, jus de citron, tonic, sirop de sucre", "price": 12, "prices": null, "allergens": [], "featured": false, "sort": 26}, {"category_id": "cocktails", "grp": "Gin", "name": "Ocean Spritz", "description": "Gin, citron, curaçao, eau gazeuse, prosecco", "price": 12, "prices": null, "allergens": [], "featured": false, "sort": 27}, {"category_id": "cocktails", "grp": "Gin", "name": "Basilic Ginger Tonic", "description": "Gin, jus de citron, sirop de basilic, ginger ale", "price": 12, "prices": null, "allergens": [], "featured": false, "sort": 28}, {"category_id": "cocktails", "grp": "Gin", "name": "Queen Victoria", "description": "Gin, ananas, jus de citron, purée de passion, tonic, sirop de sucre", "price": 12, "prices": null, "allergens": [], "featured": false, "sort": 29}, {"category_id": "cocktails", "grp": "Tequila", "name": "Margarita", "description": "Tequila, triple sec, jus de citron", "price": 10, "prices": null, "allergens": [], "featured": false, "sort": 30}, {"category_id": "cocktails", "grp": "Tequila", "name": "Tequila Sunrise", "description": "Tequila, jus d'orange, grenadine", "price": 10, "prices": null, "allergens": [], "featured": false, "sort": 31}, {"category_id": "cocktails", "grp": "Nos signatures", "name": "Aperol Spritz", "description": "Prosecco, Aperol, eau gazeuse", "price": 12, "prices": null, "allergens": [], "featured": false, "sort": 32}, {"category_id": "cocktails", "grp": "Nos signatures", "name": "Saint Germain Spritz", "description": "Prosecco, Saint Germain, jus de citron, eau gazeuse", "price": 12, "prices": null, "allergens": [], "featured": false, "sort": 33}, {"category_id": "cocktails", "grp": "Nos signatures", "name": "French Passion", "description": "Vodka, champagne, triple sec, purée de passion, jus de citron, sirop de sucre", "price": 13, "prices": null, "allergens": [], "featured": false, "sort": 34}, {"category_id": "cocktails", "grp": "Nos signatures", "name": "French Berry", "description": "Gin, champagne, triple sec, purée de fruits rouges, jus de citron, sirop de sucre", "price": 13, "prices": null, "allergens": [], "featured": false, "sort": 35}, {"category_id": "cocktails", "grp": "Nos signatures", "name": "Terrasito", "description": "Rhum blanc Isautier, 974 mix (ou Desperado + 1 €), menthe, citron vert, gingembre, purée de passion, sucre roux", "price": 13, "prices": null, "allergens": [], "featured": true, "sort": 36}, {"category_id": "cocktails", "grp": "Nos signatures", "name": "Long Island Ice Tea", "description": "Rhum blanc Isautier, vodka, gin, tequila, triple sec, jus de citron, Coca-Cola ou cranberry", "price": 14, "prices": null, "allergens": [], "featured": false, "sort": 37}, {"category_id": "cocktails", "grp": "Nos signatures", "name": "Cocktail Création", "description": "Surprise !", "price": 14, "prices": null, "allergens": [], "featured": false, "sort": 38}, {"category_id": "mocktails", "grp": "Sans alcool", "name": "Citronnade", "description": null, "price": 5, "prices": null, "allergens": [], "featured": false, "sort": 0}, {"category_id": "mocktails", "grp": "Sans alcool", "name": "Virgin Mojito", "description": "Menthe, citron vert, sucre roux, limonade. Sup. 1 € : fruits rouges, passion ou pêche", "price": 6, "prices": null, "allergens": [], "featured": false, "sort": 1}, {"category_id": "mocktails", "grp": "Sans alcool", "name": "Passionada", "description": "Purée de passion, jus de citron, sirop de sucre, eau gazeuse", "price": 7, "prices": null, "allergens": [], "featured": false, "sort": 2}, {"category_id": "mocktails", "grp": "Sans alcool", "name": "Passiontonic", "description": "Purée de passion, jus de citron, sirop de sucre, tonic", "price": 7, "prices": null, "allergens": [], "featured": false, "sort": 3}, {"category_id": "mocktails", "grp": "Sans alcool", "name": "Tonic Gingembre", "description": "Sirop de gingembre, jus de citron, tonic", "price": 7, "prices": null, "allergens": [], "featured": false, "sort": 4}, {"category_id": "mocktails", "grp": "Sans alcool", "name": "Berry's Lemon", "description": "Purée de fruits rouges, jus de citron, sirop de sucre, eau gazeuse", "price": 7, "prices": null, "allergens": [], "featured": false, "sort": 5}, {"category_id": "mocktails", "grp": "Sans alcool", "name": "Cocktail de fruits frais", "description": null, "price": 8, "prices": null, "allergens": [], "featured": false, "sort": 6}, {"category_id": "mocktails", "grp": "Sans alcool", "name": "Virgin WaterMelon Tonic", "description": "Pastèque, jus de citron, sirop de sucre, tonic", "price": 8, "prices": null, "allergens": [], "featured": false, "sort": 7}, {"category_id": "mocktails", "grp": "Sans alcool", "name": "Virgin Red Tea", "description": "Purée de fruits rouges & passion, jus de cranberry, jus de citron", "price": 8, "prices": null, "allergens": [], "featured": false, "sort": 8}, {"category_id": "mocktails", "grp": "Sans alcool", "name": "Virgin Lada", "description": "Jus d'ananas & coco, glace à la vanille, crème de coco", "price": 8, "prices": null, "allergens": [], "featured": false, "sort": 9}, {"category_id": "mocktails", "grp": "Sans alcool", "name": "Virgin Basilic Ginger", "description": "Jus de citron, sirop de basilic, ginger ale", "price": 8, "prices": null, "allergens": [], "featured": false, "sort": 10}, {"category_id": "bieres", "grp": "Pression", "name": "Dodo / Phoenix", "description": null, "price": null, "prices": [["25 cl", 3], ["50 cl", 6]], "allergens": [], "featured": false, "sort": 0}, {"category_id": "bieres", "grp": "Pression", "name": "Panaché / Monaco", "description": null, "price": null, "prices": [["25 cl", 4], ["50 cl", 7]], "allergens": [], "featured": false, "sort": 1}, {"category_id": "bieres", "grp": "Pression", "name": "Affligem Blonde", "description": null, "price": null, "prices": [["25 cl", 5], ["50 cl", 8]], "allergens": [], "featured": false, "sort": 2}, {"category_id": "bieres", "grp": "Pression", "name": "Manawa IPA", "description": null, "price": null, "prices": [["25 cl", 5], ["50 cl", 8]], "allergens": [], "featured": false, "sort": 3}, {"category_id": "bieres", "grp": "Pression", "name": "Grimbergen Rouge", "description": null, "price": null, "prices": [["25 cl", 5], ["50 cl", 8]], "allergens": [], "featured": false, "sort": 4}, {"category_id": "bieres", "grp": "Pression", "name": "Kéwès blanche", "description": null, "price": null, "prices": [["25 cl", 5], ["50 cl", 8]], "allergens": [], "featured": false, "sort": 5}, {"category_id": "bieres", "grp": "Bouteille", "name": "Heineken / zéro · 25 cl", "description": null, "price": 5, "prices": null, "allergens": [], "featured": false, "sort": 6}, {"category_id": "bieres", "grp": "Bouteille", "name": "974 Mix Original / Mojito", "description": null, "price": 5, "prices": null, "allergens": [], "featured": false, "sort": 7}, {"category_id": "bieres", "grp": "Bouteille", "name": "Desperados Original / Red", "description": null, "price": 6, "prices": null, "allergens": [], "featured": false, "sort": 8}, {"category_id": "softs", "grp": "", "name": "Coca-Cola", "description": null, "price": 4, "prices": null, "allergens": [], "featured": false, "sort": 0}, {"category_id": "softs", "grp": "", "name": "Coca-Cola Zéro", "description": null, "price": 4, "prices": null, "allergens": [], "featured": false, "sort": 1}, {"category_id": "softs", "grp": "", "name": "Fanta", "description": null, "price": 4, "prices": null, "allergens": [], "featured": false, "sort": 2}, {"category_id": "softs", "grp": "", "name": "Ice Tea pêche", "description": null, "price": 4, "prices": null, "allergens": [], "featured": false, "sort": 3}, {"category_id": "softs", "grp": "", "name": "Schweppes Tonic", "description": null, "price": 4, "prices": null, "allergens": [], "featured": false, "sort": 4}, {"category_id": "softs", "grp": "", "name": "Schweppes Agrumes", "description": null, "price": 4, "prices": null, "allergens": [], "featured": false, "sort": 5}, {"category_id": "softs", "grp": "", "name": "Sprite", "description": null, "price": 4, "prices": null, "allergens": [], "featured": false, "sort": 6}, {"category_id": "softs", "grp": "", "name": "Orangina", "description": null, "price": 4, "prices": null, "allergens": [], "featured": false, "sort": 7}, {"category_id": "softs", "grp": "", "name": "Sirop", "description": "Grenadine, fraise, menthe ou pêche. Sup. 0,50 € : diabolo", "price": 2.5, "prices": null, "allergens": [], "featured": false, "sort": 8}, {"category_id": "softs", "grp": "", "name": "Ice Tea maison", "description": null, "price": 4, "prices": null, "allergens": [], "featured": false, "sort": 9}, {"category_id": "softs", "grp": "", "name": "Perrier · 33 cl", "description": null, "price": 4, "prices": null, "allergens": [], "featured": false, "sort": 10}, {"category_id": "softs", "grp": "", "name": "Eau plate · 50 cl", "description": null, "price": 2, "prices": null, "allergens": [], "featured": false, "sort": 11}, {"category_id": "softs", "grp": "", "name": "Eau gazeuse · 50 cl", "description": null, "price": 2, "prices": null, "allergens": [], "featured": false, "sort": 12}, {"category_id": "softs", "grp": "", "name": "Eau plate · 1 L", "description": null, "price": 4, "prices": null, "allergens": [], "featured": false, "sort": 13}, {"category_id": "softs", "grp": "", "name": "Eau gazeuse · 1 L", "description": null, "price": 4.5, "prices": null, "allergens": [], "featured": false, "sort": 14}, {"category_id": "chaud", "grp": "Boissons chaudes", "name": "Ristretto / Expresso / Allongé", "description": null, "price": 2.4, "prices": null, "allergens": [], "featured": false, "sort": 0}, {"category_id": "chaud", "grp": "Boissons chaudes", "name": "Café noisette", "description": null, "price": 2.4, "prices": null, "allergens": [], "featured": false, "sort": 1}, {"category_id": "chaud", "grp": "Boissons chaudes", "name": "Double expresso", "description": null, "price": 3, "prices": null, "allergens": [], "featured": false, "sort": 2}, {"category_id": "chaud", "grp": "Boissons chaudes", "name": "Long black", "description": null, "price": 3.5, "prices": null, "allergens": [], "featured": false, "sort": 3}, {"category_id": "chaud", "grp": "Boissons chaudes", "name": "Cappuccino", "description": null, "price": 3.5, "prices": null, "allergens": [], "featured": false, "sort": 4}, {"category_id": "chaud", "grp": "Boissons chaudes", "name": "Latte macchiato", "description": null, "price": 4.5, "prices": null, "allergens": [], "featured": false, "sort": 5}, {"category_id": "chaud", "grp": "Boissons chaudes", "name": "Mocha", "description": null, "price": 4.5, "prices": null, "allergens": [], "featured": false, "sort": 6}, {"category_id": "chaud", "grp": "Boissons chaudes", "name": "Chocolat chaud", "description": null, "price": 3.5, "prices": null, "allergens": [], "featured": false, "sort": 7}, {"category_id": "chaud", "grp": "Boissons chaudes", "name": "Thé vert, noir & infusion", "description": null, "price": 3.9, "prices": null, "allergens": [], "featured": false, "sort": 8}, {"category_id": "chaud", "grp": "Frappés", "name": "Café frappé", "description": "Café, glace vanille, lait, sirop de sucre, chantilly", "price": 7, "prices": null, "allergens": [], "featured": false, "sort": 9}, {"category_id": "chaud", "grp": "Frappés", "name": "Chocolat frappé", "description": "Poudre de cacao, coulis de chocolat, glace vanille, lait, sirop de sucre, chantilly", "price": 7, "prices": null, "allergens": [], "featured": false, "sort": 10}, {"category_id": "chaud", "grp": "Frappés", "name": "Frappé M&M's", "description": "M&M's écrasés, glace vanille, lait, chantilly", "price": 8, "prices": null, "allergens": [], "featured": false, "sort": 11}, {"category_id": "chaud", "grp": "Frappés", "name": "Frappé Oréo", "description": "Oréo écrasés, glace vanille, lait, chantilly", "price": 8, "prices": null, "allergens": [], "featured": false, "sort": 12}, {"category_id": "chaud", "grp": "Frappés", "name": "Frappé du moment", "description": "Selon composition du jour", "price": 8, "prices": null, "allergens": [], "featured": false, "sort": 13}, {"category_id": "vins", "grp": "Rouge", "name": "Marius, Michel Chapoutier · Syrah / Grenache", "description": "IGP Pays d'Oc", "price": null, "prices": [["12,5 cl", 6], ["75 cl", 25]], "allergens": [], "featured": false, "sort": 0}, {"category_id": "vins", "grp": "Rouge", "name": "Les Pinoteuses · Pinot Noir", "description": "IGP Pays d'Oc", "price": null, "prices": [["12,5 cl", 7], ["75 cl", 27]], "allergens": [], "featured": false, "sort": 1}, {"category_id": "vins", "grp": "Rouge", "name": "Cuvée Lou Pichoun · Bio", "description": "AOP Côtes du Rhône", "price": null, "prices": [["12,5 cl", 7], ["75 cl", 28]], "allergens": [], "featured": false, "sort": 2}, {"category_id": "vins", "grp": "Rouge", "name": "Domaine du Salut", "description": "AOC Graves", "price": null, "prices": [["12,5 cl", 8], ["75 cl", 30]], "allergens": [], "featured": false, "sort": 3}, {"category_id": "vins", "grp": "Rouge", "name": "Domaine Morel", "description": "AOC Brouilly", "price": null, "prices": [["12,5 cl", 8], ["75 cl", 31]], "allergens": [], "featured": false, "sort": 4}, {"category_id": "vins", "grp": "Rouge", "name": "Les Déesses Muettes", "description": "AOP Pic Saint-Loup", "price": null, "prices": [["75 cl", 42]], "allergens": [], "featured": false, "sort": 5}, {"category_id": "vins", "grp": "Rouge", "name": "Domaine du Père Caboche", "description": "AOC Châteauneuf-du-Pape", "price": null, "prices": [["75 cl", 62]], "allergens": [], "featured": false, "sort": 6}, {"category_id": "vins", "grp": "Blanc", "name": "Les Délices de Martine · Viognier", "description": "IGP Pays d'Oc", "price": null, "prices": [["12,5 cl", 6], ["75 cl", 25]], "allergens": [], "featured": false, "sort": 7}, {"category_id": "vins", "grp": "Blanc", "name": "Père & Fils · Chardonnay", "description": "IGP Pays d'Oc", "price": null, "prices": [["12,5 cl", 7], ["75 cl", 27]], "allergens": [], "featured": false, "sort": 8}, {"category_id": "vins", "grp": "Blanc", "name": "Tariquet Classique", "description": "IGP Côtes de Gascogne", "price": null, "prices": [["12,5 cl", 7], ["75 cl", 28]], "allergens": [], "featured": false, "sort": 9}, {"category_id": "vins", "grp": "Blanc", "name": "Domaine Hertzog · Pinot Gris", "description": null, "price": null, "prices": [["12,5 cl", 8], ["75 cl", 30]], "allergens": [], "featured": false, "sort": 10}, {"category_id": "vins", "grp": "Blanc", "name": "Goutte de Lune", "description": "IGP Côtes de Gascogne", "price": null, "prices": [["12,5 cl", 8], ["75 cl", 31]], "allergens": [], "featured": false, "sort": 11}, {"category_id": "vins", "grp": "Blanc", "name": "Tariquet Premières Grives", "description": "IGP Côtes de Gascogne", "price": null, "prices": [["75 cl", 33]], "allergens": [], "featured": false, "sort": 12}, {"category_id": "vins", "grp": "Blanc", "name": "Belena · Les Alouettes", "description": "AOP Chablis", "price": null, "prices": [["75 cl", 38]], "allergens": [], "featured": false, "sort": 13}, {"category_id": "vins", "grp": "Rosé", "name": "Gris Blanc", "description": "IGP Languedoc", "price": null, "prices": [["12,5 cl", 7], ["75 cl", 29]], "allergens": [], "featured": false, "sort": 14}, {"category_id": "vins", "grp": "Rosé", "name": "Cuvée Minotaure", "description": "AOP Côtes de Provence", "price": null, "prices": [["12,5 cl", 8], ["75 cl", 31]], "allergens": [], "featured": false, "sort": 15}, {"category_id": "vins", "grp": "Rosé", "name": "Domaine des Vabres", "description": "AOP Pic Saint-Loup", "price": null, "prices": [["75 cl", 36]], "allergens": [], "featured": false, "sort": 16}, {"category_id": "vins", "grp": "Champagne", "name": "François Dubois", "description": "Brut ou demi-sec", "price": null, "prices": [["12,5 cl", 12], ["75 cl", 75]], "allergens": [], "featured": false, "sort": 17}, {"category_id": "vins", "grp": "Champagne", "name": "Moët", "description": "Brut", "price": null, "prices": [["75 cl", 110]], "allergens": [], "featured": false, "sort": 18}, {"category_id": "vins", "grp": "Champagne", "name": "Moët & Chandon", "description": "Nectar Impérial", "price": null, "prices": [["75 cl", 120]], "allergens": [], "featured": false, "sort": 19}, {"category_id": "vins", "grp": "Champagne", "name": "Deutz", "description": "Brut", "price": null, "prices": [["75 cl", 120]], "allergens": [], "featured": false, "sort": 20}, {"category_id": "vins", "grp": "Champagne", "name": "Ruinart", "description": null, "price": null, "prices": [["75 cl", 150]], "allergens": [], "featured": false, "sort": 21}, {"category_id": "vins", "grp": "Champagne", "name": "Ruinart", "description": "Blanc de Blancs", "price": null, "prices": [["75 cl", 230]], "allergens": [], "featured": false, "sort": 22}, {"category_id": "vins", "grp": "Champagne", "name": "Perrier-Jouët", "description": null, "price": null, "prices": [["75 cl", 300]], "allergens": [], "featured": false, "sort": 23}, {"category_id": "vins", "grp": "Champagne", "name": "Dom Pérignon", "description": null, "price": null, "prices": [["75 cl", 350]], "allergens": [], "featured": false, "sort": 24}, {"category_id": "vins", "grp": "Champagne", "name": "Louis Roederer", "description": "« Cristal » 2012", "price": null, "prices": [["75 cl", 400]], "allergens": [], "featured": false, "sort": 25}]$seed$::jsonb)
  as x(category_id text, grp text, name text, description text, price numeric, prices jsonb, allergens text[], featured boolean, sort int)
where not exists (select 1 from public.menu_items);

-- ── Temps réel pour le hub ─────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.reservations, public.occupancy;
exception when duplicate_object then null; end $$;

-- ── Ajouter un membre de l'équipe ──────────────────────────
-- 1. Supabase > Authentication > Users > Add user (e-mail + mot de passe).
-- 2. Puis ici, avec son e-mail :
-- insert into public.staff (user_id) select id from auth.users where email = 'prenom@exemple.re';
