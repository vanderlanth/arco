<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';

	let { data }: { data: PageData } = $props();

	type ResolvedSong = {
		type: 'spotify' | 'youtube';
		title: string;
		artist: string;
		albumArt: string;
		spotifyId?: string;
		videoId?: string;
		durationMs?: number | null;
	};

	let resolving = $state(true);
	let resolveError = $state('');
	let song = $state<ResolvedSong | null>(null);
	let selectedIds = $state<Set<number>>(new Set(data.playlists.slice(0, 1).map((p) => p.id)));
	let submitting = $state(false);
	let addedTo = $state<string[]>([]);

	const bookmarkletUrl = $derived(
		`javascript:(function(){window.open('${page.url.origin}/add?url='+encodeURIComponent(location.href),'_blank','width=480,height=640')})();`
	);

	async function resolveSong() {
		if (!data.rawUrl) {
			resolving = false;
			resolveError = 'No URL provided. Use the bookmarklet or share this app from your phone.';
			return;
		}
		try {
			const res = await fetch(`/api/resolve-url?url=${encodeURIComponent(data.rawUrl)}`);
			if (!res.ok) {
				const text = await res.text();
				resolveError = text || 'Could not recognize this URL.';
				return;
			}
			song = await res.json();
		} catch {
			resolveError = 'Network error — please try again.';
		} finally {
			resolving = false;
		}
	}

	async function addSong() {
		if (!song || submitting || selectedIds.size === 0) return;
		submitting = true;
		try {
			const res = await fetch('/api/add-song', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: song.title,
					artist: song.artist,
					albumArt: song.albumArt,
					spotifyId: song.spotifyId,
					youtubeId: song.videoId,
					durationMs: song.durationMs,
					playlistIds: [...selectedIds]
				})
			});
			if (!res.ok) throw new Error('Failed to add song');
			addedTo = data.playlists
				.filter((p) => selectedIds.has(p.id))
				.map((p) => p.name);
		} catch {
			resolveError = 'Failed to add song — please try again.';
		} finally {
			submitting = false;
		}
	}

	function togglePlaylist(id: number) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	$effect(() => {
		resolveSong();
	});
</script>

<svelte:head>
	<title>Add song — Arco</title>
</svelte:head>

