<!--
  ThemeToggle: three-way Light / Dark / Auto control over the dark-mode
  class on <html>. Persists the choice in localStorage so it survives
  reloads. The bootstrap script in app.html applies the same logic
  before paint so there's no flash on initial load.

  - Light: explicit, OS preference ignored.
  - Dark: explicit, OS preference ignored.
  - Auto (default if no preference saved): follows the OS
    `prefers-color-scheme` setting and stays in sync if the user
    flips it while the page is open.

  Stored under the key `ssta_theme` ("light" | "dark") - the Auto
  state is represented by the absence of the key so we don't have to
  reconcile a third value with the bootstrap.
-->
<script lang="ts">
  import { onMount } from "svelte";

  type Mode = "light" | "dark" | "auto";
  const STORAGE_KEY = "ssta_theme";

  let mode = $state<Mode>("auto");
  let mediaQuery: MediaQueryList | null = null;

  function applyMode(next: Mode) {
    mode = next;
    if (typeof window === "undefined") return;
    const html = document.documentElement;
    let dark: boolean;
    if (next === "dark") dark = true;
    else if (next === "light") dark = false;
    else
      dark =
        !!mediaQuery &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
    html.classList.toggle("mode-dark", dark);

    try {
      if (next === "auto") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // private mode / blocked storage; current-session change still applies.
    }
  }

  onMount(() => {
    // Read the persisted choice. Absence = auto.
    let saved: Mode = "auto";
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "light" || v === "dark") saved = v;
    } catch {
      // ignore
    }
    mode = saved;

    // Listen for OS preference changes so Auto stays in sync.
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (mode === "auto") {
        document.documentElement.classList.toggle("mode-dark", mediaQuery!.matches);
      }
    };
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery?.removeEventListener("change", onChange);
  });
</script>

<div class="theme-toggle" role="group" aria-label="Theme">
  <span class="label">Theme</span>
  <div class="opts">
    <button
      type="button"
      class:on={mode === "light"}
      onclick={() => applyMode("light")}
      aria-pressed={mode === "light"}
    >Light</button>
    <button
      type="button"
      class:on={mode === "dark"}
      onclick={() => applyMode("dark")}
      aria-pressed={mode === "dark"}
    >Dark</button>
    <button
      type="button"
      class:on={mode === "auto"}
      onclick={() => applyMode("auto")}
      aria-pressed={mode === "auto"}
    >Auto</button>
  </div>
</div>

<style>
  .theme-toggle {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 12px;
  }
  .label {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--muted);
  }
  .opts {
    display: inline-flex;
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: 100px;
    padding: 2px;
  }
  .opts button {
    flex: 1;
    background: transparent;
    border: 0;
    padding: 4px 12px;
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--ink-soft);
    cursor: pointer;
    border-radius: 100px;
    transition: background 0.12s, color 0.12s;
  }
  .opts button:hover {
    color: var(--ink);
  }
  .opts button.on {
    background: var(--ink);
    color: var(--bg);
  }
  .opts button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
</style>
