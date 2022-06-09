<script lang="ts">
	import Router, { link } from "svelte-spa-router";
  import Storage from "./components/Storage.svelte";
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
  <Storage />
</main>

<style>

  header {
    position: sticky;
    position: -webkit-sticky;
    top: 0;
    z-index: 10;

    display: flex;
    justify-content: center;
    background-color: #0005;
    backdrop-filter: contrast(0.5);
    border-bottom: 5px solid #ee3b2b88;
    border-top: 5px solid #ee3b2b88;
  }

  header .headerContent {
    max-width: 1024px;
    padding: .5em;
  }

  header a {
    margin: 0 1rem;
    color: white;
    text-decoration: none;
    padding: 0.5rem 1rem;
  }

  header a:hover {
    background-color: #ee3b2b88;
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