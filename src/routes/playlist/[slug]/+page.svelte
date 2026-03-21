<script lang="ts">
	import type { PageData } from './$types';
	import type { Track, YouTubeSearchResult } from '$lib/types';
	import Fuse from 'fuse.js';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import TrackList from '$lib/components/TrackList.svelte';
	import { playerState } from '$lib/stores/playerState.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';

	let { data }: { data: PageData } = $props();

	let removedIds = $state<Set<number>>(new Set());
	const localTracks = $derived(data.tracks.filter((t) => !removedIds.has(t.id)));

	function handleTrackRemoved(trackId: number) {
		removedIds = new Set([...removedIds, trackId]);
	}

	let query = $state('');
	let ytResults = $state<YouTubeSearchResult[]>([]);
	let ytLoading = $state(false);
	let showYtSearch = $state(false);
	let confirmDelete = $state(false);
	let deleting = $state(false);

	async function deletePlaylist() {
		if (deleting) return;
		deleting = true;
		try {
			const res = await fetch(`/api/playlists/${data.playlist.id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('Failed to delete');
			goto('/');
		} finally {
			deleting = false;
			confirmDelete = false;
		}
	}

	const fuse = $derived(
		new Fuse(localTracks, {
			keys: ['title', 'artist', 'album'],
			threshold: 0.35,
			ignoreLocation: true
		})
	);

	const filteredTracks = $derived.by((): Track[] => {
		if (!query.trim()) return localTracks;
		return fuse.search(query).map((r) => r.item);
	});

	const imported = $derived(page.url.searchParams.get('imported'));

	async function searchYouTube() {
		if (!query.trim()) return;
		ytLoading = true;
		showYtSearch = true;
		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
			const json = await res.json();
			ytResults = json.results ?? [];
		} catch {
			ytResults = [];
		} finally {
			ytLoading = false;
		}
	}

	function handleSearch(q: string) {
		query = q;
		showYtSearch = false;
		ytResults = [];
	}

	function handleClear() {
		query = '';
		showYtSearch = false;
		ytResults = [];
	}

	function playYtResult(result: YouTubeSearchResult) {
		const track: Track = {
			id: -1,
			spotifyId: null,
			title: result.title,
			artist: result.artist,
			album: null,
			albumArt: result.thumbnail,
			durationMs: null,
			addedAt: null,
			youtubeId: result.videoId,
			playlistId: null
		};
		playerState.playTrack(track);
	}
</script>

<svelte:head>
	<title>{data.playlist.name} — Bridge</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-4 py-6">
	<header class="mb-6">
		<a href="/" class="mb-4 inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary">
			<Icon name="chevron-left" size={14} /> All playlists
		</a>
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-bold text-text-primary">{data.playlist.name}</h1>
				<p class="mt-1 text-xs text-text-muted">
					{localTracks.length} track{localTracks.length !== 1 ? 's' : ''}
				</p>
			</div>
			{#if confirmDelete}
				<div class="flex items-center gap-2">
					<span class="text-xs text-text-muted">Delete this playlist?</span>
					<button
						onclick={deletePlaylist}
						disabled={deleting}
						class="rounded-md bg-red-500/90 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-50"
					>
						{deleting ? 'Deleting...' : 'Confirm'}
					</button>
					<button
						onclick={() => (confirmDelete = false)}
						class="rounded-md px-2 py-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
					>
						Cancel
					</button>
				</div>
			{:else}
				<button
					onclick={() => (confirmDelete = true)}
					class="rounded-lg border border-border p-2 text-text-muted hover:text-red-400 hover:border-red-400/30 transition-colors"
					title="Delete playlist"
				>
					<Icon name="trash" size={16} />
				</button>
			{/if}
		</div>
	</header>

	{#if imported}
		<div class="mb-4 rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
			Successfully imported {imported} tracks.
		</div>
	{/if}

	{#if localTracks.length > 0}
		<div class="mb-4">
			<SearchBar bind:value={query} onsearch={handleSearch} onclear={handleClear} />
		</div>

		<div class="mb-3 flex items-center justify-between">
			<p class="text-xs text-text-muted">
				{#if query}
					{filteredTracks.length} result{filteredTracks.length !== 1 ? 's' : ''}
				{:else}
					{localTracks.length} track{localTracks.length !== 1 ? 's' : ''}
				{/if}
			</p>

			{#if query && filteredTracks.length < 3}
				<button
					onclick={searchYouTube}
					class="rounded-md bg-surface-overlay px-3 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
				>
					Search YouTube instead
				</button>
			{/if}
		</div>

		<TrackList
			tracks={filteredTracks}
			playlistId={data.playlist.id}
			allPlaylists={data.allPlaylists}
			ontrackremoved={handleTrackRemoved}
		/>
	{:else}
		<div class="py-20 text-center">
			<p class="text-sm text-text-muted">This playlist is empty.</p>
		</div>
	{/if}

	{#if showYtSearch}
		<div class="mt-6 border-t border-border pt-6">
			<h2 class="mb-3 text-sm font-semibold text-text-secondary">YouTube Results</h2>

			{#if ytLoading}
				<p class="py-4 text-center text-sm text-text-muted">Searching YouTube...</p>
			{:else if ytResults.length === 0}
				<p class="py-4 text-center text-sm text-text-muted">No results found</p>
			{:else}
				<div class="space-y-1">
					{#each ytResults as result (result.videoId)}
						<button
							onclick={() => playYtResult(result)}
							class="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-surface-overlay transition-colors"
						>
							{#if result.thumbnail}
								<img
									src={result.thumbnail}
									alt=""
									class="h-10 w-10 rounded object-cover"
								/>
							{:else}
								<div class="flex h-10 w-10 items-center justify-center rounded bg-surface-overlay text-text-muted">
									<Icon name="play" size={16} />
								</div>
							{/if}
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm text-text-primary">{result.title}</p>
								<p class="truncate text-xs text-text-secondary">{result.artist}</p>
							</div>
							<span class="text-xs text-text-muted">{result.duration}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</main>
