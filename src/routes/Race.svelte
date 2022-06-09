<script type="ts">
  import type { Unsubscriber } from "svelte/store";
  import { onDestroy, onMount } from "svelte";
  import { push } from "svelte-spa-router";
  import { history, Race, RaceState } from "../ts/race";
  import { generate32bitSeed, isValidSeed } from "../ts/random";
  import { formatMsTime } from "../ts/utils";
  import TrackPreview from "../components/TrackPreview.svelte";
  import TrackTimes from "../components/TrackTimes.svelte";
  import { favourites } from "../ts/track";

  // Params:
  export let params: { seed: string };
  $: seed = params.seed;

  // Mount state:
  let mounted = false;

  // Canvas:
  let canvas: HTMLCanvasElement;

  // Race:
  let race: Race;
  let centerText: string = "";
  let speed: number = 0;
  let state: RaceState;
  let gameTime = 0;
  let laps: number[] = [];
  let lapTimes: (number | null)[];
  $: if(race) race.load(seed); // dynamic race load
  $: lapTimes = laps.map((t,i) => t - ( i == 0 ? 0 : laps[i - 1]));
  $: while(lapTimes.length < race?.totalLaps ?? 0) {
    lapTimes.push(null);
  }

  // Track History:
  $: trackHistory = $history.filter(x => x.seed === seed).sort((a,b) => a.timestamp - b.timestamp);
  $: personalBest = trackHistory.length > 0 ? trackHistory.reduce((a,b) => a.laps[a.laps.length - 1] < b.laps[b.laps.length - 1] ? a : b) : undefined;

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

  // Toggle Favourite:
  $: favourited = $favourites.has(seed);
  const toggleFavorite = () => {
    favourites.update(favourites => {
      if(favourites.has(seed)) favourites.delete(seed);
      else favourites.add(seed);
      return favourites;
    });
  };

  // On Mount:
  const unsubscribes: Unsubscriber[] = [];
  onMount(() => {

    // Check seed:
    if(!isValidSeed(seed)) {
      alert("Invalid track seed.");
      push("/");
    } else {

      // Load game:
      volume = parseFloat(localStorage.getItem("volume") ?? "" + volume);
      race = new Race(canvas);
      document.getElementById("canvas-container")?.append(race.minimap);
      unsubscribes.push(
        race.stores.centerText.subscribe(text => centerText = text),
        race.stores.speed.subscribe(s => speed = s),
        race.stores.state.subscribe(s => state = s),
        race.stores.completedLaps.subscribe(l => laps = l),
        race.stores.gameTime.subscribe(t => gameTime = t),
      );
      mounted = true;
    }
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

<div id="track-header">
  Track Seed:
  <span class="seed">{seed} <i title="copy" class="copy-btn icofont-ui-copy" on:click={() => { navigator.clipboard.writeText(seed); alert("Seed Copied!"); }}/></span>
  <i title={favourited ? "Un-Favourite" : "Favourite"} class="favourite-btn icofont-favourite" class:favourited={favourited} on:click={() => toggleFavorite()}/>
</div>

<div id="game-panel">
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
        <div id="overlay" class:blur={state == RaceState.READY || state == RaceState.PAUSED || state == RaceState.FAILED || state == RaceState.DONE}>
          <span id="center-text">{centerText}</span>
        </div>
      {/if}
    {/if}
  </div>
  <div id="info-panel">
    <div id="settings">
      <table>
        <tr>
          <th colspan={2} style="border-bottom: 1px solid currentColor;">Settings</th>
        </tr>
        <tr>
          <th>Volume</th>
          <td><input type="range" min={0} max={1} step={0.05} bind:value={volume} /></td>
        </tr>
        <tr>
          <th>Steering Sensitivity</th>
          <td><input type="range" min={0.1} max={2} step={0.1}></td>
        </tr>
      </table>
    </div>
    {#if trackHistory.length > 0 && personalBest}
      <div id="history">
        <TrackTimes records={trackHistory} {personalBest} />
      </div>
    {/if}
  </div>
</div>

<h2>Other Random Tracks:</h2>
<div id="random-tracks">
  {#each randomTrackArray as seed}
    <div on:click={() => push(`/race/${seed}`)}>
      <TrackPreview {seed}/>
    </div>
  {/each}
</div>
<br>
<button on:click={() => generateRandomTracks()}>More Tracks</button>

<style>

  #track-header {
    font-size: 24px;
    margin-bottom: 1rem;
    font-style: italic;
    font-weight: bold;
  }

  #track-header > .seed {
    font-size: 16px;
    font-weight: bold;
    font-style: italic;
    display: inline-block;
    padding: 10px 20px;
    margin-left: 5px;
    background-color: #0004;
    border-radius: 10px;
  }

  #track-header > .seed > .copy-btn {
    margin-left: 0.5rem;
    cursor: copy;
  }

  .favourite-btn {
    color: #0004;
    cursor: pointer;
    margin-right: 0.5rem;
  }

  .favourite-btn:hover {
    color: #0008
  }

  .favourite-btn.favourited {
    color: inherit;
  }

  #game-panel {
    display: flex;
    flex-wrap: wrap;
    flex-direction: row;
    justify-content: center;
    align-items: stretch;
  }

  #canvas-container > #game-canvas {
    max-width: 100%;
    display: block;
  }

  #canvas-container > #game-canvas:focus {
    outline: none;
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
    border-radius: 10px;
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

  #info-panel {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    align-items: stretch;
  }

  #settings {
    margin: 10px;
    background-color: #0004;
    border-radius: 10px;
    padding: 10px;
    flex-grow: 1;
    text-align: left;
  }

  #settings th,
  #settings td {
    padding: 5px;
  }

  #history {
    margin: 10px;
    background-color: #0004;
    padding: 10px;
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