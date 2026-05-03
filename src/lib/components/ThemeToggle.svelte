<!--
  ThemeToggle: two-way Light / Dark control over the dark-mode class
  on <html>. Persists the choice in localStorage so it survives
  reloads. The bootstrap script in app.html applies the same logic
  before paint so there's no flash on initial load.

  No "Auto" mode - people kept getting unexpectedly dropped into dark
  because their OS reported prefers-color-scheme: dark even when their
  browser chrome was light (Windows 11 "Custom" mode is the common
  cause). First-time visitors get light by default; clicking Dark once
  persists for that browser.

  Stored under the key `ssta_theme` ("light" | "dark"). Absence = light.
-->
<script lang="ts">
  import { onMount } from "svelte";

  type Mode = "light" | "dark";
  const STORAGE_KEY = "ssta_theme";

  let mode = $state<Mode>("light");

  function applyMode(next: Mode) {
    mode = next;
    if (typeof window === "undefined") return;
    document.documentElement.classList.toggle("mode-dark", next === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // private mode / blocked storage; current-session change still applies.
    }
  }

  onMount(() => {
    // Read the persisted choice. Absence = light (the site's primary
    // aesthetic; dark is opt-in).
    let saved: Mode = "light";
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "dark") saved = "dark";
    } catch {
      // ignore
    }
    mode = saved;
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
