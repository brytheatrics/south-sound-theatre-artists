<script lang="ts">
  // Modal shown when the artist's chosen URL is already taken. Lets them
  // pick from server-suggested free alternatives or type their own.

  import { validateSlug } from "$lib/util/slug";

  type Props = {
    open: boolean;
    requested: string;
    suggestions: string[];
    onPick: (slug: string) => void;
    onClose: () => void;
  };

  let { open, requested, suggestions, onPick, onClose }: Props = $props();

  let custom = $state("");
  let customError = $state("");

  function pick(s: string) {
    onPick(s);
  }

  function pickCustom() {
    const v = validateSlug(custom);
    if (!v.ok) {
      customError = v.reason;
      return;
    }
    onPick(custom);
  }
</script>

{#if open}
  <div
    class="backdrop"
    role="presentation"
    onclick={onClose}
    onkeydown={(e) => e.key === "Escape" && onClose()}
  >
    <div
      class="modal"
      role="dialog"
      tabindex="-1"
      aria-labelledby="collision-title"
      aria-modal="true"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <h2 id="collision-title">That URL is already taken</h2>
      <p>
        Someone else is using <code>/artists/{requested}</code>. Pick one of
        these or choose your own.
      </p>

      {#if suggestions.length > 0}
        <ul class="suggestions">
          {#each suggestions as s}
            <li>
              <button type="button" class="suggestion" onclick={() => pick(s)}>
                /artists/<strong>{s}</strong>
              </button>
            </li>
          {/each}
        </ul>
      {/if}

      <div class="custom">
        <label for="custom-slug">Or type your own:</label>
        <div class="custom-row">
          <span class="prefix">/artists/</span>
          <input
            id="custom-slug"
            type="text"
            bind:value={custom}
            placeholder="your-name"
            oninput={() => (customError = "")}
          />
          <button type="button" class="primary" onclick={pickCustom}>Use</button>
        </div>
        {#if customError}
          <p class="error" role="alert">{customError}</p>
        {/if}
      </div>

      <button type="button" class="cancel" onclick={onClose}>Cancel</button>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 1rem;
  }
  .modal {
    background: var(--bg-raised);
    border: 1px solid var(--rule);
    border-radius: var(--radius-lg);
    padding: 2rem;
    max-width: 480px;
    width: 100%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    font-family: var(--font-body);
    color: var(--ink);
  }
  h2 {
    margin: 0 0 0.5rem;
    font-family: var(--font-display);
    font-weight: 600;
    font-size: 24px;
    letter-spacing: -0.02em;
    color: var(--ink);
  }
  p {
    margin: 0 0 1.25rem;
    color: var(--ink-soft);
    font-size: 14px;
    line-height: 1.55;
  }
  code {
    background: var(--paper);
    padding: 2px 6px;
    border-radius: var(--radius);
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--ink);
  }
  .suggestions {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .suggestion {
    width: 100%;
    text-align: left;
    padding: 10px 14px;
    background: var(--paper);
    border: 1px solid transparent;
    border-radius: var(--radius);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--muted);
    transition: border-color 0.15s, color 0.15s;
  }
  .suggestion:hover {
    border-color: var(--ink);
    color: var(--ink);
  }
  .suggestion strong {
    color: var(--accent);
    font-weight: 500;
  }
  .custom {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--rule-soft);
  }
  .custom label {
    display: block;
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .custom-row {
    display: flex;
    align-items: stretch;
    gap: 8px;
  }
  .prefix {
    display: flex;
    align-items: center;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 0 4px;
  }
  .custom-row input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    font-size: 14px;
    font-family: var(--font-body);
    background: var(--bg);
    color: var(--ink);
  }
  .custom-row input:focus {
    outline: 2px solid var(--accent);
    outline-offset: -1px;
    border-color: var(--accent);
  }
  .primary {
    padding: 10px 18px;
    background: var(--ink);
    color: var(--bg);
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    font-weight: 500;
    font-size: 14px;
    font-family: var(--font-body);
  }
  .primary:hover {
    background: var(--accent);
  }
  .cancel {
    margin-top: 1.25rem;
    padding: 8px 14px;
    background: transparent;
    color: var(--muted);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    cursor: pointer;
    font-size: 13px;
    font-family: var(--font-body);
  }
  .cancel:hover {
    border-color: var(--ink);
    color: var(--ink);
  }
  .error {
    color: var(--error);
    font-size: 13px;
    margin: 6px 0 0;
  }
</style>
