-- Facturation (devis / factures) réservée au propriétaire — à coller dans Supabase > SQL Editor > Run
create table if not exists public.billing_docs (
  id         uuid primary key default gen_random_uuid(),
  uid        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('settings', 'client', 'quote', 'invoice')),
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.billing_docs enable row level security;
drop policy if exists "owner only" on public.billing_docs;
create policy "owner only" on public.billing_docs for all
  using      (uid = auth.uid() and coalesce((auth.jwt() -> 'app_metadata' ->> 'owner')::boolean, false))
  with check (uid = auth.uid() and coalesce((auth.jwt() -> 'app_metadata' ->> 'owner')::boolean, false));
grant select, insert, update, delete on public.billing_docs to authenticated;
grant all on public.billing_docs to service_role;

-- Marque TON compte comme propriétaire (remplace l'email), puis déconnecte-toi et reconnecte-toi dans l'app.
-- Ce marqueur ne peut pas être modifié depuis l'application : seul ce SQL (ou la console Supabase) le peut.
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"owner": true}'::jsonb
 where email = 'VOTRE_EMAIL';
