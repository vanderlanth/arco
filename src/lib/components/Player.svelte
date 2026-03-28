<script lang="ts">
	import { playerState } from '$lib/stores/playerState.svelte';
	import type { QueueTrack } from '$lib/stores/playerState.svelte';
	import Queue from './Queue.svelte';

	import Icon from './Icon.svelte';
	import TextRing from './TextRing.svelte';

	let audioEl = $state<HTMLAudioElement | null>(null);
	let expanded = $state(false);
	let showQueue = $state(false);
	let errorDismissed = $state(false);

	$effect(() => {
		if (playerState.error) errorDismissed = false;
	});

	// --- Preload pool: fetch next 3 tracks as Blobs for instant playback ---
	const preloadCache = new Map<string, string>();
	const preloadInFlight = new Map<string, AbortController>();
	const preloadFailed = new Map<string, number>();
	const MAX_RETRIES = 2;
	const POOL_SIZE = 6;

	function preloadKey(track: { youtubeId?: string | null; id: number }): string {
		return track.youtubeId ?? String(track.id);
	}

	function evictPreload(key: string) {
		const blobUrl = preloadCache.get(key);
		if (blobUrl) {
			URL.revokeObjectURL(blobUrl);
			preloadCache.delete(key);
		}
		const ctrl = preloadInFlight.get(key);
		if (ctrl) {
			ctrl.abort();
			preloadInFlight.delete(key);
		}
		preloadFailed.delete(key);
	}

	function consumePreload(key: string): string | undefined {
		const blobUrl = preloadCache.get(key);
		if (blobUrl) {
			preloadCache.delete(key);
			return blobUrl;
		}
		return undefined;
	}

	$effect(() => {
		const upcoming = playerState.upNext;
		const currentKey = playerState.currentTrack ? preloadKey(playerState.currentTrack) : null;
		const neededKeys = new Set(upcoming.map(preloadKey));
		if (currentKey) neededKeys.add(currentKey);

		if (preloadCache.size + preloadInFlight.size > POOL_SIZE) {
			for (const key of [...preloadCache.keys(), ...preloadInFlight.keys()]) {
				if (!neededKeys.has(key)) evictPreload(key);
			}
		}

		for (const track of upcoming) {
			const key = preloadKey(track);
			if (preloadCache.has(key) || preloadInFlight.has(key)) continue;
			if ((preloadFailed.get(key) ?? 0) >= MAX_RETRIES) continue;

			const ctrl = new AbortController();
			preloadInFlight.set(key, ctrl);

			fetch(playerState.getStreamUrl(track), { signal: ctrl.signal })
				.then((res) => {
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					return res.blob();
				})
				.then((blob) => {
					preloadInFlight.delete(key);
					preloadFailed.delete(key);
					preloadCache.set(key, URL.createObjectURL(blob));
				})
				.catch((err) => {
					preloadInFlight.delete(key);
					if (err?.name !== 'AbortError') {
						preloadFailed.set(key, (preloadFailed.get(key) ?? 0) + 1);
					}
				});
		}
	});


	// --- Re-assert playback when returning from background / lock screen ---
	function handleVisibilityChange() {
		if (document.visibilityState !== 'visible') return;
		if (!playerState.currentTrack || !playerState.isPlaying) return;

		updateMediaMetadata(playerState.currentTrack);

		if (audioEl && audioEl.paused) {
			audioEl.play().catch(() => {});
		}
	}

	$effect(() => {
		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
	});

	// --- Media Session action handlers (registered once) ---
	$effect(() => {
		if (!('mediaSession' in navigator)) return;
		navigator.mediaSession.setActionHandler('play', () => { playerState.isPlaying = true; });
		navigator.mediaSession.setActionHandler('pause', () => { playerState.isPlaying = false; });
		navigator.mediaSession.setActionHandler('nexttrack', () => { playerState.skipNext(); });
		navigator.mediaSession.setActionHandler('previoustrack', () => { handleSkipPrev(); });
		try {
			navigator.mediaSession.setActionHandler('seekto', (d) => {
				if (audioEl && d.seekTime != null) {
					audioEl.currentTime = d.seekTime;
					playerState.setProgress(d.seekTime);
				}
			});
			navigator.mediaSession.setActionHandler('seekforward', (d) => {
				if (audioEl) audioEl.currentTime = Math.min(audioEl.duration, audioEl.currentTime + (d.seekOffset ?? 10));
			});
			navigator.mediaSession.setActionHandler('seekbackward', (d) => {
				if (audioEl) audioEl.currentTime = Math.max(0, audioEl.currentTime - (d.seekOffset ?? 10));
			});
		} catch {
			// seek handlers not supported in this browser
		}
	});

	function updateMediaMetadata(track: QueueTrack) {
		if (!('mediaSession' in navigator)) return;
		navigator.mediaSession.metadata = new MediaMetadata({
			title: track.title,
			artist: track.artist,
			album: track.album ?? undefined,
			artwork: track.albumArt
				? [{ src: track.albumArt, sizes: '512x512', type: 'image/jpeg' }]
				: undefined
		});
		navigator.mediaSession.playbackState = 'playing';
	}

	function loadAndPlay(track: QueueTrack, url: string) {
		if (!audioEl) return;
		const key = preloadKey(track);
		const blobUrl = consumePreload(key);
		audioEl.src = blobUrl ?? url;
		audioEl.play().catch(() => {});
		updateMediaMetadata(track);
	}

	// --- Main audio source management ---
	let lastTrackQueueId = '';
	let trackChanging = false;
	let srcSetByHandler = false;

	$effect(() => {
		if (!audioEl) return;
		const url = playerState.audioUrl;
		const current = playerState.currentTrack;
		const queueId = current?.queueId ?? '';

		if (!url || !current || queueId === lastTrackQueueId) return;

		lastTrackQueueId = queueId;
		trackChanging = true;

		if (srcSetByHandler) {
			srcSetByHandler = false;
			return;
		}

		updateMediaMetadata(current);
		const key = preloadKey(current);
		const blobUrl = consumePreload(key);
		audioEl.src = blobUrl ?? url;
		audioEl.play().catch(() => {});
	});

	function handleEnded() {
		if (playerState.repeat === 'one' && audioEl) {
			audioEl.currentTime = 0;
			audioEl.play().catch(() => {});
			return;
		}

		// Synchronously load the next track within the ended handler so mobile
		// browsers keep the audio session alive (they reject async .play() calls
		// outside the original event's call stack on lock-screen / background).
		const upcoming = playerState.upNext;
		if (upcoming.length > 0 && audioEl) {
			const next = upcoming[0];
			const url = playerState.getStreamUrl(next);
			loadAndPlay(next, url);
			srcSetByHandler = true;
			lastTrackQueueId = next.queueId;
		}

		playerState.handleTrackEnded();
	}

	$effect(() => {
		if (!audioEl) return;
		if (playerState.isPlaying) {
			audioEl.play().catch(() => {});
		} else {
			audioEl.pause();
			if ('mediaSession' in navigator) {
				navigator.mediaSession.playbackState = 'paused';
			}
		}
	});


	function handleTimeUpdate() {
		if (!audioEl) return;
		playerState.setProgress(audioEl.currentTime);
		updatePositionState();
	}

	function updatePositionState() {
		if (!audioEl || !('mediaSession' in navigator)) return;
		const duration = audioEl.duration;
		if (!duration || !isFinite(duration) || duration <= 0) return;
		const position = Math.min(audioEl.currentTime, duration);
		try {
			navigator.mediaSession.setPositionState({
				duration,
				playbackRate: audioEl.playbackRate || 1,
				position
			});
		} catch {
			// ignore — some browsers reject setPositionState in certain states
		}
	}

	function handleLoadedMetadata() {
		if (!audioEl) return;
		playerState.setDuration(audioEl.duration);
		updatePositionState();
	}

	function handleCanPlay() {
		playerState.setLoading(false);
	}

	function handlePlaying() {
		trackChanging = false;
		if ('mediaSession' in navigator) {
			navigator.mediaSession.playbackState = 'playing';
		}
	}

	function handlePause() {
		// Intentionally empty — mediaSession.playbackState is driven by playerState.isPlaying,
		// not by raw audio element events, to survive Android audio focus interruptions on lock.
	}

	let stallRetries = 0;
	const MAX_STALL_RETRIES = 2;

	function handleWaiting() {
		if (!audioEl || !playerState.isPlaying || !playerState.currentTrack) return;
		playerState.setLoading(true);

		// If the audio stalls for too long in background, retry with a fresh source
		const stallTimer = setTimeout(() => {
			if (!audioEl || !audioEl.paused || audioEl.readyState >= 3) return;
			if (stallRetries >= MAX_STALL_RETRIES) { stallRetries = 0; return; }
			stallRetries++;
			const track = playerState.currentTrack;
			if (!track) return;
			const pos = audioEl.currentTime;
			audioEl.src = playerState.getStreamUrl(track);
			audioEl.currentTime = pos;
			audioEl.play().catch(() => {});
		}, 8000);

		const onResume = () => {
			clearTimeout(stallTimer);
			stallRetries = 0;
		};
		audioEl.addEventListener('playing', onResume, { once: true });
	}

	function handleAudioError() {
		playerState.setLoading(false);
		const err = audioEl?.error;
		const code = err?.code;

		// Code 1 = MEDIA_ERR_ABORTED (user/app intentionally aborted) — don't auto-skip
		if (code === 1) return;

		const msg = err?.message || '';
		const detail =
			code === 2 ? 'Network error' :
			code === 3 ? 'Decoding error' :
			code === 4 ? 'Source not supported' :
			'Unknown error';
		playerState.setError(`${detail}${msg ? ': ' + msg : ''} — skipping`);

		// Auto-advance: synchronously load next track so mobile browsers keep
		// the audio session alive (same pattern as handleEnded).
		const upcoming = playerState.upNext;
		if (upcoming.length > 0 && audioEl) {
			const next = upcoming[0];
			const url = playerState.getStreamUrl(next);
			loadAndPlay(next, url);
			srcSetByHandler = true;
			lastTrackQueueId = next.queueId;
		}

		playerState.skipNext();
	}

	function handleSkipPrev() {
		if (audioEl && playerState.progress > 3) {
			audioEl.currentTime = 0;
			playerState.setProgress(0);
		} else {
			playerState.skipPrev();
		}
	}

	function handleSeek(e: Event) {
		const input = e.target as HTMLInputElement;
		const time = Number(input.value);
		if (audioEl) {
			audioEl.currentTime = time;
			playerState.setProgress(time);
		}
	}

	function formatTime(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	let isDesktop = $state(false);

	$effect(() => {
		const mql = window.matchMedia('(min-width: 1024px)');
		isDesktop = mql.matches;
		const handler = (e: MediaQueryListEvent) => { isDesktop = e.matches; };
		mql.addEventListener('change', handler);
		return () => mql.removeEventListener('change', handler);
	});

	let volume = $state(1);
	let muted = $state(false);

	$effect(() => {
		if (!audioEl) return;
		audioEl.volume = muted ? 0 : volume;
	});

	function handleVolumeChange(e: Event) {
		const input = e.target as HTMLInputElement;
		volume = Number(input.value);
		if (volume > 0) muted = false;
	}

	function toggleMute() {
		muted = !muted;
	}
</script>

<audio
	bind:this={audioEl}
	ontimeupdate={handleTimeUpdate}
	onloadedmetadata={handleLoadedMetadata}
	oncanplay={handleCanPlay}
	onplaying={handlePlaying}
	onpause={handlePause}
	onwaiting={handleWaiting}
	onerror={handleAudioError}
	onended={handleEnded}
	preload="auto"
></audio>

{#if playerState.error && !errorDismissed}
	<div class="fixed inset-x-0 bottom-20 z-50 mx-auto max-w-md px-4 lg:bottom-4 lg:right-[34vw] lg:left-auto lg:inset-x-auto">
		<div class="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 shadow-lg backdrop-blur">
			<p class="flex-1 text-sm text-danger">{playerState.error}</p>
			<button
				onclick={() => (errorDismissed = true)}
				class="shrink-0 text-danger/60 hover:text-danger"
				aria-label="Dismiss error"
			>
				<Icon name="close" size={16} />
			</button>
		</div>
	</div>
{/if}

{#if playerState.currentTrack}
	{#if !isDesktop}
		<!-- MOBILE: Expanded full-screen player -->
		{#if expanded}
			<div class="fixed inset-0 z-50 flex flex-col bg-surface">
				<div class="flex items-center justify-between p-4">
					<button
						onclick={() => (expanded = false)}
						class="text-text-muted hover:text-text-primary"
						aria-label="Minimize player"
					>
						<Icon name="chevron-down" size={24} />
					</button>
					<button
						onclick={() => { showQueue = true; expanded = false; }}
						class="text-text-muted hover:text-text-primary"
						aria-label="Open queue"
					>
						<Icon name="playlist" size={24} />
					</button>
				</div>

				<div class="flex flex-1 flex-col items-center justify-center gap-6 px-8">
					<div class="relative aspect-square w-full max-w-[360px]">
						<TextRing
							text="{playerState.currentTrack.title.toUpperCase()} · {playerState.currentTrack.artist.toUpperCase()} "
						/>

					</div>

					<div class="w-full text-center">
						<h2 class="truncate text-xl font-semibold text-text-primary">
							{playerState.currentTrack.title}
						</h2>
						<p class="truncate text-text-secondary">{playerState.currentTrack.artist}</p>
					</div>

					<div class="flex items-center gap-6">
						<button
							onclick={() => playerState.toggleShuffle()}
							class="transition-colors"
							class:text-accent={playerState.shuffled}
							class:text-text-muted={!playerState.shuffled}
							aria-label="Toggle shuffle"
						>
							<Icon name="shuffle" size={20} />
						</button>

						<button
							onclick={handleSkipPrev}
							class="text-text-secondary hover:text-text-primary"
							aria-label="Previous"
						>
							<Icon name="skip-back" size={28} />
						</button>

						<button
							onclick={() => playerState.togglePlay()}
							class="flex h-14 w-14 items-center justify-center rounded-full bg-text-primary text-surface"
							aria-label={playerState.isPlaying ? 'Pause' : 'Play'}
						>
							{#if playerState.loading}
								<div class="loading-spinner h-6 w-6 border-surface"></div>
							{:else if playerState.isPlaying}
								<Icon name="pause" size={24} />
							{:else}
								<Icon name="play" size={24} />
							{/if}
						</button>

						<button
							onclick={() => playerState.skipNext()}
							class="text-text-secondary hover:text-text-primary"
							aria-label="Next"
						>
							<Icon name="skip-forward" size={28} />
						</button>

						<button
							onclick={() => playerState.cycleRepeat()}
							class="transition-colors"
							class:text-accent={playerState.repeat !== 'off'}
							class:text-text-muted={playerState.repeat === 'off'}
							aria-label="Cycle repeat mode ({playerState.repeat})"
						>
							{#if playerState.repeat === 'one'}
								<Icon name="repeat-one" size={20} />
							{:else}
								<Icon name="repeat" size={20} />
							{/if}
						</button>
					</div>

					<div class="mx-auto w-full max-w-[420px]">
						<input
							type="range"
							min="0"
							max={playerState.duration || 0}
							value={playerState.progress}
							oninput={handleSeek}
							class="w-full accent-accent"
						/>
						<div class="mt-1 flex justify-between text-xs text-text-muted">
							<span>{formatTime(playerState.progress)}</span>
							<span>{formatTime(playerState.duration)}</span>
						</div>
					</div>

					<div class="mx-auto hidden w-full max-w-[420px] items-center gap-3 md:flex">
						<button
							onclick={toggleMute}
							class="shrink-0 text-text-secondary hover:text-text-primary"
							aria-label={muted || volume === 0 ? 'Unmute' : 'Mute'}
						>
							{#if muted || volume === 0}
								<Icon name="volume-mute" size={20} />
							{:else if volume < 0.5}
								<Icon name="volume-low" size={20} />
							{:else}
								<Icon name="volume-up" size={20} />
							{/if}
						</button>
						<input
							type="range"
							min="0"
							max="1"
							step="0.02"
							value={muted ? 0 : volume}
							oninput={handleVolumeChange}
							class="volume-slider flex-1 cursor-pointer"
							style="--vol: {(muted ? 0 : volume) * 100}%"
							aria-label="Volume"
						/>
					</div>
				</div>
			</div>
		{/if}

		<!-- MOBILE: Queue overlay -->
		{#if showQueue}
			<div class="fixed inset-x-0 top-0 bottom-[65px] z-[45] flex flex-col bg-surface">
				<div class="flex items-center justify-end p-4">
					<button
						onclick={() => (showQueue = false)}
						class="text-text-muted hover:text-text-primary"
						aria-label="Close queue"
					>
						<Icon name="close" size={24} />
					</button>
				</div>
				<div class="flex-1 overflow-y-auto px-4">
					<Queue />
				</div>
			</div>
		{/if}

		<!-- MOBILE: Mini bar -->
		<div
			class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-raised/95 backdrop-blur-lg"
			class:hidden={expanded}
		>
			<div class="h-0.5 bg-surface-overlay">
				{#if playerState.loading}
					<div class="loading-bar h-full bg-accent"></div>
				{:else}
					<div
						class="h-full bg-accent transition-all duration-200"
						style="width: {playerState.duration ? (playerState.progress / playerState.duration) * 100 : 0}%"
					></div>
				{/if}
			</div>

			<div class="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-2">
				<button
					onclick={() => { showQueue = false; expanded = true; }}
					class="flex min-w-0 items-center gap-2.5"
				>
					<div class="group relative h-10 w-10 shrink-0" role="img">
						{#if playerState.currentTrack.albumArt}
							<img
								src={playerState.currentTrack.albumArt}
								alt=""
								class="h-10 w-10 rounded object-cover"
							/>
						{:else}
							<div class="flex h-10 w-10 items-center justify-center rounded bg-surface-overlay text-text-muted">
								<Icon name="music" size={16} />
							</div>
						{/if}
						{#if playerState.loading}
							<div class="absolute inset-0 flex items-center justify-center rounded bg-black/40">
								<div class="loading-spinner h-5 w-5"></div>
							</div>
						{/if}
					</div>
					<div class="min-w-0 text-left">
						<p class="truncate text-sm font-medium text-text-primary">
							{playerState.currentTrack.title}
						</p>
						<p class="truncate text-xs text-text-secondary">
							{playerState.currentTrack.artist}
						</p>
					</div>
				</button>

				<div class="flex items-center justify-center gap-1">
					<button
						onclick={handleSkipPrev}
						class="rounded-full p-1.5 text-text-secondary hover:bg-surface-overlay"
						aria-label="Previous"
					>
						<Icon name="skip-back" size={18} />
					</button>

					<button
						onclick={() => playerState.togglePlay()}
						class="rounded-full p-1.5 text-text-primary hover:bg-surface-overlay"
						aria-label={playerState.isPlaying ? 'Pause' : 'Play'}
					>
						{#if playerState.loading}
							<div class="loading-spinner h-5 w-5"></div>
						{:else if playerState.isPlaying}
							<Icon name="pause" size={22} />
						{:else}
							<Icon name="play" size={22} />
						{/if}
					</button>

					<button
						onclick={() => playerState.skipNext()}
						class="rounded-full p-1.5 text-text-secondary hover:bg-surface-overlay"
						aria-label="Next"
					>
						<Icon name="skip-forward" size={18} />
					</button>
				</div>

				<div class="flex items-center gap-0.5">
					<div class="mr-1 hidden items-center gap-1 md:flex">
						<button
							onclick={toggleMute}
							class="rounded-full p-1.5 text-text-secondary hover:bg-surface-overlay"
							aria-label={muted || volume === 0 ? 'Unmute' : 'Mute'}
						>
							{#if muted || volume === 0}
								<Icon name="volume-mute" size={16} />
							{:else if volume < 0.5}
								<Icon name="volume-low" size={16} />
							{:else}
								<Icon name="volume-up" size={16} />
							{/if}
						</button>
						<input
							type="range"
							min="0"
							max="1"
							step="0.02"
							value={muted ? 0 : volume}
							oninput={handleVolumeChange}
							class="volume-slider w-20 cursor-pointer"
							style="--vol: {(muted ? 0 : volume) * 100}%"
							aria-label="Volume"
						/>
					</div>

					<button
						onclick={() => playerState.toggleShuffle()}
						class="rounded-full p-1.5 transition-colors"
						class:text-accent={playerState.shuffled}
						class:text-text-muted={!playerState.shuffled}
						aria-label="Toggle shuffle"
					>
						<Icon name="shuffle" size={16} />
					</button>

					<button
						onclick={() => playerState.cycleRepeat()}
						class="rounded-full p-1.5 transition-colors"
						class:text-accent={playerState.repeat !== 'off'}
						class:text-text-muted={playerState.repeat === 'off'}
						aria-label="Cycle repeat mode ({playerState.repeat})"
					>
						{#if playerState.repeat === 'one'}
							<Icon name="repeat-one" size={16} />
						{:else}
							<Icon name="repeat" size={16} />
						{/if}
					</button>

					<button
						onclick={() => (showQueue = !showQueue)}
						class="rounded-full p-1.5 text-text-secondary hover:bg-surface-overlay"
						class:text-accent={showQueue}
						aria-label={showQueue ? 'Close queue' : 'Open queue'}
					>
						<Icon name="playlist" size={16} />
					</button>
				</div>
			</div>
		</div>
	{:else}
		<!-- DESKTOP: Side panel player -->
		<aside class="desktop-panel flex h-screen w-[33vw] min-w-[360px] shrink-0 flex-col border-l border-border bg-surface">
			<!-- Queue toggle (top-right) -->
			<div class="flex items-center justify-end p-4">
				<button
					onclick={() => (showQueue = !showQueue)}
					class="text-text-muted hover:text-text-primary"
					class:text-accent={showQueue}
					aria-label={showQueue ? 'Close queue' : 'Open queue'}
				>
					<Icon name="playlist" size={24} />
				</button>
			</div>

			{#if showQueue}
				<!-- Queue view -->
				<div class="flex-1 overflow-y-auto px-4">
					<Queue />
				</div>
			{:else}
				<!-- Controls section -->
				<div class="flex flex-1 flex-col items-center justify-center gap-5 px-6 pb-8">
					<!-- TextRing -->
					<div class="relative aspect-square w-full max-w-[280px]">
						<TextRing
							text="{playerState.currentTrack.title.toUpperCase()} · {playerState.currentTrack.artist.toUpperCase()} "
						/>

					</div>

					<!-- Track info -->
					<div class="w-full text-center">
						<h2 class="truncate text-lg font-semibold text-text-primary">
							{playerState.currentTrack.title}
						</h2>
						<p class="truncate text-sm text-text-secondary">{playerState.currentTrack.artist}</p>
					</div>

					<!-- Transport controls -->
					<div class="flex items-center gap-5">
						<button
							onclick={() => playerState.toggleShuffle()}
							class="transition-colors"
							class:text-accent={playerState.shuffled}
							class:text-text-muted={!playerState.shuffled}
							aria-label="Toggle shuffle"
						>
							<Icon name="shuffle" size={18} />
						</button>

						<button
							onclick={handleSkipPrev}
							class="text-text-secondary hover:text-text-primary"
							aria-label="Previous"
						>
							<Icon name="skip-back" size={24} />
						</button>

						<button
							onclick={() => playerState.togglePlay()}
							class="flex h-12 w-12 items-center justify-center rounded-full bg-text-primary text-surface"
							aria-label={playerState.isPlaying ? 'Pause' : 'Play'}
						>
							{#if playerState.loading}
								<div class="loading-spinner h-5 w-5 border-surface"></div>
							{:else if playerState.isPlaying}
								<Icon name="pause" size={22} />
							{:else}
								<Icon name="play" size={22} />
							{/if}
						</button>

						<button
							onclick={() => playerState.skipNext()}
							class="text-text-secondary hover:text-text-primary"
							aria-label="Next"
						>
							<Icon name="skip-forward" size={24} />
						</button>

						<button
							onclick={() => playerState.cycleRepeat()}
							class="transition-colors"
							class:text-accent={playerState.repeat !== 'off'}
							class:text-text-muted={playerState.repeat === 'off'}
							aria-label="Cycle repeat mode ({playerState.repeat})"
						>
							{#if playerState.repeat === 'one'}
								<Icon name="repeat-one" size={18} />
							{:else}
								<Icon name="repeat" size={18} />
							{/if}
						</button>
					</div>

					<!-- Progress bar -->
					<div class="w-full">
						<input
							type="range"
							min="0"
							max={playerState.duration || 0}
							value={playerState.progress}
							oninput={handleSeek}
							class="w-full accent-accent"
						/>
						<div class="mt-1 flex justify-between text-xs text-text-muted">
							<span>{formatTime(playerState.progress)}</span>
							<span>{formatTime(playerState.duration)}</span>
						</div>
					</div>

					<!-- Volume -->
					<div class="flex w-full items-center gap-3">
						<button
							onclick={toggleMute}
							class="shrink-0 text-text-secondary hover:text-text-primary"
							aria-label={muted || volume === 0 ? 'Unmute' : 'Mute'}
						>
							{#if muted || volume === 0}
								<Icon name="volume-mute" size={18} />
							{:else if volume < 0.5}
								<Icon name="volume-low" size={18} />
							{:else}
								<Icon name="volume-up" size={18} />
							{/if}
						</button>
						<input
							type="range"
							min="0"
							max="1"
							step="0.02"
							value={muted ? 0 : volume}
							oninput={handleVolumeChange}
							class="volume-slider flex-1 cursor-pointer"
							style="--vol: {(muted ? 0 : volume) * 100}%"
							aria-label="Volume"
						/>
					</div>
				</div>
			{/if}
		</aside>
	{/if}
{/if}

<style>
	.loading-spinner {
		border: 2.5px solid rgba(59, 130, 246, 0.2);
		border-top-color: rgb(59, 130, 246);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	.loading-bar {
		animation: indeterminate 1.4s ease-in-out infinite;
	}

	.desktop-panel {
		animation: expand-panel 300ms ease-out both;
		overflow: hidden;
	}

	@keyframes expand-panel {
		from {
			width: 0;
			min-width: 0;
		}
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@keyframes indeterminate {
		0% { width: 0%; margin-left: 0; }
		50% { width: 40%; margin-left: 30%; }
		100% { width: 0%; margin-left: 100%; }
	}
</style>
