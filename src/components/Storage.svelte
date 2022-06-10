<script type="ts">
  import { onDestroy, onMount } from "svelte";
  import { history } from "../ts/race";
  import type { Unsubscriber } from "svelte/store";
  import { favourites } from "../ts/track";
  import { turnSensitivity } from "../ts/car";

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

    // Init favorites:
    {
      let storedFavorites: any;
      try {
        storedFavorites = JSON.parse(localStorage.getItem("favourites") ?? "[]");
      } catch(err) {
        storedFavorites = [];
      }
      favourites.set(new Set(storedFavorites));
      unsubs.push(favourites.subscribe(favourites => {
        localStorage.setItem("favourites", JSON.stringify([...favourites]));
      }));
    }

    // Init turn sensitivity:
    {
      turnSensitivity.set(parseFloat(localStorage.getItem("turnSensitivity") ?? "0.5") || 0.5);
      unsubs.push(turnSensitivity.subscribe(turnSensitivity => {
        localStorage.setItem("turnSensitivity", "" + turnSensitivity);
      }));
    }

  });

  onDestroy(() => {
    for(const unsub of unsubs) {
      unsub();
    }
  });
</script>