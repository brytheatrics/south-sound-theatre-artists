<script lang="ts">
  type Props = { body: string };
  let { body }: Props = $props();
</script>

<div class="ann">
  <span class="ann-eyebrow" aria-hidden="true">★</span>
  <span class="ann-text">{body}</span>
</div>

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
    gap: 10px;
  }
  .ann-eyebrow {
    font-size: 11px;
  }
</style>
