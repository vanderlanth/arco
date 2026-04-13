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
	interface LastfmResult { title: string; artist: string; albumArt: string | null; }

	let searchQuery = $state('');
	let searchResults = $state<LastfmResult[]>([]);
	let searchLoading = $state(false);
	let searchFocused = $state(false);
	let searchError = $state<string | null>(null);
	let queueLoading = $state(false);
	let searchDebounce: ReturnType<typeof setTimeout>;

	const RECENT_KEY = 'arco:recent-searches';
	const MAX_RECENT = 5;
	let recentSearches = $state<LastfmResult[]>([]);

	$effect(() => {
		try { recentSearches = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); }
		catch { recentSearches = []; }
	});

	function handleSearchInput() {
		clearTimeout(searchDebounce);
		searchError = null;
		if (!searchQuery.trim()) {
			searchResults = [];
			searchLoading = false;
			return;
		}
		searchLoading = true;
		searchDebounce = setTimeout(async () => {
			try {
				const res = await fetch(`/api/search-lastfm?q=${encodeURIComponent(searchQuery.trim())}`);
				if (!res.ok) throw new Error();
				const data = await res.json();
				searchResults = data.results ?? [];
			} catch {
				searchError = 'Search unavailable';
				searchResults = [];
			} finally {
				searchLoading = false;
			}
		}, 300);
	}

	function saveToRecent(result: LastfmResult) {
		const deduped = recentSearches.filter(
			(r) => !(r.title === result.title && r.artist === result.artist)
		);
		const next = [result, ...deduped].slice(0, MAX_RECENT);
		recentSearches = next;
		try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
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

	function handleResultClick(result: LastfmResult) {
		saveToRecent(result);
		searchQuery = '';
		searchResults = [];
		searchFocused = false;

		const seed: Track = {
			id: -1,
			spotifyId: null,
			title: result.title,
			artist: result.artist,
			album: null,
			albumArt: result.albumArt,
			durationMs: null,
			addedAt: null,
			youtubeId: null,
			playlistId: null
		};

		playerState.playTrack(seed, [seed]);
		queueLoading = true;
		fetchAndSetQueue(result.artist, result.title, seed);
	}

	function handleSearchBlur() {
		setTimeout(() => { searchFocused = false; }, 150);
	}

	const showDropdown = $derived(
		searchFocused && (searchQuery.trim().length > 0 || recentSearches.length > 0)
	);

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

	<!-- Last.fm search -->
	<div class="relative mb-6">
		<div class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
			<Icon name="search" size={18} />
		</div>
		<input
			type="search"
			bind:value={searchQuery}
			oninput={handleSearchInput}
			onfocus={() => (searchFocused = true)}
			onblur={handleSearchBlur}
			placeholder="Search for any song..."
			class="w-full rounded-lg border border-border bg-surface-raised py-2.5 pl-10 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
		/>
		{#if searchQuery}
			<button
				onclick={() => { searchQuery = ''; searchResults = []; searchError = null; }}
				class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
				aria-label="Clear search"
			>
				<Icon name="close" size={16} />
			</button>
		{/if}

		{#if showDropdown}
			<div class="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-border bg-surface-raised shadow-xl">
				{#if searchQuery.trim()}
					{#if searchLoading}
						<div class="px-4 py-3 text-xs text-text-muted">Searching Last.fm...</div>
					{:else if searchError}
						<div class="px-4 py-3 text-xs text-text-muted">{searchError}</div>
					{:else if searchResults.length === 0}
						<div class="px-4 py-3 text-xs text-text-muted">No results found</div>
					{:else}
						{#each searchResults as result}
							<button
								onmousedown={() => handleResultClick(result)}
								class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-overlay"
							>
								{#if result.albumArt}
									<img src={result.albumArt} alt="" class="h-9 w-9 shrink-0 rounded object-cover" />
								{:else}
									<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-surface-overlay text-text-muted">
										<Icon name="music" size={14} />
									</div>
								{/if}
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-text-primary">{result.title}</p>
									<p class="truncate text-xs text-text-secondary">{result.artist}</p>
								</div>
							</button>
						{/each}
					{/if}
				{:else}
					<div class="px-3 pb-1 pt-2">
						<p class="text-[10px] font-medium uppercase tracking-wider text-text-muted">Recent</p>
					</div>
					{#each recentSearches as recent}
						<button
							onmousedown={() => handleResultClick(recent)}
							class="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-overlay"
						>
							{#if recent.albumArt}
								<img src={recent.albumArt} alt="" class="h-8 w-8 shrink-0 rounded object-cover" />
							{:else}
								<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface-overlay text-text-muted">
									<Icon name="music" size={12} />
								</div>
							{/if}
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm text-text-primary">{recent.title}</p>
								<p class="truncate text-xs text-text-secondary">{recent.artist}</p>
							</div>
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	</div>

	{#if imported}
		<div class="mb-4 rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
			Successfully imported {imported} tracks.
		</div>
	{/if}

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
