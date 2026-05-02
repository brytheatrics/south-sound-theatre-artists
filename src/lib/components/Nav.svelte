<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { env } from "$env/dynamic/public";
  import ThemeToggle from "./ThemeToggle.svelte";
  import LogoMark from "./LogoMark.svelte";

  type Props = { isAdmin?: boolean };
  let { isAdmin = false }: Props = $props();

  // Build the GoatCounter dashboard URL when the analytics code is set.
  // Empty string = no analytics integration yet, hide the pill.
  const analyticsUrl = env.PUBLIC_GOATCOUNTER_CODE
    ? `https://${env.PUBLIC_GOATCOUNTER_CODE}.goatcounter.com`
    : "";

  type Link = { href: string; label: string };
  // Primary nav: the three places people come to *do* something.
  // Reference content (About, Contact, etc.) lives in the hamburger
  // overflow menu so the header reads cleanly.
  const links: Link[] = [
    { href: "/directory", label: "Directory" },
    { href: "/callboard", label: "Callboard" },
    { href: "/resources", label: "Resources" },
  ];

  // Hamburger menu items: secondary destinations, organized roughly by
  // "learn" -> "act" -> "legal".
  const menuLinks: Link[] = [
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
    { href: "/edit-link", label: "Edit your profile" },
    { href: "/support-us", label: "Support us" },
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
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

  // Hamburger menu open state. Close on outside click + Escape so it
  // behaves like a normal native overflow menu.
  let menuOpen = $state(false);
  let menuRoot: HTMLDivElement | undefined = $state();

  function toggleMenu() {
    menuOpen = !menuOpen;
  }
  function closeMenu() {
    menuOpen = false;
  }
  function handleDocClick(e: MouseEvent) {
    if (!menuRoot) return;
    if (!menuRoot.contains(e.target as Node)) menuOpen = false;
  }
  function handleKey(e: KeyboardEvent) {
    if (e.key === "Escape") menuOpen = false;
  }

  $effect(() => {
    if (!menuOpen) return;
    document.addEventListener("click", handleDocClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("click", handleDocClick);
      document.removeEventListener("keydown", handleKey);
    };
  });
</script>

<nav class="nv">
  <a class="nv-left" href="/" aria-label="South Sound Theatre Artists - home">
    <LogoMark height={32} />
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
  <div class="nv-menu-wrap" bind:this={menuRoot}>
    <button
      type="button"
      class="nv-menu-btn"
      onclick={toggleMenu}
      aria-label="More links"
      aria-expanded={menuOpen}
      aria-haspopup="menu"
    >
      <span class="nv-menu-bars" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </span>
    </button>
    {#if menuOpen}
      <div class="nv-menu" role="menu">
        {#each menuLinks as link (link.href)}
          <a
            role="menuitem"
            href={link.href}
            class:on={isActive(link.href)}
            onclick={closeMenu}
          >
            {link.label}
          </a>
        {/each}
        <hr class="menu-rule" />
        <ThemeToggle />
      </div>
    {/if}
  </div>
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

  /* Hamburger overflow menu */
  .nv-menu-wrap {
    position: relative;
  }
  .nv-menu-btn {
    background: transparent;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    padding: 7px 9px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--ink);
  }
  .nv-menu-btn:hover {
    border-color: var(--ink);
  }
  .nv-menu-btn[aria-expanded="true"] {
    background: var(--paper);
    border-color: var(--ink);
  }
  .nv-menu-bars {
    display: inline-flex;
    flex-direction: column;
    justify-content: space-between;
    width: 16px;
    height: 12px;
  }
  .nv-menu-bars span {
    display: block;
    height: 2px;
    width: 100%;
    background: currentColor;
    border-radius: 1px;
  }
  .nv-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    background: var(--bg-raised);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    box-shadow: 0 8px 24px -10px rgba(0, 0, 0, 0.25);
    min-width: 200px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    z-index: 50;
    /* Reset to normal-case inside the menu so links read like body text. */
    font-family: var(--font-body);
    font-size: 14px;
    letter-spacing: normal;
    text-transform: none;
    color: var(--ink);
  }
  .nv-menu a {
    color: var(--ink-soft);
    text-decoration: none;
    padding: 8px 12px;
    border-radius: var(--radius);
  }
  .nv-menu a:hover,
  .nv-menu a.on {
    background: var(--paper);
    color: var(--ink);
  }
  .menu-rule {
    border: 0;
    border-top: 1px solid var(--rule);
    margin: 6px 0;
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
