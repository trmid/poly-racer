<script type="ts">
  import { onMount } from "svelte";
  import { Track } from "../ts/track";

  // Props:
  export let seed: string;

  // Initializations:
  let canvas: HTMLCanvasElement;
  $: track = new Track(seed, true);

  // Keep track of mount status:
  let mounted = false;
  onMount(() => {
    mounted = true;
  });

  // Render track:
  let renderer: Renderer | undefined;
  $: if(mounted && track) {

    // Init renderer:
    if(!renderer) renderer = new Renderer({
      canvas,
      backgroundColor: new Color(0, 0),
      suspendOnBlur: false
    });

    // Create scene:
    const scene = new Scene();
    scene.add(track.urbject);

    // Create camera:
    const camera = new Camera({
      position: new Vector(0, 0, 1800),
      orientation: Quaternion.fromVector(Vector.zAxis().neg()),
      fov: 40
    })

    // Render:
    renderer.render(scene, camera);
  }

</script>

<canvas bind:this={canvas} width={150} height={150}></canvas>

<style>
  canvas {
    display: block;
    max-width: 100%;
  }
</style>