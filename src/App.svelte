<script lang="ts">
	import Router, { link } from "svelte-spa-router";
  import { routes } from "./routes";
</script>

<header>
  <div class="headerContent">
    <a href="/" use:link>Home</a>
    <a href="/race" use:link>Race</a>
    <a href="/about" use:link>About</a>
  </div>
</header>

<main>
	<Router {routes}/>
</main>

<style>

  header {
    display: flex;
    justify-content: center;
    background-color: #ee3b2b;
    border-bottom: 2px solid black;
  }

  header .headerContent {
    max-width: 1024px;
    padding: .5em;
  }

  header a {
    margin: 0 1.5em;
    color: white;
    text-decoration: none;
  }

  main {
		max-width: 1024px;
		margin: 0 auto;
		padding: 5em;
		text-align: center;
	}

  @media screen and (max-width: 400px) {
    main {
      padding: 5em 1em;
    }
    header a {
      margin: 0 .5em;
    }
  }

</style>