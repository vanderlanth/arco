<script lang="ts">
	import type { PageData } from './$types';
	import type { Track, YouTubeSearchResult } from '$lib/types';
	import Fuse from 'fuse.js';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import TrackList from '$lib/components/TrackList.svelte';
	import { playerState } from '$lib/stores/playerState.svelte';
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import EmojiPicker from '$lib/components/EmojiPicker.svelte';

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
	let showDeleteModal = $state(false);
	let deleteConfirmName = $state('');
	let deleting = $state(false);

	// Edit modal
	let showEditModal = $state(false);
	let editName = $state('');
	let editEmoji = $state('');
	let saving = $state(false);

	function openEditModal() {
		editName = data.playlist.name;
		editEmoji = data.playlist.emoji ?? '';
		showEditModal = true;
	}

	async function saveEdit() {
		const name = editName.trim();
		if (!name || saving) return;
		saving = true;
		try {
			const res = await fetch(`/api/playlists/${data.playlist.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, emoji: editEmoji || null })
			});
			if (!res.ok) throw new Error('Failed to save');
			const updated = await res.json();
			showEditModal = false;
			await invalidateAll();
			if (updated.slug !== data.playlist.slug) {
				goto(`/playlist/${updated.slug}`);
			}
		} finally {
			saving = false;
		}
	}

	const canDelete = $derived(deleteConfirmName.trim() === data.playlist.name);

	async function deletePlaylist() {
		if (deleting || !canDelete) return;
		deleting = true;
		try {
			const res = await fetch(`/api/playlists/${data.playlist.id}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('Failed to delete');
			goto('/');
		} finally {
			deleting = false;
			showDeleteModal = false;
			deleteConfirmName = '';
		}
	}

	function openDeleteModal() {
		deleteConfirmName = '';
		showDeleteModal = true;
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
			<div class="flex items-center gap-3">
				<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#191919] text-accent">
					{#if data.playlist.emoji}
						<span class="text-2xl leading-none">{data.playlist.emoji}</span>
					{:else}
						<Icon name="music" size={20} />
					{/if}
				</div>
				<div>
					<h1 class="text-2xl font-bold text-text-primary">{data.playlist.name}</h1>
					<p class="mt-1 text-xs text-text-muted">
						{localTracks.length} track{localTracks.length !== 1 ? 's' : ''}
					</p>
				</div>
			</div>
			<div class="flex items-center gap-2">
				<button
					onclick={openEditModal}
					class="rounded-lg border border-border p-2 text-text-muted hover:text-text-primary hover:border-border transition-colors"
					title="Edit playlist"
				>
					<Icon name="edit" size={16} />
				</button>
				<button
					onclick={openDeleteModal}
					class="rounded-lg border border-border p-2 text-text-muted hover:text-red-400 hover:border-red-400/30 transition-colors"
					title="Delete playlist"
				>
					<Icon name="trash" size={16} />
				</button>
			</div>
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
			{#if query}
				<p class="text-xs text-text-muted">
					{filteredTracks.length} result{filteredTracks.length !== 1 ? 's' : ''}
				</p>
			{:else}
				<span></span>
			{/if}

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

	<!-- Edit modal -->
	{#if showEditModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
			<div class="absolute inset-0 bg-black/60" onclick={() => { showEditModal = false; }}></div>
			<div class="relative w-full max-w-sm rounded-xl border border-border bg-surface-raised p-6 shadow-2xl">
				<h2 class="mb-4 text-base font-semibold text-text-primary">Edit playlist</h2>

				<!-- Emoji preview + picker -->
				<div class="mb-4">
					<div class="mb-2 flex items-center gap-3">
						<div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#111] text-accent">
							{#if editEmoji}
								<span class="text-3xl leading-none">{editEmoji}</span>
							{:else}
								<Icon name="music" size={24} />
							{/if}
						</div>
						<p class="text-xs text-text-muted">Pick a cover emoji</p>
					</div>
					<EmojiPicker onselect={(e) => (editEmoji = e)} />
				</div>

				<!-- Name input -->
				<form onsubmit={(e) => { e.preventDefault(); saveEdit(); }}>
					<input
						bind:value={editName}
						placeholder="Playlist name"
						class="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent"
						autofocus
						onkeydown={(e) => { if (e.key === 'Escape') showEditModal = false; }}
					/>
					<div class="flex justify-end gap-2">
						<button
							type="button"
							onclick={() => { showEditModal = false; }}
							class="rounded-md px-3 py-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={!editName.trim() || saving}
							class="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-surface hover:bg-accent-hover transition-colors disabled:opacity-50"
						>
							{saving ? 'Saving...' : 'Save'}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	{#if showDeleteModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
			<div class="absolute inset-0 bg-black/60" onclick={() => { showDeleteModal = false; deleteConfirmName = ''; }}></div>
			<div class="relative w-full max-w-sm rounded-xl border border-border bg-surface-raised p-6 shadow-2xl">
				<h2 class="mb-1 text-base font-semibold text-text-primary">Delete playlist</h2>
				<p class="mb-4 text-sm text-text-muted">
					This action cannot be undone. Type <span class="font-medium text-text-secondary">{data.playlist.name}</span> to confirm.
				</p>
				<input
					bind:value={deleteConfirmName}
					placeholder={data.playlist.name}
					class="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-red-400/60"
					autofocus
					onkeydown={(e) => { if (e.key === 'Enter' && canDelete) deletePlaylist(); if (e.key === 'Escape') { showDeleteModal = false; deleteConfirmName = ''; } }}
				/>
				<div class="flex justify-end gap-2">
					<button
						onclick={() => { showDeleteModal = false; deleteConfirmName = ''; }}
						class="rounded-md px-3 py-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
					>
						Cancel
					</button>
					<button
						onclick={deletePlaylist}
						disabled={!canDelete || deleting}
						class="rounded-md bg-red-500/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-40"
					>
						{deleting ? 'Deleting...' : 'Delete'}
					</button>
				</div>
			</div>
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
