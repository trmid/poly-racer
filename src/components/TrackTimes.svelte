<script type="ts">
  import type { RaceRecord } from "../ts/race";
  import { formatMsTime } from "../ts/utils";

  // Props:
  export let records: RaceRecord[];
  export let personalBest: RaceRecord;
  $: records.sort((a,b) => b.timestamp - a.timestamp).slice(0,10);

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
</style>