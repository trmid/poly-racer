<script type="ts">
  import { push } from "svelte-spa-router";
  import { generate32bitSeed } from "../ts/random";
  push(`/race/${generate32bitSeed()}`);
</script>
<p>
  Redirecting to random race...
</p>