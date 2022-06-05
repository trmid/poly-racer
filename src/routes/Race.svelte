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

  // Volume controls:
  let volume = 0.8;
  $: if(race) race.setVolume(volume);

  // Function to toggle play state:
  let playPauseMsg = "Start";
  const togglePlayState = () => {
    if(race.isPaused()) {
      playPauseMsg = "Pause";
      race.start()
    } else {
      playPauseMsg = "Start";
      race.pause();
    }
  };

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
  <button on:click={togglePlayState}>{playPauseMsg}</button>
</div>
<div>
  Volume:
  <input type="range" min={0} max={1} step={0.05} bind:value={volume}>
</div>

<style>
  canvas {
    margin: 1rem;
  }
</style>