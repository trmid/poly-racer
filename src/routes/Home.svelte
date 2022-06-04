<script>

	// Imports:
	import { onMount } from "svelte";
	import { push } from 'svelte-spa-router';

	// Initializations:
	let seed = '';
	let seedError = '';

	// Function to navigate to racing page with seed:
	const navRaceWithSeed = () => {
		if(seed !== '') {
			seedError = '';
			let isValidSeed = true; // <TODO - Seed Validation>
			if(isValidSeed) {
				push(`/race/${seed}`);
			} else {
				seedError = 'This doesn\'t seem like a valid seed.';
			}
		}
	}

	onMount(() => {

		// Temporary Canvas Text <TODO - Remove This>
		let canvas = document.getElementById('car');
		let ctx = canvas.getContext('2d');
		ctx.textAlign = 'center';
		ctx.fillText('<Add Car Preview Here>', canvas.width / 2, canvas.height / 2);

	});

</script>

<!-- #################################################################################################### -->

<span class="homeLogo">
	<img src="/favicon.png" alt="Poly Track">
	<span>Poly Track</span>
</span>

<div class="homeInfo">
	<span>Poly Track is a generative low-poly racing game meant to be simple, fun and competitive.</span>
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
		<canvas id="car" width="500" height="500" />
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