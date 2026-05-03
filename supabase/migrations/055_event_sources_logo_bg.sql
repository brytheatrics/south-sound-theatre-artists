-- 055_event_sources_logo_bg.sql
-- Per-source background colour for the logo tile on /theatres + admin
-- cards. Theatre logos arrive in mixed colour schemes (black-on-
-- transparent, white-on-transparent, full-colour), and a single
-- background never works for all of them - white logos vanish on the
-- default cream paper, black ones look heavy on dark.
--
-- Stored as a short token that the page maps to a CSS custom property
-- (var(--paper), var(--ink), etc.) so the chosen background also
-- auto-flips when the user toggles to dark mode.

alter table public.event_sources
  add column if not exists logo_bg text not null default 'paper';

alter table public.event_sources
  drop constraint if exists event_sources_logo_bg_check;
alter table public.event_sources
  add constraint event_sources_logo_bg_check
    check (logo_bg in ('paper', 'paper-2', 'bg-raised', 'ink', 'accent'));

comment on column public.event_sources.logo_bg is
  'Token mapping to a CSS custom property used as the logo cell background on /theatres. One of: paper (default cream), paper-2 (deeper cream), bg-raised (warm white), ink (near-black, for white-on-transparent logos), accent (moss green).';
