<script type="ts">
  import type { Race, RaceRecord } from "../ts/race";
  import { formatMsTime, stringToArrayBuffer } from "../ts/utils";

  // Props:
  export let records: RaceRecord[];
  export let personalBest: RaceRecord;
  export let race: Race;
  $: records.sort((a,b) => b.timestamp - a.timestamp).slice(0,10);
  $: pbReplayRaw = localStorage.getItem(`pb:${personalBest.seed}`);

  // Functions:
  function downloadReplay() {
    if(pbReplayRaw) {
      const a = document.createElement("a");
      a.href = `data:application/raw;base64,${btoa(pbReplayRaw)}`;
      a.download = `polyracer-${personalBest.seed}-${personalBest.timestamp.toString(16)}-${personalBest.laps[personalBest.laps.length-1].toString(16)}.replay`;
      a.click();
    }
  }

  function loadReplay() {
    if(pbReplayRaw) {
      try {
        race.loadReplayBuffer(stringToArrayBuffer(pbReplayRaw));
        alert("Replay loaded!");
      } catch(err) {
        console.error(err);
        alert((<any>err).message ?? "Could not load replay!");
      }
    }
  }

</script>

<table class="track-time">
  <tr>
    <th></th>
    <th>Trial</th>
    <th>Time</th>
    <th>Lap 1</th>
    <th>Lap 2</th>
    <th>Lap 3</th>
  </tr>
  {#each [personalBest, ...records] as record, i}
    <tr>
      <td>{@html record == personalBest ? "<i class='icofont-star'/>" : ""}</td>
      <td>{#if i == 0}Best{:else}#{records.length - i + 1}{/if}</td>
      <td class="total time">{formatMsTime(record.laps[record.laps.length - 1], true)}</td>
      {#each record.laps.map((a,i) => i == 0 ? a : a - record.laps[i - 1]) as lapTime, i}
        <td class="lap time">{formatMsTime(lapTime, true)}</td>
      {/each}
      <td class:hide={!pbReplayRaw} class="replay">
        {#if pbReplayRaw && record == personalBest}
          <i class="icofont-download" title="Download Replay" on:click={() => downloadReplay()} />
          <i class="icofont-ui-play" title="Load Replay" on:click={() => loadReplay()} />
        {/if}
      </td>
    </tr>
  {/each}
</table>

<style>
  .track-time {
    border-spacing: 5px;
  }

  .time {
    background-color: #0004;
    padding: 10px;
    border-radius: 5px;
  }

  .time.total {
    color: white;
  }

  .time.lap {
    font-size: small;
    color: #eee;
  }

  .replay.hide {
    visibility: hidden;
  }
  
  .replay i {
    cursor: pointer;
    padding: 5px;
  }

  .replay i:hover {
    outline: 2px solid #fff8;
    border-radius: 5px;
  }
</style>