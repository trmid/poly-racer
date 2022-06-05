<script type="ts">
  import { onDestroy, onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import { Race } from "../ts/race";
  import { isValidSeed } from "../ts/random";

  // Params:
  export let params: { seed: string };
  const seed = params.seed;
  if(!isValidSeed(seed)) {
    alert("Invalid track seed.");
    push("/");
  }

  // Canvas:
  let canvas: HTMLCanvasElement;

  // Race:
  let race: Race;

  // On Mount:
  onMount(() => {
    race = new Race(seed, canvas);
  });

  // On Destroy:
  onDestroy(() => {
    // Reload page when navigating away to prevent render worker persistence:
    location.reload();
  });

</script>

<canvas bind:this={canvas} width="900" height="640"></canvas>

<div>
  <button on:click={() => race.start()}>Start</button>
</div>

<style>
  canvas {
    margin: 1rem;
  }
</style>