<script lang="ts">
  import { renderMarkdownInline } from "$lib/util/markdown";

  type Props = { tagline: string | null };
  let { tagline }: Props = $props();
</script>

<footer class="ft">
  <hr class="rule" />
  <div class="ft-row">
    <div class="ft-left">
      <a class="ft-mark" href="/" aria-label="South Sound Theatre Artists - home">
        <img class="ft-logo" src="/logo-short.svg" alt="" aria-hidden="true" />
      </a>
      {#if tagline}
        <span class="ft-tag">{@html renderMarkdownInline(tagline)}</span>
      {/if}
    </div>
    <nav class="ft-links" aria-label="Footer">
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
      <a href="/edit-link">Edit your profile</a>
      <a href="/support-us">Support us</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </nav>
  </div>
</footer>

<style>
  .ft {
    margin-top: 4rem;
    padding-bottom: 2rem;
  }
  .ft-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
    padding: 1.5rem var(--page-pad-x) 0;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .ft-left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .ft-mark {
    display: inline-flex;
    align-items: center;
    color: var(--ink);
    text-decoration: none;
  }
  .ft-logo {
    height: 24px;
    width: auto;
    display: block;
  }
  .ft-links {
    display: flex;
    gap: 22px;
    flex-wrap: wrap;
  }
  .ft-links a {
    color: var(--muted);
    text-decoration: none;
  }
  .ft-links a:hover {
    color: var(--ink);
  }
  .ft-tag :global(em) {
    font-family: var(--font-accent);
    font-style: italic;
    color: var(--accent);
  }
  .ft-tag :global(a) {
    color: var(--muted);
    text-decoration: none;
  }
  .ft-tag :global(a:hover) {
    color: var(--ink);
  }
</style>
