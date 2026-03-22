<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import Player from '$lib/components/Player.svelte';
	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<div class="flex min-h-screen flex-col">
	<div class="flex-1 pb-24">
		{@render children()}
	</div>

	{#if data.authenticated}
		<Player />
	{/if}
</div>
