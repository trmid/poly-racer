<script type="ts">
  import type { RaceRecord } from "../ts/race";
  import { formatMsTime } from "../ts/utils";

  // Props:
  export let record: RaceRecord;

</script>

<div class="track-time">
  <span class="total time">{formatMsTime(record.laps[record.laps.length - 1])}</span>
  {#each record.laps.map((a,i) => i == 0 ? a : a - record.laps[i - 1]) as lapTime}
    <span class="lap time">{formatMsTime(lapTime)}</span>
  {/each}
</div>

<style>
  .track-time {
    background-color: #0004;
  }

  .time {
    padding: 10px;
    margin: 5px;
  }

  .time.total {
    margin-right: 15px;
    color: white;
  }

  .time.lap {
    font-size: small;
    color: #888;
  }
</style>