<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import Player from '$lib/components/Player.svelte';
	import { playerState } from '$lib/stores/playerState.svelte';
	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<div class="flex min-h-screen flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
	<div class="flex-1 pb-24 lg:overflow-y-auto lg:pb-0 lg:transition-all lg:duration-300 lg:ease-out">
		{@render children()}
	</div>

	{#if data.authenticated}
		<Player />
	{/if}
</div>
