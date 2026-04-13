<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import Player from '$lib/components/Player.svelte';
	import { playerState } from '$lib/stores/playerState.svelte';
	import { snackbar } from '$lib/stores/snackbar.svelte';
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

{#if snackbar.message}
	<div class="fixed inset-x-0 bottom-20 z-50 mx-auto max-w-md px-4 lg:bottom-4 lg:right-[34vw] lg:left-auto lg:inset-x-auto">
		<div class="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 shadow-lg backdrop-blur">
			<p class="text-sm text-accent">{snackbar.message}</p>
		</div>
	</div>
{/if}
