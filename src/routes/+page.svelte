<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import EmojiPicker from '$lib/components/EmojiPicker.svelte';
	import { playerState } from '$lib/stores/playerState.svelte';
	import type { Track } from '$lib/types';

	let { data }: { data: PageData } = $props();

	// --- Search ---
	interface LastfmTrackResult { title: string; artist: string; albumArt: string | null; }
	interface LastfmArtistResult { name: string; imageUrl: string | null; listeners: string | null; }
	interface LastfmAlbumResult { name: string; artist: string; imageUrl: string | null; }
	interface PlaylistTrackResult {
		id: number;
		title: string;
		artist: string;
		album: string | null;
		albumArt: string | null;
		playlistId: number;
		playlistName: string;
		playlistSlug: string;
	}

	let searchQuery = $state('');
	let searchFocused = $state(false);
	let searchLoading = $state(false);
	let searchError = $state<string | null>(null);
	let queueLoading = $state(false);
	let searchDebounce: ReturnType<typeof setTimeout>;
	let searchInputEl = $state<HTMLInputElement | null>(null);

	const RECENT_KEY = 'arco:recent-searches-v2';
	const MAX_RECENT = 8;
	let recentSearches = $state<string[]>([]);

	$effect(() => {
		try { recentSearches = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); }
		catch { recentSearches = []; }
	});

	function saveToRecent(query: string) {
		const q = query.trim();
		if (!q) return;
		const deduped = recentSearches.filter((r) => r.toLowerCase() !== q.toLowerCase());
		const next = [q, ...deduped].slice(0, MAX_RECENT);
		recentSearches = next;
		try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
	}

	function removeFromRecent(query: string) {
		const next = recentSearches.filter((r) => r !== query);
		recentSearches = next;
		try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
	}

	function applyRecentSearch(query: string) {
		searchQuery = query;
		handleSearchInput();
		searchInputEl?.focus();
	}

	let playlistTrackResults = $state<PlaylistTrackResult[]>([]);
	let lastfmTrackResults = $state<LastfmTrackResult[]>([]);
	let artistResults = $state<LastfmArtistResult[]>([]);
	let albumResults = $state<LastfmAlbumResult[]>([]);

	let showMorePlaylistTracks = $state(false);
	let showMoreLastfmTracks = $state(false);
	let showMoreArtists = $state(false);
	let showMoreAlbums = $state(false);

	const searchMode = $derived(searchFocused || searchQuery.trim().length > 0);

	const hasResults = $derived(
		playlistTrackResults.length > 0 ||
		lastfmTrackResults.length > 0 ||
		artistResults.length > 0 ||
		albumResults.length > 0
	);

	function clearSearch() {
		searchQuery = '';
		searchError = null;
		playlistTrackResults = [];
		lastfmTrackResults = [];
		artistResults = [];
		albumResults = [];
		showMorePlaylistTracks = false;
		showMoreLastfmTracks = false;
		showMoreArtists = false;
		showMoreAlbums = false;
	}

	function handleSearchInput() {
		clearTimeout(searchDebounce);
		searchError = null;
		showMorePlaylistTracks = false;
		showMoreLastfmTracks = false;
		showMoreArtists = false;
		showMoreAlbums = false;
		if (!searchQuery.trim()) {
			playlistTrackResults = [];
			lastfmTrackResults = [];
			artistResults = [];
			albumResults = [];
			searchLoading = false;
			return;
		}
		searchLoading = true;
		searchDebounce = setTimeout(async () => {
			try {
				const res = await fetch(`/api/search-advanced?q=${encodeURIComponent(searchQuery.trim())}`);
				if (!res.ok) throw new Error();
				const result = await res.json();
				playlistTrackResults = result.playlistTracks ?? [];
				lastfmTrackResults = result.lastfmTracks ?? [];
				artistResults = result.artists ?? [];
				albumResults = result.albums ?? [];
				saveToRecent(searchQuery);
			} catch {
				searchError = 'Search unavailable';
				playlistTrackResults = [];
				lastfmTrackResults = [];
				artistResults = [];
				albumResults = [];
			} finally {
				searchLoading = false;
			}
		}, 300);
	}

	function handleSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			clearSearch();
			searchFocused = false;
			searchInputEl?.blur();
		}
	}

	async function fetchAndSetQueue(artist: string, title: string, seed: Track) {
		try {
			const res = await fetch(
				`/api/similar-tracks?artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}`
			);
			if (!res.ok) return;
			const { tracks: similar } = await res.json();
			if (!similar?.length) return;
			if (
				playerState.currentTrack?.title === seed.title &&
				playerState.currentTrack?.artist === seed.artist
			) {
				playerState.setSourceList([seed, ...similar], 0);
			}
		} catch { /* swallow — seed still plays */ }
		finally { queueLoading = false; }
	}

	function playTrackResult(title: string, artist: string, albumArt: string | null, album: string | null = null) {
		const seed: Track = {
			id: -1,
			spotifyId: null,
			title,
			artist,
			album,
			albumArt,
			durationMs: null,
			addedAt: null,
			youtubeId: null,
			playlistId: null
		};
		playerState.playTrack(seed, [seed]);
		queueLoading = true;
		fetchAndSetQueue(artist, title, seed);
	}

	function handleLastfmTrackClick(result: LastfmTrackResult) {
		playTrackResult(result.title, result.artist, result.albumArt);
	}

	function handlePlaylistTrackClick(result: PlaylistTrackResult) {
		const seed: Track = {
			id: result.id,
			spotifyId: null,
			title: result.title,
			artist: result.artist,
			album: result.album,
			albumArt: result.albumArt,
			durationMs: null,
			addedAt: null,
			youtubeId: null,
			playlistId: result.playlistId
		};
		playerState.playTrack(seed, [seed]);
		queueLoading = true;
		fetchAndSetQueue(result.artist, result.title, seed);
	}

	function handleArtistClick(artist: LastfmArtistResult) {
		searchQuery = artist.name;
		handleSearchInput();
	}

	function handleAlbumClick(album: LastfmAlbumResult) {
		playTrackResult(album.name, album.artist, album.imageUrl, album.name);
	}

	const imported = $derived(page.url.searchParams.get('imported'));

	const RANDOM_EMOJIS = [
		'🎵','🎶','🎸','🎹','🎺','🎻','🥁','🎤','🎧','🎼','🎷','🪕','🪗','🪘',
		'🔥','⚡','🌊','🌙','☀️','⭐','💫','🌈','🌸','🌺','🌿','🌴','🍀','🌻',
		'💎','👑','🎯','🎭','🎬','🦋','🐬','🦅','🦁','❤️','💙','💜','✨','🎉'
	];

	function randomEmoji() {
		return RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)];
	}

	// Create modal state
	let showCreateModal = $state(false);
	let newName = $state('');
	let newEmoji = $state('');
	let creating = $state(false);
	let showMoreMenu = $state(false);

	function openCreateModal() {
		newName = '';
		newEmoji = randomEmoji();
		showCreateModal = true;
	}

	async function createPlaylist() {
		const name = newName.trim();
		if (!name || creating) return;
		creating = true;
		try {
			const res = await fetch('/api/playlists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, emoji: newEmoji || null })
			});
			if (!res.ok) throw new Error('Failed to create playlist');
			const playlist = await res.json();
			showCreateModal = false;
			newName = '';
			newEmoji = '';
			await invalidateAll();
			goto(`/playlist/${playlist.slug}`);
		} finally {
			creating = false;
		}
	}

	let deletingRadioId = $state<number | null>(null);

	async function deleteRadio(id: number) {
		if (deletingRadioId) return;
		deletingRadioId = id;
		try {
			const res = await fetch(`/api/radio?id=${id}`, { method: 'DELETE' });
			if (res.ok) await invalidateAll();
		} finally {
			deletingRadioId = null;
		}
	}

	function formatDate(iso: string): string {
		try {
			return new Date(iso).toLocaleDateString(undefined, {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
		} catch {
			return '';
		}
	}
</script>

<svelte:head>
	<title>Arco</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-4 py-6">
	<header class="mb-6 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<img src="/favicon.svg" alt="" class="h-7 w-7" />
			<h1 class="text-2xl font-bold text-text-primary">Arco</h1>
		</div>
		<div class="flex items-center gap-3">
			<button
				onclick={openCreateModal}
				class="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-overlay transition-colors"
			>
				New playlist
			</button>
			<div class="relative">
				<button
					onclick={() => (showMoreMenu = !showMoreMenu)}
					class="rounded-lg border border-border p-1.5 text-text-secondary hover:bg-surface-overlay transition-colors"
					aria-label="More actions"
				>
					<Icon name="overflow-menu" size={16} />
				</button>
				{#if showMoreMenu}
					<div class="absolute right-0 top-full z-30 mt-1 w-40 rounded-lg border border-border bg-surface-raised py-1 shadow-xl">
						<a href="/add" onclick={() => (showMoreMenu = false)} class="block px-3 py-2 text-sm text-text-primary hover:bg-surface-overlay">Add song</a>
						<a href="/import" onclick={() => (showMoreMenu = false)} class="block px-3 py-2 text-sm text-text-primary hover:bg-surface-overlay">Import</a>
						<a href="/setup-2fa" onclick={() => (showMoreMenu = false)} class="block px-3 py-2 text-sm text-text-primary hover:bg-surface-overlay">2FA</a>
						<div class="my-1 border-t border-border"></div>
						<a href="/logout" class="block px-3 py-2 text-sm text-red-400 hover:bg-surface-overlay">Logout</a>
					</div>
					<button onclick={() => (showMoreMenu = false)} class="fixed inset-0 z-20" aria-label="Close menu"></button>
				{/if}
			</div>
		</div>
	</header>

	<!-- Search -->
	<div class="mb-6">
		<div class="relative">
			<div class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
				<Icon name="search" size={18} />
			</div>
			<input
				bind:this={searchInputEl}
				type="search"
				bind:value={searchQuery}
				oninput={handleSearchInput}
				onfocus={() => (searchFocused = true)}
				onblur={() => (searchFocused = false)}
				onkeydown={handleSearchKeydown}
				placeholder="Search songs, artists, albums..."
				class="w-full rounded-lg border border-border bg-surface-raised py-2.5 pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
			/>
			{#if searchQuery}
				<button
					onclick={() => { clearSearch(); searchInputEl?.focus(); }}
					class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
					aria-label="Clear search"
				>
					<Icon name="close" size={16} />
				</button>
			{/if}
		</div>

		{#if searchMode && !searchQuery.trim() && recentSearches.length > 0}
			<div class="mt-4">
				<div class="mb-2 flex items-center justify-between">
					<p class="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Recent searches</p>
					<button
						onclick={() => { recentSearches = []; try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ } }}
						class="text-[10px] text-text-muted transition-colors hover:text-text-secondary"
					>
						Clear all
					</button>
				</div>
				<div class="space-y-0.5">
					{#each recentSearches as query}
						<div class="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-overlay">
							<button
								onclick={() => applyRecentSearch(query)}
								class="flex min-w-0 flex-1 items-center gap-3 text-left"
							>
								<Icon name="search" size={14} class="shrink-0 text-text-muted" />
								<span class="truncate text-sm text-text-primary">{query}</span>
							</button>
							<button
								onclick={() => removeFromRecent(query)}
								class="shrink-0 p-0.5 text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-text-secondary"
								aria-label="Remove from recent"
							>
								<Icon name="close" size={12} />
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if searchMode && searchQuery.trim()}
			<div class="mt-4 space-y-6">
				{#if searchLoading}
					<div class="space-y-6">
						{#each [0, 1, 2, 3] as _}
							<div>
								<div class="mb-2 h-3 w-28 animate-pulse rounded bg-surface-overlay"></div>
								{#each [0, 1, 2] as __}
									<div class="flex items-center gap-3 py-2">
										<div class="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-surface-overlay"></div>
										<div class="flex-1 space-y-1.5">
											<div class="h-3 w-2/3 animate-pulse rounded bg-surface-overlay"></div>
											<div class="h-2.5 w-1/3 animate-pulse rounded bg-surface-overlay"></div>
										</div>
									</div>
								{/each}
							</div>
						{/each}
					</div>
				{:else if searchError}
					<p class="text-sm text-text-muted">{searchError}</p>
				{:else if !hasResults}
					<p class="text-sm text-text-muted">No results for "{searchQuery}"</p>
				{:else}

					<!-- Songs from your playlists -->
					{#if playlistTrackResults.length > 0}
						<section>
							<h2 class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">From your playlists</h2>
							<div class="space-y-0.5">
								{#each (showMorePlaylistTracks ? playlistTrackResults : playlistTrackResults.slice(0, 10)) as track (track.id)}
									<button
										onclick={() => handlePlaylistTrackClick(track)}
										class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-overlay"
									>
										{#if track.albumArt}
											<img src={track.albumArt} alt="" class="h-10 w-10 shrink-0 rounded-lg object-cover" />
										{:else}
											<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-overlay text-text-muted">
												<Icon name="music" size={14} />
											</div>
										{/if}
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium text-text-primary">{track.title}</p>
											<p class="truncate text-xs text-text-secondary">{track.artist}</p>
										</div>
										<span class="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-text-muted">{track.playlistName}</span>
									</button>
								{/each}
							</div>
							{#if playlistTrackResults.length > 10}
								<button
									onclick={() => (showMorePlaylistTracks = !showMorePlaylistTracks)}
									class="mt-1 w-full rounded-lg py-2 text-xs text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-secondary"
								>
									{showMorePlaylistTracks ? 'Show less' : `Show ${playlistTrackResults.length - 10} more`}
								</button>
							{/if}
						</section>
					{/if}

					<!-- Songs from Last.fm -->
					{#if lastfmTrackResults.length > 0}
						<section>
							<h2 class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Songs</h2>
							<div class="space-y-0.5">
								{#each (showMoreLastfmTracks ? lastfmTrackResults : lastfmTrackResults.slice(0, 10)) as result, i (i)}
									<button
										onclick={() => handleLastfmTrackClick(result)}
										class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-overlay"
									>
										{#if result.albumArt}
											<img src={result.albumArt} alt="" class="h-10 w-10 shrink-0 rounded-lg object-cover" />
										{:else}
											<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-overlay text-text-muted">
												<Icon name="music" size={14} />
											</div>
										{/if}
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium text-text-primary">{result.title}</p>
											<p class="truncate text-xs text-text-secondary">{result.artist}</p>
										</div>
									</button>
								{/each}
							</div>
							{#if lastfmTrackResults.length > 10}
								<button
									onclick={() => (showMoreLastfmTracks = !showMoreLastfmTracks)}
									class="mt-1 w-full rounded-lg py-2 text-xs text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-secondary"
								>
									{showMoreLastfmTracks ? 'Show less' : `Show ${lastfmTrackResults.length - 10} more`}
								</button>
							{/if}
						</section>
					{/if}

					<!-- Artists -->
					{#if artistResults.length > 0}
						<section>
							<h2 class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Artists</h2>
							<div class="space-y-0.5">
								{#each (showMoreArtists ? artistResults : artistResults.slice(0, 10)) as artist, i (i)}
									<button
										onclick={() => handleArtistClick(artist)}
										class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-overlay"
									>
										{#if artist.imageUrl}
											<img src={artist.imageUrl} alt="" class="h-10 w-10 shrink-0 rounded-full object-cover" />
										{:else}
											<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-overlay text-text-muted">
												<Icon name="music" size={14} />
											</div>
										{/if}
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium text-text-primary">{artist.name}</p>
											{#if artist.listeners}
												<p class="truncate text-xs text-text-muted">{Number(artist.listeners).toLocaleString()} listeners</p>
											{/if}
										</div>
										<Icon name="search" size={12} class="shrink-0 text-text-muted" />
									</button>
								{/each}
							</div>
							{#if artistResults.length > 10}
								<button
									onclick={() => (showMoreArtists = !showMoreArtists)}
									class="mt-1 w-full rounded-lg py-2 text-xs text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-secondary"
								>
									{showMoreArtists ? 'Show less' : `Show ${artistResults.length - 10} more`}
								</button>
							{/if}
						</section>
					{/if}

					<!-- Albums -->
					{#if albumResults.length > 0}
						<section>
							<h2 class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Albums</h2>
							<div class="space-y-0.5">
								{#each (showMoreAlbums ? albumResults : albumResults.slice(0, 10)) as album, i (i)}
									<button
										onclick={() => handleAlbumClick(album)}
										class="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-overlay"
									>
										{#if album.imageUrl}
											<img src={album.imageUrl} alt="" class="h-10 w-10 shrink-0 rounded-lg object-cover" />
										{:else}
											<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-overlay text-text-muted">
												<Icon name="music" size={14} />
											</div>
										{/if}
										<div class="min-w-0 flex-1">
											<p class="truncate text-sm font-medium text-text-primary">{album.name}</p>
											<p class="truncate text-xs text-text-secondary">{album.artist}</p>
										</div>
									</button>
								{/each}
							</div>
							{#if albumResults.length > 10}
								<button
									onclick={() => (showMoreAlbums = !showMoreAlbums)}
									class="mt-1 w-full rounded-lg py-2 text-xs text-text-muted transition-colors hover:bg-surface-overlay hover:text-text-secondary"
								>
									{showMoreAlbums ? 'Show less' : `Show ${albumResults.length - 10} more`}
								</button>
							{/if}
						</section>
					{/if}

				{/if}
			</div>
		{/if}
	</div>

	{#if imported}
		<div class="mb-4 rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
			Successfully imported {imported} tracks.
		</div>
	{/if}

	{#if !searchMode}

	{#if data.playlists.length === 0}
		<div class="py-20 text-center">
			<p class="mb-2 text-lg text-text-secondary">No playlists yet</p>
			<p class="mb-6 text-sm text-text-muted">Import your songs from Spotify to get started.</p>
			<a
				href="/import"
				class="inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-surface hover:bg-accent-hover transition-colors"
			>
				Import from Spotify
			</a>
		</div>
	{:else}
		<div class="mb-3">
			<p class="text-xs text-text-muted">
				{data.playlists.length} playlist{data.playlists.length !== 1 ? 's' : ''}
			</p>
		</div>

		<div class="space-y-2">
			{#each data.playlists as playlist (playlist.id)}
				<a
					href="/playlist/{playlist.slug}"
					class="flex items-center gap-4 rounded-xl border border-border bg-surface-raised py-1 pl-1 pr-4 transition-colors hover:bg-surface-overlay"
				>
					<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#111] text-accent">
						{#if playlist.emoji}
							<span class="text-[16px] leading-none">{playlist.emoji}</span>
						{:else}
							<Icon name="music" size={20} />
						{/if}
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium text-text-primary">{playlist.name}</p>
						<p class="text-xs text-text-muted">
							{playlist.trackCount} track{playlist.trackCount !== 1 ? 's' : ''}
							{#if playlist.createdAt}
								<span class="mx-1">·</span>
								{formatDate(playlist.createdAt)}
							{/if}
						</p>
					</div>
					</a>
			{/each}
		</div>
	{/if}

	{#if data.recentRadios && data.recentRadios.length > 0}
		<section class="mt-8">
			<h2 class="mb-3 text-sm font-semibold text-text-secondary">Recent radios</h2>
			<div class="space-y-2">
			{#each data.recentRadios as radio (radio.id)}
				<div class="flex items-center gap-4 rounded-xl border border-border bg-surface-raised py-1 pl-1 pr-4 transition-colors hover:bg-surface-overlay">
					<a href="/radio/{radio.id}" class="flex min-w-0 flex-1 items-center gap-4">
						{#if radio.seedAlbumArt}
							<img
								src={radio.seedAlbumArt}
								alt=""
								class="h-12 w-12 shrink-0 rounded-lg object-cover"
							/>
						{:else}
							<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#111] text-accent">
								<span class="text-[16px] leading-none">📻</span>
							</div>
						{/if}
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-text-primary">
								{radio.seedArtist} — {radio.seedTitle}
							</p>
							<p class="text-xs text-text-muted">
								{radio.trackCount} track{radio.trackCount !== 1 ? 's' : ''}
								{#if radio.createdAt}
									<span class="mx-1">·</span>
									{formatDate(radio.createdAt)}
								{/if}
							</p>
						</div>
						</a>
					<button
						onclick={() => deleteRadio(radio.id)}
						disabled={deletingRadioId === radio.id}
						class="shrink-0 rounded-lg p-1.5 text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
						title="Delete radio"
					>
						<Icon name="trash" size={14} />
					</button>
				</div>
			{/each}
			</div>
		</section>
	{/if}

	{/if}
</main>

<!-- Create playlist modal -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div class="absolute inset-0 bg-black/60" onclick={() => { showCreateModal = false; }}></div>
		<div class="relative w-full max-w-sm rounded-xl border border-border bg-surface-raised p-6 shadow-2xl">
			<h2 class="mb-4 text-base font-semibold text-text-primary">New playlist</h2>

			<!-- Emoji preview + picker -->
			<div class="mb-4">
				<div class="mb-2 flex items-center gap-3">
					<div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#111] text-accent">
						{#if newEmoji}
							<span class="text-3xl leading-none">{newEmoji}</span>
						{:else}
							<Icon name="music" size={24} />
						{/if}
					</div>
					<p class="text-xs text-text-muted">Pick a cover emoji</p>
				</div>
				<EmojiPicker onselect={(e) => (newEmoji = e)} />
			</div>

			<!-- Name input -->
			<form
				onsubmit={(e) => { e.preventDefault(); createPlaylist(); }}
			>
				<input
					bind:value={newName}
					placeholder="Playlist name"
					class="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent"
					autofocus
					onkeydown={(e) => { if (e.key === 'Escape') showCreateModal = false; }}
				/>
				<div class="flex justify-end gap-2">
					<button
						type="button"
						onclick={() => { showCreateModal = false; }}
						class="rounded-md px-3 py-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={!newName.trim() || creating}
						class="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-surface hover:bg-accent-hover transition-colors disabled:opacity-50"
					>
						{creating ? 'Creating...' : 'Create'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
