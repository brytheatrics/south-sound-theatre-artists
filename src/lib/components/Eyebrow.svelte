<script lang="ts">
  type Props = {
    num?: string | number;
    children: import("svelte").Snippet;
  };
  let { num, children }: Props = $props();
</script>

<span class="eyebrow">
  {#if num !== undefined}<span class="num">{num}</span>{/if}
  {@render children()}
</span>
