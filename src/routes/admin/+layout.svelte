<script lang="ts">
  import { page } from "$app/state";
  let { children } = $props();

  const path = $derived(page.url.pathname);
  const isAuthRoute = $derived(path === "/admin/login" || path === "/admin/verify");

  type Section = { href: string; label: string };
  const sections: Section[] = [
    { href: "/admin", label: "Pending queue" },
    { href: "/admin/profiles", label: "All profiles" },
    { href: "/admin/reports", label: "Reports" },
    { href: "/admin/featured", label: "Featured" },
    { href: "/admin/content", label: "Site content" },
    { href: "/admin/banner", label: "Announcement" },
    { href: "/admin/templates", label: "Email templates" },
    { href: "/admin/disciplines", label: "Disciplines" },
    { href: "/admin/blocklist", label: "Blocklist" },
  ];

  const isOn = $derived((href: string) =>
    href === "/admin" ? path === "/admin" : path === href || path.startsWith(href + "/"),
  );
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
          <a href={s.href} class:on={isOn(s.href)} aria-current={isOn(s.href) ? "page" : undefined}>
            {s.label}
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
  }
</style>
