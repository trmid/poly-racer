<script type="ts">
  import { onDestroy, onMount } from "svelte";
  import { push, replace } from "svelte-spa-router";
  import type { Unsubscriber } from "svelte/store";
  import { Race } from "../ts/race";
  import { generate32bitSeed, isValidSeed } from "../ts/random";
  import { formatMsTime } from "../ts/utils";
  import TrackPreview from "../components/TrackPreview.svelte";

  // Params:
  export let params: { seed: string };
  const seed = params.seed;

  // Mount state:
  let mounted = false;

  // Canvas:
  let canvas: HTMLCanvasElement;

  // Race:
  let race: Race;
  let centerText: string = "";
  let speed: number = 0;
  let state = "";
  let gameTime = 0;
  let laps: number[] = [];
  let lapTimes: (number | null)[];
  $: lapTimes = laps.map((t,i) => t - ( i == 0 ? 0 : laps[i - 1]));
  $: while(lapTimes.length < race?.totalLaps ?? 0) {
    lapTimes.push(null);
  }

  // Random Tracks:
  let numRandomTracks = 9;
  let randomTrackArray: string[] = [];
  const generateRandomTracks = () => {
    randomTrackArray = Array(numRandomTracks).fill("").map(() => generate32bitSeed());
  };
  generateRandomTracks();

  // Clock:
  $: clock = formatMsTime(gameTime);

  // Volume controls:
  let volume = 0.8;
  $: if(race) race.setVolume(volume);
  $: if(mounted) localStorage.setItem("volume", "" + volume);

  // On Mount:
  const unsubscribes: Unsubscriber[] = [];
  onMount(() => {

    // Check seed:
    if(!isValidSeed(seed)) {
      alert("Invalid track seed.");
      push("/");
    }

    // Load game:
    volume = parseFloat(localStorage.getItem("volume") ?? "" + volume);
    race = new Race(seed, canvas);
    document.getElementById("canvas-container")?.append(race.minimap);
    unsubscribes.push(
      race.stores.centerText.subscribe(text => centerText = text),
      race.stores.speed.subscribe(s => speed = s),
      race.stores.state.subscribe(s => state = s),
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

<div id="canvas-container" class="no-select">
  <canvas id="game-canvas" bind:this={canvas} width="900" height="640"></canvas>
  {#if race}
    <div id="game-time"><i class="icofont-stopwatch"></i> {clock}</div>
    <div id="lap-times">
      {#each lapTimes as lapTime, i }
        <div><span>{i + 1}</span>{lapTime ? formatMsTime(lapTime) : ''}</div>
      {/each}
    </div>
    <div id="speedometer">{speed.toFixed(0)} km/h</div>
    {#if centerText.length > 0}
      <div id="overlay" class:blur={state === 'paused' || state === 'failed' || state === 'completed'}>
        <span id="center-text">{centerText}</span>
      </div>
    {/if}
  {/if}
</div>

<div>
  Volume:
  <input type="range" min={0} max={1} step={0.05} bind:value={volume}>
</div>

<h3>Other Random Tracks:</h3>
<div id="random-tracks">
  {#each randomTrackArray as seed}
    <div on:click={() => replace(`/race/${seed}`).then(() => location.reload())}>
      <TrackPreview {seed}/>
    </div>
  {/each}
</div>
<br>
<button on:click={() => generateRandomTracks()}>More Tracks</button>

<style>

  #canvas-container > #game-canvas {
    max-width: 100%;
    display: block;
    border-radius: 10px;
  }

  :global(#canvas-container > #minimap) {
    position: absolute;
    left: 5px;
    bottom: 5px;
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
    background-color: #0002;
  }

  #center-text {
    font-size: 36px;
    font-weight: bold;
    font-style: italic;
    color: white;
    white-space: pre-wrap;
    text-align: center;
    text-shadow: 1px 2px 0 #666;
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

  #lap-times {
    position: absolute;
    top: 0;
    left: 0;
  }

  #lap-times > div {
    background-color: #0004;
    color: white;
    padding: 10px 20px 10px 5px;
    margin: 10px;
    border-radius: 10px;
    min-width: 6rem;
    text-align: left;
  }

  #lap-times > div > span {
    background-color: #0004;
    font-weight: bold;
    border-radius: 5px;
    margin-right: 10px;
    padding: 5px 10px;
  }

  #speedometer {
    position: absolute;
    right: 10px;
    bottom: 10px;
    padding: 10px 20px;
    background-color: #0004;
    border-radius: 10px;
  }

  #random-tracks {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  #random-tracks > div {
    background-color: #0004;
    border-radius: 10px;
    display: flex;
    justify-content: center;
    cursor: pointer;
  }

  #random-tracks > div:hover {
    transform: scale(1.02);
    background-color: #000;
  }
</style>