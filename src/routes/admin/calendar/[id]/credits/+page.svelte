<script lang="ts">
  import ProductionCreditsEditor from "$lib/components/ProductionCreditsEditor.svelte";
  let { data } = $props();
  type Org = { name: string; slug: string };
  type Production = { id: string; title: string; run_start: string; organizations: Org | Org[] | null };
  // svelte-ignore state_referenced_locally
  const p: Omit<Production, "organizations"> & { organizations: Org | null } = (() => {
    const raw = data.production as Production;
    const orgFirst = Array.isArray(raw.organizations) ? raw.organizations[0] ?? null : raw.organizations;
    return { ...raw, organizations: orgFirst };
  })();
</script>

<svelte:head>
  <title>{p.title} - Credits - Admin</title>
</svelte:head>

<div class="page">
  <header class="head">
    <p class="crumb">
      <a href={`/admin/calendar/${p.id}/edit`}>← Production editor</a>
    </p>
    <h1 class="t">Credits for {p.title}</h1>
    <p class="sub">
      {p.organizations?.name ?? "Unknown organization"} · opens {new Date(p.run_start + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
    </p>
    <p class="public-link">
      <a href={`/calendar/${p.id}`} target="_blank" rel="noopener">View public production page <span aria-hidden="true">↗</span></a>
    </p>
  </header>

  <ProductionCreditsEditor
    initial={data.credits}
    apiBase={`/api/admin/productions/${p.id}`}
  />
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 920px;
  }
  .head {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .crumb {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .crumb a {
    color: var(--muted);
    text-decoration: none;
  }
  .crumb a:hover {
    color: var(--ink);
  }
  .t {
    margin: 0;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 28px;
    letter-spacing: -0.02em;
    color: var(--ink);
  }
  .sub {
    margin: 0;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--ink-soft);
  }
  .public-link {
    margin: 0;
    font-family: var(--font-body);
    font-size: 13px;
  }
  .public-link a {
    color: var(--accent);
  }
</style>
