<script lang="ts">
  // Themed confirm dialog. Replaces window.confirm() per project rule.
  // Caller manages open state; the modal handles backdrop, escape, focus.
  //
  // Usage:
  //   <ConfirmModal
  //     open={pending !== null}
  //     title="Move to trash?"
  //     body="..."
  //     confirmLabel="Move to trash"
  //     variant="warn"
  //     onConfirm={runAction}
  //     onClose={() => pending = null}
  //   />

  type Variant = "default" | "warn";

  type Props = {
    open: boolean;
    title: string;
    body?: string;
    confirmLabel: string;
    cancelLabel?: string;
    variant?: Variant;
    onConfirm: () => void;
    onClose: () => void;
  };

  let {
    open,
    title,
    body,
    confirmLabel,
    cancelLabel = "Cancel",
    variant = "default",
    onConfirm,
    onClose,
  }: Props = $props();

  let confirmBtn: HTMLButtonElement | undefined = $state();

  $effect(() => {
    if (open && confirmBtn) confirmBtn.focus();
  });

  function onKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <div
    class="backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-modal-title"
    onclick={onClose}
    onkeydown={(e) => e.key === "Enter" && e.target === e.currentTarget && onClose()}
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="card" role="document" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()} tabindex="-1">
      <span class="eyebrow">
        <span class="num">·</span>{variant === "warn" ? "Heads up" : "Confirm"}
      </span>
      <h2 id="confirm-modal-title" class="title">{title}</h2>
      {#if body}<p class="body">{body}</p>{/if}
      <div class="actions">
        <button type="button" class="bt ghost" onclick={onClose}>{cancelLabel}</button>
        <button
          type="button"
          class="bt confirm"
          class:warn={variant === "warn"}
          onclick={onConfirm}
          bind:this={confirmBtn}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(14, 13, 12, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    z-index: 1000;
    animation: fadeIn 120ms ease-out;
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .card {
    background: var(--bg-raised);
    border: 1px solid var(--rule);
    border-radius: var(--radius-lg);
    padding: 1.75rem;
    max-width: 460px;
    width: 100%;
    box-shadow: 0 24px 56px rgba(14, 13, 12, 0.22);
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    animation: slideIn 160ms ease-out;
  }
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .eyebrow {
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    display: inline-flex;
    gap: 8px;
    align-items: center;
  }
  .num {
    color: var(--accent);
  }
  .title {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--ink);
    font-size: 24px;
    margin: 0.25rem 0 0;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }
  .body {
    font-family: var(--font-body);
    font-size: 15px;
    color: var(--ink-soft);
    line-height: 1.55;
    margin: 0.5rem 0 0;
  }
  .actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 1.25rem;
    flex-wrap: wrap;
  }
  .bt {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 500;
    padding: 9px 18px;
    border-radius: var(--radius);
    cursor: pointer;
    border: 1px solid transparent;
    line-height: 1.2;
  }
  .ghost {
    background: transparent;
    color: var(--ink);
    border-color: var(--rule);
  }
  .ghost:hover {
    border-color: var(--ink);
  }
  .confirm {
    background: var(--ink);
    color: var(--bg);
  }
  .confirm:hover {
    background: var(--accent);
  }
  .confirm.warn {
    background: var(--warn);
    color: var(--bg);
  }
  .confirm.warn:hover {
    background: var(--error);
  }
</style>