<main class="mx-auto max-w-md px-4 py-8">
	<header class="mb-6 flex items-center justify-between">
		<a href="/" class="text-sm text-text-muted hover:text-text-secondary transition-colors">← Arco</a>
		<h1 class="text-base font-semibold text-text-primary">Add song</h1>
		<div class="w-12"></div>
	</header>

	{#if addedTo.length > 0}
		<div class="rounded-xl border border-accent/30 bg-accent/10 p-6 text-center">
			{#if song?.albumArt}
				<img src={song.albumArt} alt="" class="mx-auto mb-4 h-20 w-20 rounded-lg object-cover" />
			{/if}
			<p class="mb-1 font-semibold text-text-primary">{song?.title}</p>
			<p class="mb-4 text-sm text-text-secondary">{song?.artist}</p>
			<p class="mb-5 text-sm text-accent">
				Added to {addedTo.join(', ')}
			</p>
			<div class="flex flex-col gap-2">
				{#each data.playlists.filter((p) => addedTo.includes(p.name)) as playlist (playlist.id)}
					<a
						href="/playlist/{playlist.slug}"
						class="block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-surface hover:bg-accent-hover transition-colors"
					>
						Open {playlist.name}
					</a>
				{/each}
				<a href="/" class="block rounded-lg border border-border px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-overlay transition-colors">
					Home
				</a>
			</div>
		</div>

	{:else if resolving}
		<div class="flex flex-col items-center gap-3 py-16 text-text-muted">
			<div class="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent"></div>
			<p class="text-sm">Resolving song…</p>
		</div>

	{:else if resolveError}
		<div class="rounded-xl border border-border bg-surface-raised p-6">
			<p class="mb-4 text-sm text-text-secondary">{resolveError}</p>
			{#if !data.rawUrl}
				<div class="rounded-lg border border-border bg-surface p-4">
					<p class="mb-2 text-xs font-medium text-text-secondary">Desktop bookmarklet</p>
					<p class="mb-3 text-xs text-text-muted">Drag this link to your bookmarks bar, then click it while on a Spotify or YouTube page:</p>
					<a
						href={bookmarkletUrl}
						class="inline-block rounded-md border border-accent/50 bg-accent/10 px-3 py-1.5 text-xs text-accent"
						onclick={(e) => e.preventDefault()}
					>
						+ Add to Arco
					</a>
				</div>
			{/if}
		</div>

	{:else if song}
		<!-- Song preview -->
		<div class="mb-5 flex items-center gap-4 rounded-xl border border-border bg-surface-raised p-4">
			{#if song.albumArt}
				<img src={song.albumArt} alt="" class="h-16 w-16 shrink-0 rounded-lg object-cover" />
			{:else}
				<div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent text-2xl">♪</div>
			{/if}
			<div class="min-w-0 flex-1">
				<p class="truncate font-medium text-text-primary">{song.title}</p>
				<p class="truncate text-sm text-text-secondary">{song.artist}</p>
				<span class="mt-1 inline-block rounded-full border border-border px-2 py-0.5 text-xs text-text-muted">
					{song.type === 'spotify' ? 'Spotify' : 'YouTube'}
				</span>
			</div>
		</div>

		<!-- Playlist selector -->
		{#if data.playlists.length === 0}
			<p class="mb-5 text-sm text-text-muted">No playlists yet. <a href="/" class="text-accent hover:underline">Create one first.</a></p>
		{:else}
			<p class="mb-2 text-xs font-medium text-text-muted uppercase tracking-wider">Add to playlist</p>
			<div class="mb-5 space-y-1.5">
				{#each data.playlists as playlist (playlist.id)}
					<button
						onclick={() => togglePlaylist(playlist.id)}
						class="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors {selectedIds.has(playlist.id)
							? 'border-accent/40 bg-accent/10 text-text-primary'
							: 'border-border bg-surface-raised text-text-secondary hover:bg-surface-overlay'}"
					>
						<span class="flex h-4 w-4 shrink-0 items-center justify-center rounded border {selectedIds.has(playlist.id) ? 'border-accent bg-accent text-surface' : 'border-border'}">
							{#if selectedIds.has(playlist.id)}
								<svg viewBox="0 0 10 8" class="h-2.5 w-2.5 fill-current"><path d="M1 4l3 3 5-6"/></svg>
							{/if}
						</span>
						<span class="text-sm">{playlist.name}</span>
					</button>
				{/each}
			</div>

			<button
				onclick={addSong}
				disabled={submitting || selectedIds.size === 0}
				class="w-full rounded-lg bg-accent py-3 text-sm font-semibold text-surface hover:bg-accent-hover transition-colors disabled:opacity-50"
			>
				{submitting ? 'Adding…' : `Add to ${selectedIds.size} playlist${selectedIds.size !== 1 ? 's' : ''}`}
			</button>
		{/if}
	{/if}

	<!-- Bookmarklet hint (only when no URL) - shown after resolve error for empty URL case is handled above -->
	{#if !data.rawUrl && !resolveError && !resolving}
		<div class="mt-6 rounded-lg border border-border bg-surface-raised p-4">
			<p class="mb-2 text-xs font-medium text-text-secondary">Desktop bookmarklet</p>
			<p class="mb-3 text-xs text-text-muted">Drag this link to your bookmarks bar, then click it on any Spotify or YouTube page:</p>
			<a
				href={bookmarkletUrl}
				class="inline-block rounded-md border border-accent/50 bg-accent/10 px-3 py-1.5 text-xs text-accent"
				onclick={(e) => e.preventDefault()}
			>
				+ Add to Arco
			</a>
		</div>
	{/if}
</main>
