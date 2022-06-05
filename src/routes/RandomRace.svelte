<script type="ts">
  import { link } from "svelte-spa-router";
  import { push } from "svelte-spa-router";
  import { generate32bitSeed } from "../ts/random";
  push(`/race/${generate32bitSeed()}`);
</script>
<p>
  Redirecting to random race...
</p>

<h3>Some Nice Tracks:</h3>
<ol>
  <li><a href="/race/3ee46eb0" use:link>3ee46eb0</a></li>
  <li><a href="/race/c19b919d" use:link>c19b919d</a></li>
</ol>