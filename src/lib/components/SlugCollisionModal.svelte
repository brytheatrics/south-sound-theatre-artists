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
    background: white;
    border-radius: 8px;
    padding: 1.5rem;
    max-width: 480px;
    width: 100%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  }
  h2 {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
  }
  p {
    margin: 0 0 1rem;
    color: #444;
  }
  code {
    background: #f0f0f0;
    padding: 0.1rem 0.3rem;
    border-radius: 3px;
    font-size: 0.9rem;
  }
  .suggestions {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .suggestion {
    width: 100%;
    text-align: left;
    padding: 0.6rem 0.8rem;
    background: #f7f7f7;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.95rem;
  }
  .suggestion:hover {
    background: #ebebeb;
    border-color: #999;
  }
  .suggestion strong {
    color: #2d1f3d;
  }
  .custom {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #eee;
  }
  .custom label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.4rem;
  }
  .custom-row {
    display: flex;
    align-items: stretch;
    gap: 0.5rem;
  }
  .prefix {
    display: flex;
    align-items: center;
    color: #666;
    font-size: 0.9rem;
  }
  .custom-row input {
    flex: 1;
    padding: 0.5rem 0.7rem;
    border: 1px solid #aaa;
    border-radius: 6px;
    font-size: 1rem;
    font-family: inherit;
  }
  .primary {
    padding: 0.5rem 1rem;
    background: #38817d;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.95rem;
  }
  .primary:hover {
    background: #2d6b67;
  }
  .cancel {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: white;
    color: #666;
    border: 1px solid #ccc;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.95rem;
  }
  .cancel:hover {
    background: #f5f5f5;
  }
  .error {
    color: #c00;
    font-size: 0.85rem;
    margin: 0.4rem 0 0;
  }
</style>
