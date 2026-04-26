-- 005_discipline_categories.sql
-- Adds category grouping to disciplines so the submission form can render a
-- searchable accordion. The discipline taxonomy is expected to grow well
-- past 100 entries; flat checkbox grid won't scale.

create table public.discipline_categories (
  name        text primary key,
  sort_order  integer not null,
  updated_at  timestamptz not null default now()
);

create trigger discipline_categories_set_updated_at
  before update on public.discipline_categories
  for each row execute function public.set_updated_at();

alter table public.discipline_categories enable row level security;

create policy "Public can read discipline_categories"
  on public.discipline_categories for select
  to anon, authenticated
  using (true);

-- Category list in display order. "Other" sorts last via a deliberately high
-- sort_order so new categories can slot in front without re-numbering.
insert into public.discipline_categories (name, sort_order) values
  ('Performance',                       10),
  ('Direction & Leadership',            20),
  ('Music & Sound',                     30),
  ('Design',                            40),
  ('Technical & Production',            50),
  ('Specialty & Effects',               60),
  ('Creative & Development',            70),
  ('Education & Coaching',              80),
  ('Accessibility & Inclusion',         90),
  ('Admin, Producing & Front of House', 100),
  ('Digital / Emerging',                110),
  ('Multi-Discipline / Catch-All',      120),
  ('Other',                             999)
on conflict (name) do nothing;

-- Plain text reference, no FK - lets Lexi rename a category via bulk update
-- without ON UPDATE CASCADE plumbing.
alter table public.disciplines add column category text;

update public.disciplines set category = case name
  when 'Actor'                then 'Performance'
  when 'Director'             then 'Direction & Leadership'
  when 'Choreographer'        then 'Direction & Leadership'
  when 'Music Director'       then 'Direction & Leadership'
  when 'Sound Designer'       then 'Music & Sound'
  when 'Scenic Designer'      then 'Design'
  when 'Lighting Designer'    then 'Design'
  when 'Costume Designer'     then 'Design'
  when 'Projection Designer'  then 'Design'
  when 'Props Designer'       then 'Design'
  when 'Stage Manager'        then 'Technical & Production'
  when 'Technician'           then 'Technical & Production'
  when 'Crew'                 then 'Technical & Production'
  when 'Playwright'           then 'Creative & Development'
  when 'Producer'             then 'Admin, Producing & Front of House'
  when 'Other'                then 'Other'
end;

alter table public.disciplines alter column category set not null;
create index disciplines_category_idx on public.disciplines (category, sort_order);
