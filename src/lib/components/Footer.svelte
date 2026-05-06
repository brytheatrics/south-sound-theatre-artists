<script lang="ts">
  import { renderMarkdownInline } from "$lib/util/markdown";
  import LogoMark from "./LogoMark.svelte";

  type Props = { tagline: string | null };
  let { tagline }: Props = $props();
</script>

<footer class="ft">
  <hr class="rule" />
  <div class="ft-row">
    <div class="ft-left">
      <a class="ft-mark" href="/" aria-label="South Sound Theatre Artists - home">
        <LogoMark height={24} />
      </a>
      {#if tagline}
        <span class="ft-tag">{@html renderMarkdownInline(tagline)}</span>
      {/if}
    </div>

    <!-- Centered emphasis link. Lives in two places by design: here for
         "discoverable" prominence, and in the header hamburger for
         "I-know-what-I-want" access. Moss accent draws the eye on a
         page mostly in muted tones. -->
    <div class="ft-center">
      <a class="ft-edit" href="/edit-link">Edit your profile</a>
    </div>

    <nav class="ft-links" aria-label="Footer">
      <!-- Social icons. Inline SVGs (no extra request, picks up the
           moss accent via currentColor on the link). -->
      <a
        class="ft-social"
        href="https://instagram.com/southsoundtheatreartists"
        target="_blank"
        rel="noopener"
        aria-label="South Sound Theatre Artists on Instagram"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"
          />
        </svg>
      </a>
      <a
        class="ft-social"
        href="https://facebook.com/southsoundtheatreartists"
        target="_blank"
        rel="noopener"
        aria-label="South Sound Theatre Artists on Facebook"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103.523.064.972.137 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"
          />
        </svg>
      </a>
      <a href="/about">About</a>
      <a href="/contact">Contact</a>
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
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1.5rem;
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
    justify-self: start;
  }
  .ft-mark {
    display: inline-flex;
    align-items: center;
    color: var(--ink);
    text-decoration: none;
  }
  .ft-center {
    justify-self: center;
  }
  .ft-edit {
    color: var(--accent);
    text-decoration: none;
    font-weight: 600;
    white-space: nowrap;
  }
  .ft-edit:hover {
    color: var(--ink);
    text-decoration: none;
  }
  .ft-links {
    display: flex;
    gap: 22px;
    flex-wrap: wrap;
    justify-self: end;
  }
  .ft-links a {
    color: var(--muted);
    text-decoration: none;
  }
  .ft-links a:hover {
    color: var(--ink);
  }
  .ft-social {
    display: inline-flex;
    align-items: center;
    color: var(--accent) !important;
  }
  .ft-social:hover {
    color: var(--ink) !important;
  }
  .ft-social svg {
    width: 16px;
    height: 16px;
    display: block;
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

  /* Mobile: stack vertically. Edit-your-profile keeps its centered
     prominence as the topmost item below the logo. */
  @media (max-width: 720px) {
    .ft-row {
      grid-template-columns: 1fr;
      text-align: center;
    }
    .ft-left {
      justify-self: center;
      justify-content: center;
    }
    .ft-links {
      justify-self: center;
      justify-content: center;
    }
  }
</style>
