<script lang="ts">
	import Router, { link } from "svelte-spa-router";
  import ServiceWorker from "./components/ServiceWorker.svelte";
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

<ServiceWorker />

<style>

  :global(html), :global(body) {
    position: relative;
    width: 100%;
    height: 100%;
  }

  :global(body) {
    margin: 0;
    box-sizing: border-box;
    font-family: 'Fugaz One', sans-serif;
    background-color: #ffea80;
    background-image: url('../img/polyBG.webp');
    background-size: cover;
    background-repeat: no-repeat;
    background-attachment: fixed;
  }

  :global(.no-select) {
    user-select: none;
    -moz-user-select: none;
  }

  :global(button), :global(input) {
    padding: 7px;
    border-radius: 7px;
    background-color: #333;
    border: none;
  }

  :global(button) {
    cursor: pointer;
    font-family: inherit;
  }

  :global(h3, h2, h1) {
    font-weight: normal;
  }

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
  }

  header a {
    display: inline-block;
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