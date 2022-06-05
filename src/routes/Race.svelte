<script type="ts">
  import { onDestroy, onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import type { Unsubscriber } from "svelte/store";
  import { Race } from "../ts/race";
  import { isValidSeed } from "../ts/random";
import { zeroPad } from "../ts/utils";

  // Params:
  export let params: { seed: string };
  const seed = params.seed;
  if(!isValidSeed(seed)) {
    alert("Invalid track seed.");
    push("/");
  }

  // Mount state:
  let mounted = false;

  // Canvas:
  let canvas: HTMLCanvasElement;

  // Race:
  let race: Race;
  let centerText: string = "";
  let speed: number = 0;
  let paused = false;
  let gameTime = 0;
  let laps: number[] = [];

  // Clock:
  $: hours = Math.floor(gameTime / (60 * 60 * 1000));
  $: minutes = Math.floor(gameTime / (60 * 1000)) % 60;
  $: seconds = Math.floor(gameTime / 1000) % 60;
  $: milliseconds = Math.floor(gameTime) % 1000;

  // Volume controls:
  let volume = 0.8;
  $: if(race) race.setVolume(volume);
  $: if(mounted) localStorage.setItem("volume", "" + volume);

  // On Mount:
  const unsubscribes: Unsubscriber[] = [];
  onMount(() => {
    volume = parseFloat(localStorage.getItem("volume") ?? "" + volume);
    race = new Race(seed, canvas);
    unsubscribes.push(
      race.stores.centerText.subscribe(text => centerText = text),
      race.stores.speed.subscribe(s => speed = s),
      race.stores.paused.subscribe(p => paused = p),
      race.stores.completedLaps.subscribe(l => laps = l),
      race.stores.gameTime.subscribe(t => gameTime = t),
    );
    mounted = true;
  });

  // On Destroy:
  onDestroy(() => {

    // Unsubscribe
    for(let unsubscribe of unsubscribes) {
      unsubscribe();
    }

    // Reload page when navigating away to prevent render worker persistence:
    location.reload();
  });

</script>

<div id="canvas-container">
  <canvas bind:this={canvas} width="900" height="640"></canvas>
  {#if race}
    <div id="game-time">{hours > 0 ? `${hours} : ` : ""}{minutes > 0 ? `${zeroPad(minutes, 2)} : ` : ""}{zeroPad(seconds, 2)}.{zeroPad(milliseconds, 3)}</div>
    <div id="speedometer">{speed.toFixed(0)} km/h</div>
    {#if centerText.length > 0}
      <div id="overlay" class:blur={paused}>
        <span id="center-text">{centerText}</span>
      </div>
    {/if}
  {/if}
</div>

<div>
  Volume:
  <input type="range" min={0} max={1} step={0.05} bind:value={volume}>
</div>

<style>

  #canvas-container > canvas {
    max-width: 100%;
  }

  #canvas-container {
    margin: 1rem;
    position: relative;
    display: inline-block;
    overflow: hidden;
  }

  #overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: none;
  }

  #overlay.blur {
    /* backdrop-filter: blur(5px); */
    background-color: #0002;
  }

  #center-text {
    font-size: 36px;
    font-weight: bold;
    font-style: italic;
    color: white;
  }

  #game-time {
    position: absolute;
    top: 10px;
    left: 50%;
    border-radius: 10px;
    background-color: #0004;
    color: white;
    padding: 10px 20px;
    transform: translateX(-50%);
  }

  #speedometer {
    position: absolute;
    right: 10px;
    bottom: 10px;
    padding: 10px 20px;
    background-color: #0004;
    border-radius: 10px;
  }

</style>