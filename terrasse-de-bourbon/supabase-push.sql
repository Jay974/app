-- La Terrasse de Bourbon · notifications push à l'équipe (à lancer une fois, après supabase.sql).
-- Supabase > SQL Editor > New query > coller ce fichier > Run.
-- Le résultat affiche NOTIFY_SECRET : à copier dans Vercel > Settings > Environment Variables.

create extension if not exists pg_net with schema extensions;

-- ── Réglages privés (inaccessibles depuis le site) ─────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.config (key text primary key, value text not null);

insert into private.config (key, value) values
  ('notify_url', 'https://app-terrasse-de-bourbon.vercel.app/api/notify'),
  ('notify_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- ── Appareils abonnés ──────────────────────────────────────
create table if not exists public.push_subscriptions (
  endpoint     text primary key,
  subscription jsonb not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;   -- aucune politique : accès uniquement par les fonctions ci-dessous

create or replace function public.save_push_subscription(p_sub jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'non_autorise'; end if;
  if p_sub->>'endpoint' is null then raise exception 'abonnement_invalide'; end if;
  insert into push_subscriptions (endpoint, subscription, user_id)
  values (p_sub->>'endpoint', p_sub, auth.uid())
  on conflict (endpoint) do update set subscription = excluded.subscription, user_id = excluded.user_id;
end $$;

create or replace function public.delete_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

create or replace function public.prune_push_subscriptions(p_secret text, p_endpoints text[]) returns int
language plpgsql security definer set search_path = public, private as $$
declare n int;
begin
  if p_secret is null or p_secret is distinct from (select value from private.config where key = 'notify_secret') then
    raise exception 'refuse';
  end if;
  delete from push_subscriptions where endpoint = any(p_endpoints);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.save_push_subscription(jsonb) from public, anon;
revoke all on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(jsonb) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;
grant execute on function public.prune_push_subscriptions(text, text[]) to anon, authenticated;

-- ── Déclencheur : chaque nouvelle demande du site prévient l'équipe ──
create or replace function private.notify_new_request() returns trigger
language plpgsql security definer set search_path = public, private, extensions as $$
declare v_url text; v_secret text; v_subs jsonb; v_pending int;
begin
  if new.status <> 'pending' or new.src <> 'web' then return new; end if;
  select value into v_url from private.config where key = 'notify_url';
  select value into v_secret from private.config where key = 'notify_secret';
  select coalesce(jsonb_agg(subscription), '[]'::jsonb) into v_subs from public.push_subscriptions;
  if v_url is null or jsonb_array_length(v_subs) = 0 then return new; end if;
  select count(*) into v_pending from public.reservations where status = 'pending';
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object(
      'reservation', jsonb_build_object('id', new.id, 'name', new.name, 'guests', new.guests, 'date', new.date, 'time', new.time, 'zone', new.zone),
      'pending', v_pending,
      'subscriptions', v_subs),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
    timeout_milliseconds := 8000);
  return new;
exception when others then
  return new;   -- une notification ratée ne doit jamais bloquer une réservation
end $$;

drop trigger if exists reservations_notify on public.reservations;
create trigger reservations_notify after insert on public.reservations
  for each row execute function private.notify_new_request();

-- ── À copier dans Vercel (variable NOTIFY_SECRET) ──────────
select value as "NOTIFY_SECRET" from private.config where key = 'notify_secret';
