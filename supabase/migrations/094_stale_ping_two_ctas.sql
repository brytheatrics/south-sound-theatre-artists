-- 094_stale_ping_two_ctas.sql
--
-- Updates the stale_profile_ping template body to use two explicit
-- CTAs (one-click "I'm still here" + the existing edit profile link)
-- instead of the original "reply to this email or update anything"
-- framing. The reply path didn't actually do anything in the DB, so
-- artists who replied stayed in the soft-delete countdown until Lexi
-- noticed and intervened. The new still_active_url hits a route that
-- clears stale_pinged_at + bumps updated_at without burning the
-- token, so the same email's edit link still works after.

update public.email_templates
   set body_markdown = $body$Hi {{name}},

It's been about 18 months since your South Sound Theatre Artists profile was last updated. We're checking in - are you still active in the community?

If we don't hear back in 30 days, we'll archive the profile. You can always come back and resubmit later.

To stay listed, click one of these:

[I'm still here]({{still_active_url}}) - one click, you're done.

[Update my profile]({{edit_url}}) - if you'd like to refresh your bio, headshot, or anything else.

Thanks for being part of the directory!

{{signature}}$body$
 where slug = 'stale_profile_ping';
