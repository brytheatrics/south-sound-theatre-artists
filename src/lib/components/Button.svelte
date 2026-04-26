<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes, HTMLAnchorAttributes } from "svelte/elements";

  type Variant = "pri" | "acc" | "ghost";
  type Common = {
    variant?: Variant;
    children: Snippet;
  };
  type AsButton = Common & { href?: undefined } & HTMLButtonAttributes;
  type AsAnchor = Common & { href: string } & HTMLAnchorAttributes;
  type Props = AsButton | AsAnchor;

  let { variant = "pri", children, ...rest }: Props = $props();
</script>

{#if "href" in rest && rest.href}
  <a class="bt bt-{variant}" {...rest as HTMLAnchorAttributes}>
    {@render children()}
  </a>
{:else}
  <button class="bt bt-{variant}" {...rest as HTMLButtonAttributes}>
    {@render children()}
  </button>
{/if}

<style>
  .bt {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    padding: 11px 20px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    line-height: 1.2;
    transition: background-color 0.15s, color 0.15s, border-color 0.15s;
  }
  .bt-pri {
    background: var(--ink);
    color: var(--bg);
  }
  .bt-pri:hover:not(:disabled) {
    background: var(--accent);
    text-decoration: none;
  }
  .bt-acc {
    background: var(--accent);
    color: #fff;
  }
  .bt-acc:hover:not(:disabled) {
    background: var(--ink);
    text-decoration: none;
  }
  .bt-ghost {
    background: transparent;
    color: var(--ink);
    border-color: var(--rule);
  }
  .bt-ghost:hover:not(:disabled) {
    border-color: var(--ink);
    text-decoration: none;
  }
  .bt:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
