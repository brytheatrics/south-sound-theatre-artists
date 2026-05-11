-- Site-wide contact form. Public visitors hit /contact, pick a
-- category (general / help / bug / feature / theatre listing), submit.
-- Each category routes to a primary admin + optional CC list. Lexi can
-- edit recipients via /admin/contact-categories without a code change.

create table contact_categories (
  slug text primary key,
  label text not null,
  description text,
  primary_email text not null,
  cc_emails text[] not null default '{}',
  sort_order int not null default 100,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table contact_submissions (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null references contact_categories(slug) on delete restrict,
  name text not null,
  email text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved', 'spam')),
  notes jsonb not null default '[]'::jsonb,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);
create index contact_submissions_status_idx on contact_submissions (status, created_at desc);

-- Initial five categories. Lexi is primary on all; Blake is CC on
-- everything (with the launch-period rule that he stays CC'd on bugs
-- permanently). Lexi can edit recipients post-launch from the admin UI.
-- ADMIN_EMAIL substitution happens via the cron + email_log machinery;
-- the literal values here are baseline defaults that admin can change.
insert into contact_categories (slug, label, description, primary_email, cc_emails, sort_order) values
  ('general', 'General contact', 'Anything that doesn''t fit a more specific bucket. Press, partnerships, just saying hi.', 'lexi@southsoundtheatreartists.org', array['blake@blakeryork.com'], 10),
  ('help', 'Help with my profile', 'Login trouble, claiming a profile we bulk-imported, "how do I update X."', 'lexi@southsoundtheatreartists.org', array['blake@blakeryork.com'], 20),
  ('bug', 'Bug report', 'Something on the site is broken or behaving strangely.', 'lexi@southsoundtheatreartists.org', array['blake@blakeryork.com'], 30),
  ('feature', 'Feature request', 'An idea for something new on the site.', 'lexi@southsoundtheatreartists.org', array['blake@blakeryork.com'], 40),
  ('theatre', 'Theatre listing', 'A theatre / producing company reaching out about their listing on /theatres.', 'lexi@southsoundtheatreartists.org', array['blake@blakeryork.com'], 50)
on conflict (slug) do nothing;

-- The contact-form email template - routed to primary + cc when a
-- submission lands. Same shape as the per-artist contact form's
-- contact_routed template.
insert into email_templates (slug, subject, body_markdown, audience, description) values
  ('contact_submission', 'New contact form submission - {{category_label}}', 'A new message came in via the site contact form.

**Category:** {{category_label}}
**From:** {{name}} <{{email}}>
**Submitted:** {{submitted_at}}

---

{{message}}

---

Reply directly to this email to respond to {{name}}, or open the message in admin: {{admin_url}}

{{signature}}', 'admin', 'Routed to the category''s primary + cc admins when a public visitor submits the /contact form.')
on conflict (slug) do nothing;
