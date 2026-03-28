<script lang="ts">
	import type { PageData } from './$types';
	import type { Track } from '$lib/types';
	import TrackList from '$lib/components/TrackList.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { goto } from '$app/navigation';

	let { data }: { data: PageData } = $props();

	let deleting = $state(false);

	const tracks: Track[] = $derived(
		data.tracks.map((t, i) => ({
			id: -(i + 1),
			spotifyId: null,
			title: t.title,
			artist: t.artist,
			album: null,
			albumArt: null,
			durationMs: null,
			addedAt: null,
			youtubeId: t.youtubeId ?? null,
			playlistId: null
		}))
	);

	async function deleteRadio() {
		if (deleting) return;
		deleting = true;
		try {
			const res = await fetch(`/api/radio?id=${data.radio.id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('Failed to delete');
			goto('/');
		} finally {
			deleting = false;
		}
	}
</script>

<svelte:head>
	<title>Radio: {data.radio.seedArtist} — {data.radio.seedTitle}</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-4 py-6">
	<header class="mb-6">
		<a href="/" class="mb-4 inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary">
			<Icon name="chevron-left" size={14} /> All playlists
		</a>
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				{#if data.radio.seedAlbumArt}
					<img
						src={data.radio.seedAlbumArt}
						alt=""
						class="h-12 w-12 rounded-lg object-cover shadow"
					/>
				{:else}
					<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#191919] text-accent">
						<span class="text-2xl leading-none">📻</span>
					</div>
				{/if}
				<div>
					<h1 class="text-xl font-bold text-text-primary">
						<span class="text-accent">Radio</span> {data.radio.seedArtist} — {data.radio.seedTitle}
					</h1>
					<p class="mt-0.5 text-xs text-text-muted">
						{tracks.length} track{tracks.length !== 1 ? 's' : ''}
					</p>
				</div>
			</div>
			<button
				onclick={deleteRadio}
				disabled={deleting}
				class="rounded-lg border border-border p-2 text-text-muted hover:text-red-400 hover:border-red-400/30 transition-colors disabled:opacity-50"
				title="Delete radio"
			>
				<Icon name="trash" size={16} />
			</button>
		</div>
	</header>

	{#if tracks.length > 0}
		<TrackList
			{tracks}
			allPlaylists={data.allPlaylists}
		/>
	{:else}
		<div class="py-20 text-center">
			<p class="text-sm text-text-muted">No similar tracks found.</p>
		</div>
	{/if}
</main>
