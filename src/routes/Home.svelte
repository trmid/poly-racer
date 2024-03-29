<script type="ts">

	// Imports:
	import { onMount } from "svelte";
	import { push } from 'svelte-spa-router';
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
		let car = new Car();
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
	<img src="img/logo.png" alt="Poly Racer">
</span>

<div class="homeInfo">
	<h3>Get ready for low-poly racing with high speed competition!</h3>
	<p>Create a randomly generated racing track and challenge your friends to beat your best times.</p>
	<div class="actionItems">
		<span class="actionInfo">
			<span class="ready">
				<span>Are You</span>
				<span>Ready?</span>
			</span>
			<button class="race" on:click={() => push('/race')}>Race</button>
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
			<canvas id="car" width="500" height="300" bind:this={carPreviewCanvas}/>
		</span>
	</div>
</div>

<!-- #################################################################################################### -->

<style>

	.homeLogo {
		display: flex;
		justify-content: center;
		align-items: center;
		margin-bottom: 80px;
		font-size: 5vw;
	}

	.homeLogo > img {
		width: 600px;
		max-width: 90vw;
	}

	.homeInfo {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 1rem 2rem;
		border-radius: 12px;
		background-color: #404040;
		background: linear-gradient(0deg, #404040ee, #222a);
		border: 1px solid #333;
	}

	.homeInfo > h3 {
		font-weight: normal;
	}

	.homeInfo > p {
		font-family: sans-serif;
		max-width: 400px;
		margin-top: 0;
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
		width: 8em;
		margin: 1em 0;
		padding: .2em 0;
		font-size: 1.5em;
		text-transform: uppercase;
		background-color: #ee3b2b;
		border: 2px solid #333;
		border-radius: 5px;
	}

	.actionItems > .actionInfo > .seed {
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.seed > span {
		font-family: sans-serif;
	}

	.actionItems .actionInfo .seed .seedForm {
		display: flex;
		margin: .5em 0;
		border-radius: 7px;
		overflow: hidden;
	}

	.actionItems .actionInfo .seed .seedForm > input {
		flex: 1;
		padding: .5em;
		margin-right: .5em;
		border: 2px solid #333;
		outline: none;
	}

	.actionItems .actionInfo .seed .seedForm > button {
		background-color: #ee3b2b;
		margin-right: .5em;
		border: 2px solid #333;
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