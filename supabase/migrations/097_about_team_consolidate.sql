-- 097_about_team_consolidate.sql
--
-- Drops the standalone "## Advisory committee" header on /about and
-- treats advisory committee members as part of the existing "## Our
-- Team" section (same visual treatment as Lexi). Each advisory member
-- gets a title shaped like "Advisory Committee, {Role}".
--
-- Seeds Blake York as the first advisory committee entry with
-- placeholder copy. Admin can replace the headshot + bio at any time
-- via /admin/content.

update public.site_content
   set body_markdown = $body$# A directory *for us*, by us.

South Sound Theatre Artists is a community initiative created to uplift and connect theatre makers across Tacoma, Olympia, Lakewood, Puyallup, Gig Harbor, Lacey, and the surrounding region. We offer visibility, accessible training, and networking so artists can find opportunities — and opportunities can find them.

## Mission

South Sound Theatre Artists (SSTA) strengthens the South Puget Sound theatre ecosystem by supporting local artists through professional development, networking, community-building, and increased visibility. We champion equitable access to artistic opportunities for directors, choreographers, designers, stage managers, performers, and emerging theatre leaders.

## Vision

A thriving, interconnected South Sound theatre community where:

- Artists are respected, supported, and seen
- Training and professional development are accessible to all
- Local theatres have strong talent pipelines
- Collaborations flourish across cities, companies, and communities
- Artists of all ages and identities feel welcome and valued
- Theatre becomes a sustainable, joyful part of community life

## Our story

For years, South Sound theatre artists have expressed a desire for more connection: a place to meet collaborators, share opportunities, and build skills without high cost barriers or Seattle-centric geography. SSTA was created to fill that need — a regional network designed by and for the artists who call the South Sound home.

## How the directory works

Anyone can browse. Submitting a profile takes about five minutes and one email-verification click. An admin reviews each new profile and publishes it, usually within a day or two. Edits go through a magic link to your own email — no passwords, no recovery flows.

## Our Team

![Lexi Barnett](https://res.cloudinary.com/dh362nxzx/image/upload/v1777504451/headshots/fsqsjrggnie6wiauycfh.jpg)

### Lexi Barnett, Founding Artistic Director

With 20 years of experience as a director, choreographer, performer, and educator, Lexi has led programs in Tacoma, Olympia, and surrounding communities, including serving as Artistic Director of Broadway Olympia, Director of the Family Theatre Program at Tacoma Musical Playhouse, and Director of KidCo. Productions. She holds an M.F.A. in Directing and Theatre for Young Audiences and a B.A. in Acting and Community Arts in Practice. Driven by the belief that theatre thrives when artists are supported, connected, and empowered, she continues to build spaces where creativity, collaboration, and belonging flourish in the South Sound.

### Blake York, Advisory Committee, Web Developer

*Headshot and bio coming soon.*

## Behind the scenes

The directory side of SSTA is maintained by a single volunteer admin. Hosting, email, and image storage all run on free tiers. If it ever stops being free, the goal is to find another free way before charging anyone.$body$
 where slug = 'about';
