-- ============================================================
--  Unsere Wohnung – Datenbank-Setup für Supabase
-- ============================================================
--  So geht's:
--   1. Unter "Authentication → Users" eure beiden Konten anlegen
--      ("Add user" → "Create new user", Häkchen "Auto Confirm User").
--   2. Dieses komplette Skript im "SQL Editor" einfügen und "Run" klicken.
--
--  Das Skript kann gefahrlos mehrfach ausgeführt werden. Wer später noch
--  ein Konto anlegt, führt es einfach noch einmal aus.
--  Nur Konten, die beim Ausführen existieren, bekommen Zugriff.
-- ============================================================


-- ---------- Mitglieder (wer darf rein) ----------------------

create table if not exists public.members (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text,
  created_at  timestamptz not null default now()
);

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.members where id = auth.uid());
$$;


-- ---------- Einstellungen (genau eine Zeile) ----------------

create table if not exists public.settings (
  id          int primary key default 1 check (id = 1),
  move_date   date,
  budget      numeric(12, 2),
  address     text,
  seeded_at   timestamptz
);

insert into public.settings (id) values (1) on conflict (id) do nothing;


-- ---------- Räume -------------------------------------------

create table if not exists public.rooms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  emoji       text,
  notes       text,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);


-- ---------- Sachen / Wunschliste ----------------------------

create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid references public.rooms (id) on delete cascade,
  title       text not null,
  url         text,
  price       numeric(12, 2),
  image       text,
  status      text not null default 'idee' check (status in ('idee', 'geplant', 'gekauft')),
  notes       text,
  created_by  uuid default auth.uid() references public.members (id) on delete set null,
  created_at  timestamptz not null default now()
);


-- ---------- Ausgaben ----------------------------------------

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  amount      numeric(12, 2) not null,
  paid_by     uuid references public.members (id) on delete set null,
  room_id     uuid references public.rooms (id) on delete set null,
  category    text,
  item_id     uuid references public.items (id) on delete set null,
  date        date not null default current_date,
  notes       text,
  created_by  uuid default auth.uid() references public.members (id) on delete set null,
  created_at  timestamptz not null default now()
);


-- ---------- Aufgaben (To-Dos + Umzugs-Checkliste) -----------

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  notes       text,
  due_date    date,
  assignee    uuid references public.members (id) on delete set null,
  phase       text,
  done        boolean not null default false,
  done_at     timestamptz,
  room_id     uuid references public.rooms (id) on delete set null,
  sort        int not null default 0,
  created_by  uuid default auth.uid() references public.members (id) on delete set null,
  created_at  timestamptz not null default now()
);


-- ---------- Verträge & Anbieter -----------------------------

create table if not exists public.contracts (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  provider      text,
  status        text not null default 'offen' check (status in ('offen', 'laeuft', 'erledigt')),
  customer_no   text,
  monthly_cost  numeric(12, 2),
  notes         text,
  sort          int not null default 0,
  created_at    timestamptz not null default now()
);


-- ---------- Umzugskisten ------------------------------------

create table if not exists public.boxes (
  id          uuid primary key default gen_random_uuid(),
  number      int not null,
  room_id     uuid references public.rooms (id) on delete set null,
  contents    text,
  fragile     boolean not null default false,
  unpacked    boolean not null default false,
  created_at  timestamptz not null default now()
);


-- ---------- Dateien (Grundrisse + Fotos) --------------------

create table if not exists public.files (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('grundriss', 'foto')),
  room_id       uuid references public.rooms (id) on delete cascade,
  path          text not null,
  name          text,
  content_type  text,
  caption       text,
  created_by    uuid default auth.uid() references public.members (id) on delete set null,
  created_at    timestamptz not null default now()
);


-- ---------- Zugriffsrechte: nur ihr zwei --------------------

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.settings, public.rooms, public.items, public.expenses,
  public.tasks, public.contracts, public.boxes, public.files
  to authenticated;
grant select, update (name) on public.members to authenticated;
grant execute on function public.is_member() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['settings', 'rooms', 'items', 'expenses', 'tasks', 'contracts', 'boxes', 'files'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Nur wir zwei" on public.%I', t);
    execute format(
      'create policy "Nur wir zwei" on public.%I for all to authenticated '
      'using (public.is_member()) with check (public.is_member())', t);
  end loop;
end $$;

alter table public.members enable row level security;
drop policy if exists "Mitglieder sehen" on public.members;
create policy "Mitglieder sehen" on public.members
  for select to authenticated using (public.is_member());
drop policy if exists "Eigenen Namen ändern" on public.members;
create policy "Eigenen Namen ändern" on public.members
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());


-- ---------- Speicher für Fotos & Grundrisse (privat) --------

insert into storage.buckets (id, name, public)
values ('wohnung', 'wohnung', false)
on conflict (id) do nothing;

drop policy if exists "Wohnung: nur wir zwei" on storage.objects;
create policy "Wohnung: nur wir zwei" on storage.objects
  for all to authenticated
  using (bucket_id = 'wohnung' and public.is_member())
  with check (bucket_id = 'wohnung' and public.is_member());


-- ---------- Live-Aktualisierung zwischen euren Geräten ------

do $$
declare
  t text;
begin
  foreach t in array array['members', 'settings', 'rooms', 'items', 'expenses', 'tasks', 'contracts', 'boxes', 'files'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;  -- schon drin
      when undefined_object then null;  -- Realtime nicht vorhanden
    end;
  end loop;
end $$;


-- ---------- Alle vorhandenen Konten freischalten ------------

insert into public.members (id)
select id from auth.users
on conflict (id) do nothing;

-- Kontrolle: Hier sollten eure beiden Konten stehen.
select u.email, m.created_at as freigeschaltet_am
from public.members m join auth.users u on u.id = m.id
order by m.created_at;
