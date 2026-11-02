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
create or replace function public.submit_reservation(
  p_name text, p_tel text, p_guests int, p_date date, p_time text, p_zone text, p_notes text
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

  insert into reservations (name, tel, guests, date, time, zone, notes, src, status)
  values (trim(p_name), nullif(trim(p_tel), ''), p_guests, p_date, p_time,
          coalesce(p_zone, ''), nullif(trim(p_notes), ''), 'web', 'pending')
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

grant execute on function public.submit_reservation(text, text, int, date, text, text, text) to anon, authenticated;
grant execute on function public.reservation_status(uuid) to anon, authenticated;
grant execute on function public.cancel_reservation(uuid) to anon, authenticated;
grant execute on function public.is_staff() to authenticated;

-- ── Temps réel pour le hub ─────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.reservations, public.occupancy;
exception when duplicate_object then null; end $$;

-- ── Ajouter un membre de l'équipe ──────────────────────────
-- 1. Supabase > Authentication > Users > Add user (e-mail + mot de passe).
-- 2. Puis ici, avec son e-mail :
-- insert into public.staff (user_id) select id from auth.users where email = 'prenom@exemple.re';
