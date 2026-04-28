<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { env } from "$env/dynamic/public";

  type Props = { isAdmin?: boolean };
  let { isAdmin = false }: Props = $props();

  // Build the GoatCounter dashboard URL when the analytics code is set.
  // Empty string = no analytics integration yet, hide the pill.
  const analyticsUrl = env.PUBLIC_GOATCOUNTER_CODE
    ? `https://${env.PUBLIC_GOATCOUNTER_CODE}.goatcounter.com`
    : "";

  type Link = { href: string; label: string };
  const links: Link[] = [
    { href: "/directory", label: "Directory" },
    { href: "/callboard", label: "Callboard" },
    { href: "/resources", label: "Resources" },
    { href: "/about", label: "About" },
  ];

  const path = $derived(page.url.pathname);
  const isActive = $derived((href: string) => path === href || path.startsWith(href + "/"));

  // Read localStorage at click time (not via $effect) so we always see
  // the freshest value. Effects fire in document order and Nav is above
  // the admin layout, so an effect-based read happens before the layout
  // has had a chance to write the latest tab.
  function onAdminClick(e: MouseEvent) {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem("ssta_last_admin_path");
      if (
        saved &&
        saved !== "/admin" &&
        saved.startsWith("/admin") &&
        saved !== "/admin/login" &&
        saved !== "/admin/verify"
      ) {
        e.preventDefault();
        goto(saved);
      }
    } catch {
      // Fall through to the default href = /admin.
    }
  }
</script>

<nav class="nv">
  <a class="nv-left" href="/" aria-label="South Sound Theatre Artists - home">
    <img class="nv-logo" src="/logo-short.svg" alt="" aria-hidden="true" />
  </a>
  <div class="nv-links" aria-label="Primary">
    {#each links as link (link.href)}
      <a
        href={link.href}
        class:on={isActive(link.href)}
        aria-current={isActive(link.href) ? "page" : undefined}
      >
        {link.label}
      </a>
    {/each}
  </div>
  {#if isAdmin}
    <a
      class="nv-admin"
      href="/admin"
      aria-label="Go to admin panel"
      onclick={onAdminClick}
    >
      Admin
    </a>
    {#if analyticsUrl}
      <a
        class="nv-admin nv-analytics"
        href={analyticsUrl}
        target="_blank"
        rel="noopener"
        aria-label="View analytics dashboard (opens in new tab)"
      >
        View analytics <span aria-hidden="true">↗</span>
      </a>
    {/if}
  {/if}
  <a class="nv-cta" href="/submit">
    Submit <span aria-hidden="true">↗</span>
  </a>
</nav>

<style>
  .nv {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
    padding: 18px var(--page-pad-x);
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
    border-bottom: 1px solid var(--rule);
    background: var(--bg);
  }
  .nv-left {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--ink);
    text-decoration: none;
  }
  .nv-left:hover {
    text-decoration: none;
  }
  .nv-logo {
    height: 32px;
    width: auto;
    display: block;
  }
  .nv-links {
    display: flex;
    gap: 26px;
    flex-wrap: wrap;
  }
  .nv-links a {
    color: var(--muted);
    text-decoration: none;
    cursor: pointer;
  }
  .nv-links a:hover,
  .nv-links a.on {
    color: var(--ink);
    text-decoration: none;
  }
  .nv-cta {
    color: var(--accent);
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
  }
  .nv-cta:hover {
    text-decoration: none;
    color: var(--ink);
  }
  .nv-admin {
    color: var(--ink);
    background: var(--paper);
    padding: 5px 11px;
    border-radius: 100px;
    font-weight: 500;
    text-decoration: none;
    white-space: nowrap;
    border: 1px solid var(--rule);
  }
  .nv-admin:hover {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
    text-decoration: none;
  }

  @media (max-width: 640px) {
    .nv {
      flex-wrap: wrap;
      padding: 14px var(--page-pad-x);
    }
    .nv-links {
      order: 3;
      width: 100%;
      justify-content: center;
      gap: 18px;
      padding-top: 12px;
      border-top: 1px solid var(--rule-soft);
      margin-top: 6px;
    }
  }
</style>
