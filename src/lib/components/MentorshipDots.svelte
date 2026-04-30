<!--
  MentorshipDots: small colored dots on a headshot signaling mentorship
  availability. Hover (desktop) or keyboard focus reveals a styled
  tooltip with the exact disciplines.

  Placement: the parent that contains this component must be
  position: relative so the dots anchor to the image, not the page.

  - Moss green dot (`--accent`): "Looking to learn" - growth.
  - Rust dot (`--warn`): "Open to mentoring" - guidance.

  Both, either, or neither can show. We ring each dot with the page
  background so it stays legible against any headshot tone.

  Tooltip is custom-styled to match the editorial paper look (italic
  serif accent + ink panel) instead of the browser's default title
  bubble, which felt generic. `aria-label` keeps it accessible to
  screen readers since the title attribute was removed.
-->
<script lang="ts">
  let {
    offering = [],
    seeking = [],
  }: { offering?: string[]; seeking?: string[] } = $props();
</script>

{#if offering.length > 0 || seeking.length > 0}
  <div class="dots">
    {#if seeking.length > 0}
      <!-- Moss = mentee / growth. Rendered first so it sits to the left
           when both are present, which is the order Lexi described.
           No tabindex - keeping every dot focusable would make tabbing
           through the directory tedious. aria-label covers the screen
           reader path; hover covers desktop. -->
      <span
        class="dot mentee"
        role="img"
        aria-label="Looking to learn {seeking.join(', ')}"
      >
        <span class="tip" role="tooltip">
          <span class="tip-label tip-label-mentee">Looking to learn</span>
          <span class="tip-body">{seeking.join(", ")}</span>
        </span>
      </span>
    {/if}
    {#if offering.length > 0}
      <span
        class="dot mentor"
        role="img"
        aria-label="Open to mentoring in {offering.join(', ')}"
      >
        <span class="tip" role="tooltip">
          <span class="tip-label tip-label-mentor">Open to mentoring in</span>
          <span class="tip-body">{offering.join(", ")}</span>
        </span>
      </span>
    {/if}
  </div>
{/if}

<style>
  .dots {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 5px;
    z-index: 1;
    /* Container is ignore-clicks; each dot opts in to pointer events
       below so the underlying card link still works on the rest of
       the headshot. */
    pointer-events: none;
  }
  .dot {
    /* Slightly bigger than the original 12px - 14 reads from across
       the card without being overbearing. */
    display: block;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--bg-raised);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    pointer-events: auto;
    cursor: help;
    /* Anchor for the absolutely-positioned tooltip. */
    position: relative;
  }
  .dot.mentee {
    background: var(--accent);
  }
  .dot.mentor {
    background: var(--warn);
  }

  /* ============================================================
     Tooltip
     ============================================================ */
  .tip {
    /* Position: above the dot, centered. The card edge can clip the
       sides at the right edge of the page; we cap max-width below
       and let it wrap rather than overflow obnoxiously. */
    position: absolute;
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    /* Hidden by default; opacity transition for a slight fade. */
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.12s ease, visibility 0s linear 0.12s;
    z-index: 20;

    display: flex;
    flex-direction: column;
    gap: 2px;
    /* Editorial panel: dark ink on cream, with a subtle paper border.
       Matches the eyebrow / serif-it tone the rest of the site
       uses, so it doesn't look like a transplanted browser bubble. */
    background: var(--ink);
    color: var(--bg);
    padding: 8px 12px;
    border-radius: var(--radius);
    box-shadow: 0 6px 20px -8px rgba(0, 0, 0, 0.35);

    /* Width: at least 160px, max ~240px so a long disciplines list
       wraps to two lines instead of stretching across the whole row. */
    min-width: 160px;
    max-width: 240px;
    width: max-content;
    font-family: var(--font-body);
    font-size: 12px;
    line-height: 1.4;
    text-align: left;
  }
  .tip-label {
    font-family: var(--font-accent);
    font-style: italic;
    font-size: 12px;
    line-height: 1.2;
    /* Keep the accent tone on the label so the paired-color
       relationship reads at a glance. */
  }
  .tip-label-mentee {
    color: var(--accent-soft, var(--accent));
  }
  .tip-label-mentor {
    /* Lighter rust on dark bg keeps it readable. */
    color: color-mix(in oklch, var(--warn), white 20%);
  }
  .tip-body {
    color: var(--bg);
    font-weight: 500;
    /* Allow wrapping. */
    white-space: normal;
  }

  /* Triangle pointer */
  .tip::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: var(--ink);
    pointer-events: none;
  }

  .dot:hover .tip {
    opacity: 1;
    visibility: visible;
    transition: opacity 0.12s ease, visibility 0s linear 0s;
  }
</style>
