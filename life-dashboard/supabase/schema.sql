-- À coller dans Supabase > SQL Editor > Run
create sequence if not exists fields_seq;

create table if not exists public.fields (
  uid   uuid   not null default auth.uid() references auth.users(id) on delete cascade,
  doc   text   not null,          -- ex: day:2026-11-24, cfg, credit, pay:abc
  field text   not null,
  v     jsonb,
  t     bigint not null,          -- horodatage (ms) : le plus récent gagne
  seq   bigint not null default nextval('fields_seq'),
  primary key (uid, doc, field)
);
create index if not exists fields_seq_idx on public.fields (uid, seq);

alter table public.fields enable row level security;
drop policy if exists "own rows" on public.fields;
create policy "own rows" on public.fields for all
  using (uid = auth.uid()) with check (uid = auth.uid());

-- Envoi groupé avec fusion « le plus récent gagne », champ par champ
create or replace function public.push_fields(rows jsonb) returns void
language sql security invoker as $$
  insert into public.fields (doc, field, v, t)
  select r->>'doc', r->>'field', r->'v', (r->>'t')::bigint from jsonb_array_elements(rows) r
  on conflict (uid, doc, field) do update
    set v = excluded.v, t = excluded.t, seq = nextval('fields_seq')
    where excluded.t > public.fields.t;
$$;

-- Droits d'accès pour les utilisateurs connectés (sans eux : « permission denied for table fields »)
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.fields to authenticated;
grant usage, select on sequence public.fields_seq to authenticated;
grant execute on function public.push_fields(jsonb) to authenticated;

-- Synchro en direct
do $$ begin
  alter publication supabase_realtime add table public.fields;
exception when duplicate_object then null; end $$;
