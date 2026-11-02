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
  v_today date := (now() at time zone 'Indian/Reunion')::date;
  v_out   json;
begin
  -- Champs obligatoires : nom, téléphone joignable, nombre de personnes, date et heure.
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'nom_requis'; end if;
  if length(regexp_replace(coalesce(p_tel, ''), '[^0-9]', '', 'g')) not between 9 and 15 then raise exception 'tel_requis'; end if;
  if p_guests is null or p_guests < 1 then raise exception 'personnes_requis'; end if;
  if p_date is null or p_time is null then raise exception 'creneau_requis'; end if;
  if p_date < v_today or p_date > v_today + 180 then
    raise exception 'date_invalide';
  end if;
  -- Fermé le dimanche soir : seul le service du midi (avant 16h) est réservable.
  if extract(dow from p_date) = 0 and split_part(p_time, 'h', 1)::int >= 16 then
    raise exception 'ferme_dimanche_soir';
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

-- ── Temps réel pour le hub ─────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.reservations, public.occupancy;
exception when duplicate_object then null; end $$;

-- ── Ajouter un membre de l'équipe ──────────────────────────
-- 1. Supabase > Authentication > Users > Add user (e-mail + mot de passe).
-- 2. Puis ici, avec son e-mail :
-- insert into public.staff (user_id) select id from auth.users where email = 'prenom@exemple.re';
