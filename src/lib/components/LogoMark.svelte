<!--
  LogoMark: inline SVG of the SSTA wordmark + mask brackets. Inline so
  the strokes/fills can read CSS variables — that way the logo retones
  automatically in dark mode (ink -> cream, moss accent -> rust). Path
  data preserved verbatim from static/logo-short.svg.

  Usage: <LogoMark height="32" /> for the header, <LogoMark height="24" />
  for the footer. Pass any string ('1.5rem', '20px') or a number (px).
-->
<script lang="ts">
  type Props = {
    /** Visual height of the logo. Width auto-scales from the viewBox. */
    height?: string | number;
  };
  let { height = 32 }: Props = $props();

  const heightStr = $derived(
    typeof height === "number" ? `${height}px` : String(height),
  );
</script>

<svg
  viewBox="0 0 1184.27 300.38"
  style="height: {heightStr};"
  class="logo"
  aria-hidden="true"
  focusable="false"
>
  <g class="wordmark">
    <path d="M572.13,263.52c-13.49,0-25.22-2.42-35.18-7.25-9.97-4.83-17.67-11.67-23.1-20.54-5.44-8.86-8.15-19.22-8.15-31.11h15.1c0,13.69,4.68,24.67,14.04,32.92,9.36,8.26,21.79,12.38,37.3,12.38s26.92-3.77,35.48-11.32c8.56-7.55,12.83-18.07,12.83-31.56,0-11.67-3.32-21.84-9.97-30.5-6.64-8.65-15.7-14.69-27.18-18.12l-25.37-7.55c-14.5-4.43-25.82-11.83-33.97-22.2-8.15-10.37-12.23-22.7-12.23-37,0-11.27,2.46-20.99,7.4-29.14,4.93-8.15,11.98-14.44,21.14-18.88,9.16-4.43,19.88-6.64,32.16-6.64,18.52,0,33.17,5.19,43.94,15.55,10.77,10.37,16.16,24.51,16.16,42.43h-15.1c0-13.49-4.13-24.26-12.38-32.31-8.26-8.05-19.23-12.08-32.92-12.08s-25.17,3.53-33.22,10.57c-8.05,7.05-12.08,16.81-12.08,29.29,0,10.87,3.12,20.38,9.36,28.54,6.24,8.15,14.69,13.94,25.37,17.37l25.37,7.85c14.9,4.63,26.73,12.49,35.48,23.56,8.76,11.07,13.14,23.86,13.14,38.35,0,11.68-2.57,21.8-7.7,30.35-5.13,8.56-12.43,15.2-21.9,19.93-9.47,4.73-20.74,7.1-33.82,7.1Z"/>
    <path d="M753.33,263.52c-13.49,0-25.22-2.42-35.18-7.25-9.97-4.83-17.67-11.67-23.1-20.54-5.44-8.86-8.15-19.22-8.15-31.11h15.1c0,13.69,4.68,24.67,14.04,32.92,9.36,8.26,21.79,12.38,37.3,12.38s26.92-3.77,35.48-11.32c8.56-7.55,12.83-18.07,12.83-31.56,0-11.67-3.32-21.84-9.97-30.5-6.64-8.65-15.7-14.69-27.18-18.12l-25.37-7.55c-14.5-4.43-25.82-11.83-33.97-22.2-8.15-10.37-12.23-22.7-12.23-37,0-11.27,2.46-20.99,7.4-29.14,4.93-8.15,11.98-14.44,21.14-18.88,9.16-4.43,19.88-6.64,32.16-6.64,18.52,0,33.17,5.19,43.94,15.55,10.77,10.37,16.16,24.51,16.16,42.43h-15.1c0-13.49-4.13-24.26-12.38-32.31-8.26-8.05-19.23-12.08-32.92-12.08s-25.17,3.53-33.22,10.57c-8.05,7.05-12.08,16.81-12.08,29.29,0,10.87,3.12,20.38,9.36,28.54,6.24,8.15,14.69,13.94,25.37,17.37l25.37,7.85c14.9,4.63,26.73,12.49,35.48,23.56,8.76,11.07,13.14,23.86,13.14,38.35,0,11.68-2.57,21.8-7.7,30.35-5.13,8.56-12.43,15.2-21.9,19.93-9.47,4.73-20.74,7.1-33.82,7.1Z"/>
    <path d="M925.76,260.5V53.93h-65.23v-13.89h144.96v13.89h-64.63v206.57h-15.1Z"/>
    <path d="M1044.15,260.5l60.7-220.46h18.72l60.7,220.46h-15.7l-16.91-63.42h-75.5l-16.91,63.42h-15.1ZM1079.78,183.49h68.25l-23.86-89.09c-2.82-10.87-5.09-19.98-6.79-27.33-1.71-7.35-2.77-12.13-3.17-14.34-.41,2.22-1.51,7-3.32,14.34-1.81,7.35-4.13,16.46-6.95,27.33l-24.16,89.09Z"/>
  </g>
  <g class="mask-left">
    <path class="bracket-square" d="M105.13,6H6v288.38h99.13"/>
    <path class="bracket-curve" d="M54.06,174.07c28.04,22.67,56.07,22.67,84.11,0"/>
  </g>
  <g class="mask-right">
    <path class="bracket-square" d="M265.53,6h99.13v288.38h-99.13"/>
    <path class="bracket-curve" d="M232.49,191.13c28.04-22.67,56.07-22.67,84.11,0"/>
  </g>
</svg>

<style>
  .logo {
    width: auto;
    display: block;
  }
  /* The wordmark + left mask use the ink color (cream in dark mode). */
  .wordmark path {
    fill: var(--ink);
  }
  .mask-left .bracket-square,
  .mask-left .bracket-curve {
    fill: none;
    stroke: var(--ink);
  }
  /* The right mask uses the accent (moss in light, rust in dark). */
  .mask-right .bracket-square,
  .mask-right .bracket-curve {
    fill: none;
    stroke: var(--accent);
  }
  /* Stroke style preserved from the original. */
  .bracket-square {
    stroke-width: 12px;
    stroke-linecap: square;
  }
  .bracket-curve {
    stroke-width: 10px;
    stroke-linecap: round;
  }
</style>
