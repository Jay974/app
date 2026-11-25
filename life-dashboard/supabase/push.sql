-- Notifications push : à coller dans Supabase > SQL Editor > Run (après avoir remplacé VOTRE_CRON_SECRET)
create table if not exists public.push_subs (
  endpoint   text primary key,
  uid        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  tz         text not null default 'UTC',
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists "own subs" on public.push_subs;
create policy "own subs" on public.push_subs for all using (uid = auth.uid()) with check (uid = auth.uid());
grant select, insert, update, delete on public.push_subs to authenticated;

-- Historique anti-doublon (accessible uniquement par le serveur)
create table if not exists public.push_sent (
  uid uuid not null, key text not null, day text not null,
  primary key (uid, key, day)
);
alter table public.push_sent enable row level security;

-- Déclencheur : appelle le serveur chaque minute
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('life-push') where exists (select 1 from cron.job where jobname = 'life-push');
select cron.schedule('life-push', '* * * * *', $$
  select net.http_get(
    url := 'https://app-life-dashboard.vercel.app/api/cron',
    headers := '{"Authorization": "Bearer VOTRE_CRON_SECRET"}'::jsonb
  );
$$);
