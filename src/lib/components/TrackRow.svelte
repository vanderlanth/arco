<script lang="ts">
	import type { Track } from '$lib/types';
	import { playerState } from '$lib/stores/playerState.svelte';
	import { snackbar } from '$lib/stores/snackbar.svelte';
	import { goto } from '$app/navigation';
	import Icon from './Icon.svelte';

	interface Props {
		track: Track;
		trackList?: Track[];
		index?: number;
		playlistId?: number;
		allPlaylists?: { id: number; name: string; slug: string }[];
		ontrackremoved?: (trackId: number) => void;
	}

	let { track, trackList, index, playlistId, allPlaylists, ontrackremoved }: Props = $props();

	let showMenu = $state(false);
	let showPlaylistSub = $state(false);
	let addedTo = $state<Set<number>>(new Set());
	let startingRadio = $state(false);

	const isCurrentTrack = $derived(playerState.currentTrack?.id === track.id);
	const isLoading = $derived(isCurrentTrack && playerState.loading);

	function formatDuration(ms: number | null): string {
		if (!ms) return '';
		const m = Math.floor(ms / 60000);
		const s = Math.floor((ms % 60000) / 1000);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	function handleClick() {
		if (isCurrentTrack) {
			playerState.togglePlay();
		} else {
			playerState.playTrack(track, trackList);
		}
	}

	function handlePlayNext() {
		playerState.playNext(track);
		closeMenu();
	}

	function handleAddToQueue() {
		playerState.addToQueue(track);
		closeMenu();
	}

	function closeMenu() {
		showMenu = false;
		showPlaylistSub = false;
	}

	async function removeFromPlaylist() {
		if (!playlistId) return;
		const res = await fetch(`/api/playlists/${playlistId}/tracks/${track.id}`, { method: 'DELETE' });
		if (res.ok) ontrackremoved?.(track.id);
		closeMenu();
	}

	async function addToPlaylist(targetPlaylistId: number) {
		const res = await fetch(`/api/playlists/${targetPlaylistId}/tracks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ trackId: track.id })
		});
		if (res.ok) addedTo = new Set([...addedTo, targetPlaylistId]);
	}

	async function copyLink() {
		const url = track.spotifyId
			? `https://open.spotify.com/track/${track.spotifyId}`
			: `https://youtube.com/watch?v=${track.youtubeId}`;
		await navigator.clipboard.writeText(url!);
		snackbar.show('Link copied to clipboard');
		closeMenu();
	}

	async function startRadio() {
		if (startingRadio) return;
		startingRadio = true;
		closeMenu();
		try {
			const res = await fetch('/api/radio', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					artist: track.artist,
					track: track.title,
					albumArt: track.albumArt
				})
			});
			if (!res.ok) {
				const data = await res.json().catch(() => null);
				const msg = data?.message ?? 'Failed to create radio';
				alert(msg);
				return;
			}
			const { id } = await res.json();
			goto(`/radio/${id}`);
		} finally {
			startingRadio = false;
		}
	}
</script>

<div
	class="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-overlay {isCurrentTrack ? 'bg-accent/5' : ''}"
>
	<button
		onclick={handleClick}
		class="group/art relative flex h-9 w-9 shrink-0 items-center justify-center rounded"
		aria-label={isCurrentTrack ? (playerState.isPlaying ? 'Pause' : 'Play') : `Play ${track.title}`}
	>
		{#if track.albumArt}
			<img src={track.albumArt} alt="" class="h-9 w-9 rounded" />
		{:else}
			<div class="flex h-9 w-9 items-center justify-center rounded bg-surface-overlay text-text-muted">
				<Icon name="music" size={14} />
			</div>
		{/if}

		{#if isLoading}
			<div class="absolute inset-0 flex items-center justify-center rounded bg-black/40">
				<div class="loading-spinner-sm"></div>
			</div>
		{:else if isCurrentTrack}
			<div class="absolute inset-0 flex items-center justify-center rounded bg-black/30">
				{#if playerState.isPlaying}
					<Icon name="pause" size={16} class="text-white" />
				{:else}
					<Icon name="play" size={16} class="text-white" />
				{/if}
			</div>
		{/if}
	</button>

	<button onclick={handleClick} class="min-w-0 flex-1 text-left">
		<p class="truncate text-sm font-medium" class:text-accent={isCurrentTrack} class:text-text-primary={!isCurrentTrack}>
			{#if isLoading}
				<span class="animate-pulse">{track.title}</span>
			{:else}
				{track.title}
			{/if}
		</p>
		<p class="truncate text-xs text-text-secondary">{track.artist}</p>
	</button>

	<span class="text-xs text-text-muted">{formatDuration(track.durationMs)}</span>

	<div class="relative">
		<button
			onclick={() => { showMenu = !showMenu; showPlaylistSub = false; }}
			class="rounded p-1.5 text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
			aria-label="Track options"
		>
			<Icon name="overflow-menu" size={16} />
		</button>

		{#if showMenu}
			<div
				class="absolute right-0 top-full z-30 mt-1 w-52 rounded-lg border border-border bg-surface-raised py-1 shadow-xl"
				role="menu"
			>
				<button
					onclick={handlePlayNext}
					class="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-overlay"
					role="menuitem"
				>
					Play next
				</button>
				<button
					onclick={handleAddToQueue}
					class="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-overlay"
					role="menuitem"
				>
					Add to queue
				</button>
				<button
					onclick={startRadio}
					disabled={startingRadio}
					class="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-overlay disabled:opacity-50"
					role="menuitem"
				>
					{startingRadio ? 'Starting...' : 'Start radio'}
				</button>
				<button
					onclick={copyLink}
					class="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-overlay"
					role="menuitem"
				>
					Copy link
				</button>

				{#if allPlaylists && allPlaylists.length > 0}
					<div class="my-1 border-t border-border"></div>
					<div class="relative">
						<button
							onclick={() => (showPlaylistSub = !showPlaylistSub)}
							class="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-overlay"
							role="menuitem"
						>
							<span>Add to playlist</span>
							<Icon name="chevron-right" size={12} />
						</button>

						{#if showPlaylistSub}
							<div class="absolute right-full top-0 z-40 mr-1 w-48 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface-raised py-1 shadow-xl">
								{#each allPlaylists as pl (pl.id)}
									{@const alreadyIn = addedTo.has(pl.id) || pl.id === playlistId}
									<button
										onclick={() => { if (!alreadyIn) addToPlaylist(pl.id); }}
										class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-overlay {alreadyIn ? 'text-text-muted' : 'text-text-primary'}"
										disabled={alreadyIn}
										role="menuitem"
									>
										{#if alreadyIn}
											<Icon name="checkmark" size={14} class="shrink-0 text-accent" />
										{:else}
											<Icon name="add" size={14} class="shrink-0" />
										{/if}
										<span class="truncate">{pl.name}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				{#if playlistId}
					<div class="my-1 border-t border-border"></div>
					<button
						onclick={removeFromPlaylist}
						class="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-surface-overlay"
						role="menuitem"
					>
						Remove from this playlist
					</button>
				{/if}
			</div>
			<button
				onclick={closeMenu}
				class="fixed inset-0 z-20"
				aria-label="Close menu"
			></button>
		{/if}
	</div>
</div>

<style>
	.loading-spinner-sm {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.2);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
