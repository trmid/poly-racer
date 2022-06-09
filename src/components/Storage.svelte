<script type="ts">
  import { onDestroy, onMount } from "svelte";
  import { history } from "../ts/race";
  import type { Unsubscriber } from "svelte/store";

  // Unsubscribers:
  let unsubs: Unsubscriber[] = [];

  onMount(() => {

    // Init race history:
    {
      let storedHistory: any;
      try {
        storedHistory = JSON.parse(localStorage.getItem("history") ?? "[]");
      } catch(err) {
        storedHistory = [];
      }
      history.set(storedHistory);
      unsubs.push(history.subscribe(history => {
        localStorage.setItem("history", JSON.stringify(history));
      }));
    }

  });

  onDestroy(() => {
    for(const unsub of unsubs) {
      unsub();
    }
  });
</script>