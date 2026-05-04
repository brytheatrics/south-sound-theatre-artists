-- 067_email_signature_content.sql
-- Edit-once signature row used by every transactional email. The send
-- pipeline pulls site_content where slug='email_signature' at send time
-- and substitutes {{signature}} into the rendered template body.
--
-- Logo URL lives directly in this markdown so a future logo swap is a
-- single edit at /admin/content - no code change.

insert into public.site_content (slug, title, body_markdown)
values (
  'email_signature',
  'Email signature',
  E'\n— South Sound Theatre Artists\n\n[southsoundtheatreartists.org](https://southsoundtheatreartists.org)'
)
on conflict (slug) do nothing;
