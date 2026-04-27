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
    <svg
      class="hs-fig"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      aria-hidden="true"
    >
      <path
        d="M403.5-543.5Q372-575 372-620t31.5-76.5Q435-728 480-728t76.5 31.5Q588-665 588-620t-31.5 76.5Q525-512 480-512t-76.5-31.5ZM212-232v-52q0-22 13.5-41.5T262-356q55-26 109.5-39T480-408q54 0 108.5 13T698-356q23 11 36.5 30.5T748-284v52H212Zm28-28h480v-24q0-14-9.5-26.5T684-332q-48-23-99.69-35.5Q532.63-380 480-380t-104.31 12.5Q324-355 276-332q-17 9-26.5 21.5T240-284v24Zm296.5-303.5Q560-587 560-620t-23.5-56.5Q513-700 480-700t-56.5 23.5Q400-653 400-620t23.5 56.5Q447-540 480-540t56.5-23.5ZM480-620Zm0 360Z"
      />
    </svg>
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
    width: 55%;
    height: auto;
    fill: var(--ink-soft);
    opacity: 0.28;
    margin-bottom: 6%;
    position: relative;
    z-index: 1;
  }
</style>
