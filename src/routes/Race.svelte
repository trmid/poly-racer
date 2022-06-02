<script type="ts">
  import { link } from "svelte-spa-router";
  import { slug } from "../ts/simpleSlug";

  export let params: { seed: string | undefined } | undefined;
</script>

<h1>Race</h1>
<p>
  This is the race page.
</p>