<script lang="ts">
	import Router, { link } from "svelte-spa-router";
  import { routes } from "./routes";
</script>

<main>
  <header>
    <a href="/" use:link>Home</a>
    <a href="/about" use:link>About</a>
    <a href="/404" use:link>404</a>
  </header>
	<Router {routes}/>
</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		max-width: 1024px;
		margin: 0 auto;
	}

  header a {
    margin: 1rem;
  }
</style>