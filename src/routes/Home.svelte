<script type="ts">

	// Imports:
	import { onDestroy, onMount } from "svelte";
	import { push } from 'svelte-spa-router';
  import { Volume } from "tone";
  import { Car } from "../ts/car";
	import { isValidSeed } from "../ts/random";

	// Initializations:
	let seed = '';
	let seedError = '';
  let carPreviewCanvas: HTMLCanvasElement;

	// Function to navigate to racing page with seed:
	const navRaceWithSeed = () => {
		if(seed !== '') {
			seedError = '';
			let valid = isValidSeed(seed);
			if(valid) {
				push(`/race/${seed}`);
			} else {
				alert('This doesn\'t seem like a valid seed.');
			}
		}
	}

	onMount(() => {

    // Create scene:
    let scene = new Scene();
    scene.add(new AmbientLight());
    scene.add(new DirectionalLight({
        color: new Color("white"),
        direction: new Vector(1,1,-5),
        brightness: 1
    }));

    // Add car:
		let car = new Car(new Volume());
    scene.add(car.body);

    // Create Camera:
    let cameraPosition = new Vector(5, -1, 1);
    let cameraOrientation = Quaternion.fromAxisRotation(Vector.Y_AXIS, Math.PI * 0.06).rotateZ(Math.PI * 0.92);
    let camera = new Camera({
      position: cameraPosition,
      orientation: cameraOrientation,
      fov: 50
    });

    // Create Renderer:
    const renderer = new Renderer({
      canvas: carPreviewCanvas,
      backgroundColor: new Color(0, 0, 0, 0)
    });
    renderer.render(scene, camera);

	});

</script>

<!-- #################################################################################################### -->

<span class="homeLogo">
	<img src="favicon.png" alt="Poly Racer">
	<span>Poly Racer</span>
</span>

<div class="homeInfo">
	<span>Poly Racer is a generative low-poly racing game meant to be simple, fun and competitive.</span>
	<span>Create a randomly generated racing track and challenge your friends to beat your best times.</span>
</div>

<div class="actionItems">
	<span class="actionInfo">
		<span class="ready">
			<span>Are You</span>
			<span>Ready?</span>
		</span>
		<button class="race" on:click={() => push('/race')}>Start Racing</button>
		<span class="seed">
			<span>Or generate a track based on a seed:</span>
			<form class="seedForm" on:submit|preventDefault={() => navRaceWithSeed()}>
				<input type="text" bind:value={seed} placeholder="Enter a seed here.">
				<button type="submit">Go!</button>
			</form>
			{#if seedError !== ''}
				<span class="error">{seedError}</span>
			{/if}
		</span>
	</span>
	<span class="carPreview">
		<canvas id="car" width="500" height="500" bind:this={carPreviewCanvas}/>
	</span>
</div>

<!-- #################################################################################################### -->

<style>

	.homeLogo {
		display: flex;
		justify-content: center;
		align-items: center;
		margin-bottom: .5em;
		font-size: 5vw;
	}

	.homeLogo > img {
		width: 2em;
		height: 2em;
		margin-right: .2em;
	}

	.homeInfo {
		display: flex;
		flex-direction: column;
	}

	.homeInfo > span {
		margin-bottom: 1em;
	}

	.actionItems {
		display: flex;
		flex-wrap: wrap;
    justify-content: center;
	}

	.actionItems .actionInfo {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		flex: 1;
		padding: 1em;
	}

	.actionItems .actionInfo .ready {
		display: flex;
		flex-direction: column;
		justify-content: center;
		font-size: 1.5em;
		text-transform: uppercase;
	}

	.actionItems .actionInfo .ready > span {
		margin: .1em;
	}

	.actionItems .actionInfo button.race {
		width: 10em;
		margin: 1em 0;
		padding: .2em 0;
		font-size: 1.5em;
		text-transform: uppercase;
		background-color: #ee3b2b;
		border: 2px solid black;
		border-radius: 3px;
	}

	.actionItems .actioninfo .seed {
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.actionItems .actionInfo .seed .seedForm {
		display: flex;
		margin: .5em 0;
		border: 2px solid black;
		border-radius: 3px;
		overflow: hidden;
	}

	.actionItems .actionInfo .seed .seedForm > input {
		flex: 1;
		padding: .5em;
		border: none;
		outline: none;
	}

	.actionItems .actionInfo .seed .seedForm > button {
		background-color: #ee3b2b;
		border: none;
		text-transform: uppercase;
	}

	.actionItems .error {
		color: red;
		font-size: .8em;
	}

	#car {
		max-width: 100%;
	}

	@media screen and (max-width: 800px) {
		.homeLogo {
			font-size: 8vw;
		}
	}

	@media screen and (max-width: 400px) {
		.homeLogo {
			flex-direction: column;
		}
		.homeLogo > img {
			margin-right: 0;
			margin-bottom: .2em;
		}
	}

</style>