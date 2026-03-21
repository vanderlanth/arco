<script lang="ts">
	import type { Track } from '$lib/types';
	import TrackRow from './TrackRow.svelte';

	interface Props {
		tracks: Track[];
		playlistId?: number;
		allPlaylists?: { id: number; name: string; slug: string }[];
		ontrackremoved?: (trackId: number) => void;
	}

	let { tracks, playlistId, allPlaylists, ontrackremoved }: Props = $props();

	const BATCH = 200;
	let visibleCount = $state(BATCH);
	let sentinel: HTMLDivElement;

	const visibleTracks = $derived(tracks.slice(0, visibleCount));
	const hasMore = $derived(visibleCount < tracks.length);

	$effect(() => {
		tracks;
		visibleCount = BATCH;
	});

	$effect(() => {
		if (!sentinel || !hasMore) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					visibleCount = Math.min(visibleCount + BATCH, tracks.length);
				}
			},
			{ rootMargin: '600px' }
		);
		observer.observe(sentinel);

		return () => observer.disconnect();
	});
</script>

<div>
	{#if tracks.length === 0}
		<p class="py-12 text-center text-sm text-text-muted">No tracks found</p>
	{:else}
		<div class="space-y-0.5">
			{#each visibleTracks as track, index (track.id)}
				<TrackRow {track} trackList={tracks} {index} {playlistId} {allPlaylists} {ontrackremoved} />
			{/each}
		</div>

		{#if hasMore}
			<div bind:this={sentinel} class="py-4 text-center text-xs text-text-muted">
				Loading more...
			</div>
		{/if}
	{/if}
</div>
