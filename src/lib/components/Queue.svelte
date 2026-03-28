<script lang="ts">
	import { playerState } from '$lib/stores/playerState.svelte';
	import { dndzone } from 'svelte-dnd-action';
	import Icon from './Icon.svelte';

	const MAX_VISIBLE = 15;
	const SHUFFLE_PREVIEW = 30;
	const flipDurationMs = 200;

	function formatDuration(ms: number | null): string {
		if (!ms) return '';
		const m = Math.floor(ms / 60000);
		const s = Math.floor((ms % 60000) / 1000);
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	let visibleQueue = $derived(playerState.queue.slice(0, MAX_VISIBLE));
	let remainingCount = $derived(Math.max(0, playerState.queue.length - MAX_VISIBLE));
	let implicitUpcoming = $derived(
		playerState.shuffled ? playerState.getImplicitUpcoming(SHUFFLE_PREVIEW) : []
	);

	let dragItems = $state<Array<{ id: string; [key: string]: any }>>([]);
	let shuffleDragItems = $state<Array<{ id: string; trackId: number; [key: string]: any }>>([]);

	$effect(() => {
		dragItems = visibleQueue.map((t) => ({ ...t, id: t.queueId }));
	});

	$effect(() => {
		shuffleDragItems = implicitUpcoming.map((t) => ({ ...t, id: t.queueId, trackId: t.id }));
	});

	function handleDndConsider(e: CustomEvent<{ items: typeof dragItems }>) {
		dragItems = e.detail.items;
	}

	function handleDndFinalize(e: CustomEvent<{ items: typeof dragItems }>) {
		dragItems = e.detail.items;
		const fullQueue = [...playerState.queue];
		const reordered = dragItems.map((item) => fullQueue.find((q) => q.queueId === item.queueId)!);
		const rest = fullQueue.slice(MAX_VISIBLE);
		playerState.reorderQueue([...reordered, ...rest]);
	}

	function handleShuffleDndConsider(e: CustomEvent<{ items: typeof shuffleDragItems }>) {
		shuffleDragItems = e.detail.items;
	}

	function handleShuffleDndFinalize(e: CustomEvent<{ items: typeof shuffleDragItems }>) {
		shuffleDragItems = e.detail.items;
		playerState.reorderShuffledList(shuffleDragItems.map((item) => item.trackId));
	}
</script>

<div class="pb-4">
	{#if playerState.currentTrack}
		<div class="mb-6">
			<h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
				Now Playing
			</h3>
			<div class="flex items-center gap-3 rounded-lg bg-accent/10 p-3">
				{#if playerState.currentTrack.albumArt}
					<img
						src={playerState.currentTrack.albumArt}
						alt=""
						class="h-10 w-10 rounded"
					/>
				{:else}
					<div class="flex h-10 w-10 items-center justify-center rounded bg-surface-overlay text-text-muted">
						<Icon name="music" size={16} />
					</div>
				{/if}
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium text-text-primary">
						{playerState.currentTrack.title}
					</p>
					<p class="truncate text-xs text-text-secondary">
						{playerState.currentTrack.artist}
					</p>
				</div>
				<span class="text-xs text-text-muted">
					{formatDuration(playerState.currentTrack.durationMs)}
				</span>
			</div>
		</div>
	{/if}

	<!-- Explicit queue (user-added tracks) -->
	{#if playerState.queue.length > 0}
		<div class="mb-3 flex items-center justify-between">
			<h3 class="text-xs font-semibold uppercase tracking-wider text-text-muted">
				Queue ({playerState.queue.length})
			</h3>
			<button
				onclick={() => playerState.clearQueue()}
				class="text-xs text-text-muted transition-colors hover:text-danger"
			>
				Clear
			</button>
		</div>

		<ul
			use:dndzone={{ items: dragItems, flipDurationMs, dropTargetStyle: {}, dragHandleSelector: '.drag-handle' }}
			onconsider={handleDndConsider}
			onfinalize={handleDndFinalize}
			class="space-y-1"
		>
			{#each dragItems as track, index (track.id)}
				<li class="group flex items-center gap-2 rounded-lg p-2 hover:bg-surface-overlay">
					<button
						class="drag-handle shrink-0 cursor-grab touch-none text-text-muted opacity-50 transition-opacity hover:text-text-secondary group-hover:opacity-100"
						aria-label="Drag to reorder"
					>
						<Icon name="drag-vertical" size={16} />
					</button>

					<span class="w-5 shrink-0 text-center text-xs text-text-muted">{index + 1}</span>

					{#if track.albumArt}
						<img src={track.albumArt} alt="" class="h-9 w-9 shrink-0 rounded" />
					{:else}
						<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-surface-overlay text-text-muted">
							<Icon name="music" size={14} />
						</div>
					{/if}

					<div class="min-w-0 flex-1">
						<p class="truncate text-sm text-text-primary">{track.title}</p>
						<p class="truncate text-xs text-text-secondary">{track.artist}</p>
					</div>

					<span class="text-xs text-text-muted">{formatDuration(track.durationMs)}</span>

					<button
						onclick={() => playerState.removeFromQueue(track.queueId)}
						class="shrink-0 rounded p-1 text-text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
						aria-label="Remove from queue"
					>
						<Icon name="close" size={16} />
					</button>
				</li>
			{/each}
		</ul>

		{#if remainingCount > 0}
			<p class="mt-3 text-center text-xs text-text-muted">
				+{remainingCount} more track{remainingCount !== 1 ? 's' : ''} in queue
			</p>
		{/if}
	{/if}

	<!-- Shuffled upcoming (implicit next tracks when shuffle is on) -->
	{#if implicitUpcoming.length > 0}
		<div class="mb-3 mt-6 flex items-center gap-2">
			<h3 class="text-xs font-semibold uppercase tracking-wider text-text-muted">
				Next from Shuffle
			</h3>
			<Icon name="shuffle" size={12} class="text-accent" />
		</div>

		<ul
			use:dndzone={{ items: shuffleDragItems, flipDurationMs, dropTargetStyle: {}, dragHandleSelector: '.drag-handle' }}
			onconsider={handleShuffleDndConsider}
			onfinalize={handleShuffleDndFinalize}
			class="space-y-1"
		>
			{#each shuffleDragItems as track, index (track.id)}
				<li class="group flex items-center gap-2 rounded-lg p-2 hover:bg-surface-overlay">
					<button
						class="drag-handle shrink-0 cursor-grab touch-none text-text-muted opacity-50 transition-opacity hover:text-text-secondary group-hover:opacity-100"
						aria-label="Drag to reorder"
					>
						<Icon name="drag-vertical" size={16} />
					</button>

					<span class="w-5 shrink-0 text-center text-xs text-text-muted">{index + 1}</span>

					{#if track.albumArt}
						<img src={track.albumArt} alt="" class="h-9 w-9 shrink-0 rounded" />
					{:else}
						<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-surface-overlay text-text-muted">
							<Icon name="music" size={14} />
						</div>
					{/if}

					<div class="min-w-0 flex-1">
						<p class="truncate text-sm text-text-primary">{track.title}</p>
						<p class="truncate text-xs text-text-secondary">{track.artist}</p>
					</div>

					<span class="text-xs text-text-muted">{formatDuration(track.durationMs)}</span>
				</li>
			{/each}
		</ul>
	{:else if playerState.queue.length === 0}
		<div class="mb-3 flex items-center justify-between">
			<h3 class="text-xs font-semibold uppercase tracking-wider text-text-muted">
				Up Next
			</h3>
		</div>
		<p class="py-8 text-center text-sm text-text-muted">
			{#if playerState.shuffled}
				No more tracks to shuffle
			{:else}
				Queue is empty — enable shuffle to preview upcoming tracks
			{/if}
		</p>
	{/if}
</div>
