<script lang="ts">
  import StaticPage from "$lib/components/StaticPage.svelte";
  let { data } = $props();
</script>

<StaticPage title={data.content.title} bodyMarkdown={data.content.body_markdown} eyebrow="Contact" />
