-- 043_performances.sql
-- v2.x calendar: one row per individual showing. The cron extracts a
-- production's run window + schedule pattern (or explicit date list)
-- and code-side expands those into performance rows here.
--
-- Public calendar's "what's playing tonight" query is just:
--   select * from performances
--    join productions on productions.id = performances.production_id
--    where performs_at::date = current_date
--      and productions.status = 'approved'
--      and productions.deleted_at is null
--   order by performs_at;
--
-- All performs_at values are stored as timestamptz. The cron writes
-- them in America/Los_Angeles wall-clock (e.g. "2026-05-09T19:30
-- Pacific"); Postgres normalises to UTC. The public site renders back
-- in Pacific so the displayed showtime always matches what the theatre
-- printed on its tickets.

create table if not exists public.performances (
  id              uuid primary key default gen_random_uuid(),
  production_id   uuid not null references public.productions(id) on delete cascade,

  performs_at     timestamptz not null,

  -- Optional flag/note on individual performances (e.g. "Pay What You
  -- Can", "ASL Interpreted", "Talkback after show"). Surfaces on the
  -- per-day calendar entry.
  note            text,

  -- Cancelled performances stay in the table so callers can see "this
  -- date was originally scheduled then cancelled" rather than have
  -- the row vanish silently.
  cancelled       boolean not null default false,
  cancelled_at    timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Most calendar queries filter by date. Composite index supports
-- "what's playing on date D", "what's playing this week", and the
-- public list view's chronological pagination.
create index if not exists performances_performs_at_idx
  on public.performances (performs_at) where cancelled = false;
create index if not exists performances_production_idx
  on public.performances (production_id);

create trigger performances_set_updated_at
  before update on public.performances
  for each row execute function public.set_updated_at();

alter table public.performances enable row level security;

-- Public can read any performance whose production is approved + live.
-- The join here keeps RLS aligned with productions visibility.
create policy "Public can read performances of approved productions"
  on public.performances for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.productions p
       where p.id = performances.production_id
         and p.status = 'approved'
         and p.deleted_at is null
    )
  );
