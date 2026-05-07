<script lang="ts">
  import { page } from "$app/state";
  let { data, children } = $props();

  const path = $derived(page.url.pathname);
  const isAuthRoute = $derived(path === "/admin/login" || path === "/admin/verify");

  // Sidebar grouping. The order works through the day: review queues
  // first (where the badges live), then the directory, then homepage
  // curation, then site copy, then config. A `group: true` flag draws a
  // separator above an item to break the flow visually.
  //
  // Per-section count keys map to data.queueCounts. Sections without a
  // key never show a badge.
  type CountKey = "pending" | "flaggedEdits" | "reports" | "callboard" | "orgs";
  type Section = { href: string; label: string; countKey?: CountKey; group?: true };
  const sections: Section[] = [
    // Review (top - daily queue work, badges land here)
    { href: "/admin", label: "Pending queue", countKey: "pending" },
    { href: "/admin/flagged-edits", label: "Edit review", countKey: "flaggedEdits" },
    { href: "/admin/reports", label: "Reports", countKey: "reports" },
    { href: "/admin/callboard", label: "Callboard", countKey: "callboard" },
    { href: "/admin/calendar", label: "Calendar" },
    { href: "/admin/organizations", label: "Organizations", countKey: "orgs" },

    // Directory
    { href: "/admin/profiles", label: "All profiles", group: true },

    // Homepage curation - listed in the order the elements appear on
    // the page itself (announcement banner up top, then the spotlight
    // and the marquee strip below it).
    { href: "/admin/banner", label: "Announcement", group: true },
    { href: "/admin/featured", label: "Featured" },
    { href: "/admin/marquee", label: "Homepage marquee" },

    // Site copy
    { href: "/admin/content", label: "Site content", group: true },
    { href: "/admin/resources", label: "Resources" },
    { href: "/admin/blog", label: "Blog" },
    { href: "/admin/templates", label: "Email templates" },

    // Config / reference data
    { href: "/admin/disciplines", label: "Disciplines", group: true },
    { href: "/admin/submit-form", label: "Submit form fields" },
    { href: "/admin/callboard-types", label: "Callboard types" },
    { href: "/admin/blocklist", label: "Blocklist" },
    { href: "/admin/admins", label: "Admins", group: true },
  ];

  function countFor(key: CountKey | undefined): number {
    if (!key) return 0;
    return data?.queueCounts?.[key] ?? 0;
  }

  const isOn = $derived((href: string) =>
    href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"),
  );

  // Remember the last admin TAB so the public-nav "Admin" pill bounces
  // Lexi back to the section she was in (Pending queue / All profiles /
  // Reports etc.) rather than a deep page like /admin/profiles/abc/edit.
  // Skips auth routes so we never persist /admin/login or /admin/verify.
  function sectionFor(p: string): string {
    // Sort longest-first so /admin/profiles wins over /admin.
    const sorted = [...sections].sort(
      (a, b) => b.href.length - a.href.length,
    );
    for (const s of sorted) {
      if (p === s.href || p.startsWith(s.href + "/")) return s.href;
    }
    return "/admin";
  }

  $effect(() => {
    if (typeof window === "undefined") return;
    if (isAuthRoute) return;
    try {
      window.localStorage.setItem("ssta_last_admin_path", sectionFor(path));
    } catch {
      // localStorage can fail in private mode / iOS edge cases - silent.
    }
  });
</script>

{#if isAuthRoute}
  {@render children()}
{:else}
  <div class="admin">
    <aside class="admin-side">
      <div class="admin-mark">
        <span class="dot" aria-hidden="true"></span>
        <span class="mark-text">SSTA Admin</span>
      </div>
      <nav class="admin-nav" aria-label="Admin">
        {#each sections as s (s.href)}
          {@const count = countFor(s.countKey)}
          <a
            href={s.href}
            class:on={isOn(s.href)}
            class:has-attn={count > 0}
            class:group-start={s.group}
            aria-current={isOn(s.href) ? "page" : undefined}
          >
            <span class="nav-label">{s.label}</span>
            {#if count > 0}
              <span class="nav-badge" aria-label="{count} item{count === 1 ? '' : 's'} needing attention">
                {count > 99 ? "99+" : count}
              </span>
            {/if}
          </a>
        {/each}
      </nav>
      <form method="POST" action="/admin/logout" class="admin-logout">
        <button type="submit">Sign out</button>
      </form>
    </aside>
    <div class="admin-main">
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .admin {
    display: grid;
    grid-template-columns: 240px 1fr;
    min-height: calc(100vh - 60px);
  }
  .admin-side {
    background: var(--paper);
    border-right: 1px solid var(--rule);
    padding: 1.5rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .admin-mark {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--ink);
  }
  .dot {
    width: 7px;
    height: 7px;
    background: var(--accent);
    border-radius: 50%;
  }
  .admin-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .admin-nav a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--ink-soft);
    text-decoration: none;
    border-radius: var(--radius);
    border-left: 2px solid transparent;
  }
  .admin-nav a:hover {
    background: var(--paper-2);
    color: var(--ink);
    text-decoration: none;
  }
  .admin-nav a.on {
    background: var(--bg-raised);
    color: var(--ink);
    border-left-color: var(--accent);
    font-weight: 500;
  }
  /* "Needs attention" tab: ink-tone label + accent badge so it reads at a
     glance without shouting. The badge is a small pill with the count. */
  .admin-nav a.has-attn {
    color: var(--ink);
    font-weight: 500;
  }
  /* Group separator: a visible rule above the first item of each
     section with a small amount of breathing room so the chunks read
     as distinct without the sidebar feeling stretched. Uses --rule
     (the standard divider tone) rather than --rule-soft so the line
     is actually legible. */
  .admin-nav a.group-start {
    margin-top: 5px;
    padding-top: 9px;
    border-top: 1px solid var(--rule);
  }
  .nav-label {
    flex: 1;
    min-width: 0;
  }
  .nav-badge {
    flex-shrink: 0;
    background: var(--accent);
    color: #fff;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 2px 7px;
    border-radius: 999px;
    line-height: 1.4;
    min-width: 20px;
    text-align: center;
  }
  .admin-logout {
    margin-top: auto;
  }
  .admin-logout button {
    background: transparent;
    border: 1px solid var(--rule);
    padding: 8px 14px;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--muted);
    cursor: pointer;
    border-radius: var(--radius);
    width: 100%;
  }
  .admin-logout button:hover {
    border-color: var(--ink);
    color: var(--ink);
  }
  .admin-main {
    padding: clamp(1.5rem, 3vw, 2.5rem) clamp(1.5rem, 3vw, 2.5rem);
  }
  @media (max-width: 720px) {
    .admin {
      grid-template-columns: 1fr;
    }
    .admin-side {
      border-right: 0;
      border-bottom: 1px solid var(--rule);
    }
    .admin-nav {
      flex-direction: row;
      flex-wrap: wrap;
    }
    /* Group separators don't translate to a horizontal row; suppress so
       the mobile nav doesn't get random gaps. */
    .admin-nav a.group-start {
      margin-top: 0;
      padding-top: 8px;
      border-top: 0;
    }
  }
</style>
