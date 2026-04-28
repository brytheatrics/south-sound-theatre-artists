<script lang="ts">
  import { page } from "$app/state";

  type Props = { isAdmin?: boolean };
  let { isAdmin = false }: Props = $props();

  type Link = { href: string; label: string };
  const links: Link[] = [
    { href: "/directory", label: "Directory" },
    { href: "/callboard", label: "Callboard" },
    { href: "/about", label: "About" },
  ];

  const path = $derived(page.url.pathname);
  const isActive = $derived((href: string) => path === href || path.startsWith(href + "/"));

  // Default the Admin pill to /admin, but if the admin layout has stashed
  // a more recent sub-page in localStorage, prefer that. Effect runs only
  // on the client after hydration, so SSR keeps the default href.
  let adminHref = $state("/admin");
  $effect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem("ssta_last_admin_path");
      if (
        saved &&
        saved.startsWith("/admin") &&
        saved !== "/admin/login" &&
        saved !== "/admin/verify"
      ) {
        adminHref = saved;
      }
    } catch {
      // localStorage may be unavailable in private mode - keep default.
    }
  });
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
    <a class="nv-admin" href={adminHref} aria-label="Go to admin panel">
      Admin
    </a>
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
