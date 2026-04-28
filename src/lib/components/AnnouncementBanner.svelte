<script lang="ts">
  import { onMount } from "svelte";

  // Mirrors src/routes/+layout.server.ts BannerItem - kept inline to
  // dodge an awkward cross-directory $types import.
  type BannerItem = { body: string; href: string | null };

  // Backwards-compatible: accept either a string (legacy single-message)
  // or an array of items (custom body + selected callboard posts).
  type Props = { body: string | BannerItem[] | null };
  let { body }: Props = $props();

  // Normalise to an items array so the rest of the component is uniform.
  const items = $derived<BannerItem[]>(
    Array.isArray(body)
      ? body
      : typeof body === "string" && body.trim()
      ? [{ body: body.trim(), href: null }]
      : [],
  );

  let index = $state(0);
  // Reset index when the items list changes (e.g. SPA nav).
  $effect(() => {
    if (index >= items.length) index = 0;
  });

  // Rotate every 6s when there are 2+ items. Pause on hover so visitors
  // get a chance to read the message they're hovering. No-op on the
  // server.
  let paused = $state(false);
  onMount(() => {
    if (items.length < 2) return;
    const t = setInterval(() => {
      if (!paused) index = (index + 1) % items.length;
    }, 6000);
    return () => clearInterval(t);
  });

  const current = $derived(items[index] ?? null);
</script>

{#if current}
  <div
    class="ann"
    role={items.length > 1 ? "region" : undefined}
    aria-label={items.length > 1 ? "Announcement, rotating" : undefined}
    aria-live="polite"
    onmouseenter={() => (paused = true)}
    onmouseleave={() => (paused = false)}
  >
    <span class="ann-eyebrow" aria-hidden="true">★</span>
    {#if current.href}
      <a class="ann-link" href={current.href}>{current.body}</a>
    {:else}
      <span class="ann-text">{current.body}</span>
    {/if}
    {#if items.length > 1}
      <span class="ann-dots" aria-hidden="true">
        {#each items as _, i}
          <button
            type="button"
            class="ann-dot"
            class:on={i === index}
            onclick={() => (index = i)}
            aria-label="Show message {i + 1}"
          ></button>
        {/each}
      </span>
    {/if}
  </div>
{/if}

<style>
  .ann {
    background: var(--accent);
    color: #fff;
    padding: 10px var(--page-pad-x);
    font-family: var(--font-body);
    font-size: 14px;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .ann-eyebrow {
    font-size: 11px;
  }
  .ann-link {
    color: #fff;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .ann-link:hover {
    text-decoration: none;
  }
  .ann-dots {
    display: inline-flex;
    gap: 5px;
    align-items: center;
  }
  .ann-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.45);
    border: 0;
    padding: 0;
    cursor: pointer;
    transition: background 0.15s;
  }
  .ann-dot:hover { background: rgba(255, 255, 255, 0.7); }
  .ann-dot.on { background: #fff; }
</style>
