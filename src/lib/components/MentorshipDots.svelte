<!--
  MentorshipDots: small colored dots on a headshot signaling mentorship
  availability. Hover (desktop) or long-press (mobile) reveals exactly
  what they offer / want to learn via the native title attribute.

  Placement: the parent that contains this component must be
  position: relative (or some other containing block) since the dots
  are absolutely positioned in the corner.

  - Moss green dot (`--accent`): "Looking to learn" - growth.
  - Rust dot (`--warn`): "Open to mentoring" - guidance.

  Both, either, or neither can show. We ring each dot with the page
  background so it stays legible against any headshot tone.
-->
<script lang="ts">
  let {
    offering = [],
    seeking = [],
  }: { offering?: string[]; seeking?: string[] } = $props();
</script>

{#if offering.length > 0 || seeking.length > 0}
  <div class="dots" aria-hidden="false">
    {#if seeking.length > 0}
      <!-- Moss = mentee / growth. Rendered first so it sits to the left
           when both are present, which is the order Lexi described. -->
      <span
        class="dot mentee"
        title="Looking to learn: {seeking.join(', ')}"
        aria-label="Looking to learn {seeking.join(', ')}"
        role="img"
      ></span>
    {/if}
    {#if offering.length > 0}
      <span
        class="dot mentor"
        title="Open to mentoring in: {offering.join(', ')}"
        aria-label="Open to mentoring in {offering.join(', ')}"
        role="img"
      ></span>
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
    /* Above the headshot image but below any focus/hover overlay. */
    z-index: 1;
    /* Don't block clicks on the card itself - the dots themselves
       still get hover for tooltips because cursor: help is set below. */
    pointer-events: none;
  }
  .dot {
    display: block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    /* White-ish ring lifts the dot off any headshot color. Using
       --bg-raised so it picks up dark-mode without an override. */
    border: 2px solid var(--bg-raised);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
    pointer-events: auto;
    cursor: help;
  }
  .dot.mentee {
    background: var(--accent);
  }
  .dot.mentor {
    background: var(--warn);
  }
</style>
