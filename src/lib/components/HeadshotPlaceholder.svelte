<script lang="ts">
  // Editorial headshot stand-in: paper-toned aspect-ratio box with the
  // artist's name in mono micro-text top-left and an abstract figure
  // silhouette. Used wherever we don't have a real headshot.

  type Props = {
    name: string;
    src?: string | null;
    ratio?: string;
    tone?: 0 | 1 | 2 | 3;
  };

  let { name, src = null, ratio = "1", tone = 0 }: Props = $props();

  const tones = [
    "linear-gradient(160deg, var(--paper), color-mix(in oklch, var(--paper), var(--ink) 6%))",
    "linear-gradient(160deg, color-mix(in oklch, var(--paper), var(--accent) 8%), var(--paper))",
    "linear-gradient(160deg, var(--paper), color-mix(in oklch, var(--paper), var(--accent) 5%))",
    "linear-gradient(160deg, color-mix(in oklch, var(--paper), var(--ink) 4%), var(--paper))",
  ];
</script>

<div class="hs" style:aspect-ratio={ratio} style:background={src ? "var(--paper)" : tones[tone]}>
  {#if src}
    <img {src} alt={name} loading="lazy" />
  {:else}
    <div class="hs-name">{name}</div>
    <div class="hs-fig" aria-hidden="true"></div>
  {/if}
</div>

<style>
  .hs {
    position: relative;
    overflow: hidden;
    background: var(--paper);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    border-radius: var(--radius);
  }
  .hs::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(
      135deg,
      transparent 0 8px,
      rgba(0, 0, 0, 0.025) 8px 9px
    );
    pointer-events: none;
  }
  .hs img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    position: relative;
    z-index: 1;
  }
  .hs-name {
    position: absolute;
    top: 10px;
    left: 12px;
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    color: var(--muted);
    text-transform: uppercase;
    z-index: 2;
  }
  .hs-fig {
    width: 60%;
    aspect-ratio: 1;
    background: var(--ink-soft);
    opacity: 0.18;
    border-radius: 50% 50% 0 0;
    position: relative;
    margin-bottom: -10%;
  }
  .hs-fig::before {
    content: "";
    position: absolute;
    width: 50%;
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--ink-soft);
    top: -22%;
    left: 25%;
  }
</style>
