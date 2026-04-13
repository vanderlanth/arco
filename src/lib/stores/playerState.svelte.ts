import type { Track, RepeatMode } from '$lib/types';

export interface QueueTrack extends Track {
	queueId: string;
}

let counter = 0;
function nextQueueId(): string {
	return `q-${++counter}-${Date.now()}`;
}

function toQueueTrack(track: Track): QueueTrack {
	return { ...track, queueId: nextQueueId() };
}

function fisherYatesShuffle<T>(arr: T[]): T[] {
	const a = [...arr];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

function createPlayerState() {
	let currentTrack = $state<QueueTrack | null>(null);
	let queue = $state<QueueTrack[]>([]);
	let originalQueue = $state<QueueTrack[]>([]);
	let isPlaying = $state(false);
	let shuffled = $state(false);
	let repeat = $state<RepeatMode>('off');
	let audioUrl = $state<string | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let progress = $state(0);
	let duration = $state(0);

	let originalSourceList = $state<Track[]>([]);
	let shuffledSourceList = $state<Track[]>([]);
	let sourceIndex = $state(-1);

	let cachedUpNext: QueueTrack[] = [];
	let cachedUpNextSignature = '';
	let cachedImplicitUpcoming: QueueTrack[] = [];
	let cachedImplicitSig = '';

	function getSourceList(): Track[] {
		return shuffled ? shuffledSourceList : originalSourceList;
	}

	function getStreamUrl(track: Track): string {
		if (track.youtubeId) return `/api/stream?videoId=${track.youtubeId}`;
		if (track.id < 0) return `/api/stream?q=${encodeURIComponent(`${track.artist} - ${track.title}`)}`;
		return `/api/stream?id=${track.id}`;
	}

	function getImplicitNext(count: number): Track[] {
		const list = getSourceList();
		if (list.length === 0 || sourceIndex < 0) return [];
		const results: Track[] = [];
		for (let i = 1; i <= count; i++) {
			const idx = sourceIndex + i;
			if (idx < list.length) {
				results.push(list[idx]);
			} else if (repeat === 'all') {
				results.push(list[idx % list.length]);
			}
		}
		return results;
	}

	function getImplicitPrev(): Track | null {
		const list = getSourceList();
		if (list.length === 0 || sourceIndex < 0) return null;
		if (sourceIndex > 0) return list[sourceIndex - 1];
		if (repeat === 'all') return list[list.length - 1];
		return null;
	}

	function playTrack(track: Track, trackList?: Track[]) {
		error = null;
		const qt = toQueueTrack(track);
		currentTrack = qt;

		if (trackList) {
			originalSourceList = trackList;
			if (shuffled) {
				const rest = trackList.filter((t) => t.id !== track.id);
				shuffledSourceList = [track, ...fisherYatesShuffle(rest)];
				sourceIndex = 0;
			} else {
				shuffledSourceList = [];
				sourceIndex = trackList.findIndex((t) => t.id === track.id);
			}
		}

		loading = true;
		audioUrl = getStreamUrl(track);
		isPlaying = true;
	}

	function playNext(track: Track) {
		const qt = toQueueTrack(track);
		queue = [qt, ...queue];
		if (!shuffled) {
			const idx = originalQueue.findIndex((t) => t.queueId === queue[1]?.queueId);
			originalQueue = [
				...originalQueue.slice(0, Math.max(0, idx)),
				qt,
				...originalQueue.slice(Math.max(0, idx))
			];
		}
	}

	function addToQueue(track: Track) {
		const qt = toQueueTrack(track);
		queue = [...queue, qt];
		originalQueue = [...originalQueue, qt];
	}

	function removeFromQueue(queueId: string) {
		queue = queue.filter((t) => t.queueId !== queueId);
		originalQueue = originalQueue.filter((t) => t.queueId !== queueId);
	}

	function clearQueue() {
		queue = [];
		originalQueue = [];
	}

	function moveInQueue(fromIndex: number, toIndex: number) {
		const items = [...queue];
		const [moved] = items.splice(fromIndex, 1);
		items.splice(toIndex, 0, moved);
		queue = items;
	}

	function reorderQueue(newQueue: QueueTrack[]) {
		queue = newQueue;
	}

	function reorderShuffledList(reorderedIds: number[]) {
		if (!shuffled || shuffledSourceList.length === 0) return;
		const current = shuffledSourceList[sourceIndex];
		const lookup = new Map(shuffledSourceList.map((t) => [t.id, t]));
		const before = shuffledSourceList.slice(0, sourceIndex + 1);
		const reordered = reorderedIds.map((id) => lookup.get(id)!).filter(Boolean);
		const reorderedSet = new Set(reorderedIds);
		const remaining = shuffledSourceList
			.slice(sourceIndex + 1)
			.filter((t) => !reorderedSet.has(t.id));
		shuffledSourceList = [...before, ...reordered, ...remaining];
	}

	function playImplicitTrack(track: Track) {
		const list = getSourceList();
		sourceIndex = list.findIndex((t) => t.id === track.id);
		const qt = toQueueTrack(track);
		currentTrack = qt;
		loading = true;
		audioUrl = getStreamUrl(qt);
		isPlaying = true;
	}

	function skipNext() {
		if (queue.length > 0) {
			const next = queue[0];
			queue = queue.slice(1);
			originalQueue = originalQueue.filter((t) => t.queueId !== next.queueId);
			currentTrack = next;
			loading = true;
			audioUrl = getStreamUrl(next);
			isPlaying = true;
			return;
		}

		const implicit = getImplicitNext(1);
		if (implicit.length > 0) {
			playImplicitTrack(implicit[0]);
			return;
		}

		isPlaying = false;
	}

	function handleTrackEnded() {
		if (repeat === 'one' && currentTrack) {
			loading = true;
			audioUrl = getStreamUrl(currentTrack);
			isPlaying = true;
			return;
		}
		skipNext();
	}

	function skipPrev() {
		if (!currentTrack) return;

		if (progress > 3) {
			progress = 0;
			return;
		}

		const prev = getImplicitPrev();
		if (prev) {
			playImplicitTrack(prev);
		} else {
			progress = 0;
		}
	}

	function toggleShuffle() {
		shuffled = !shuffled;

		if (shuffled) {
			queue = fisherYatesShuffle(queue);

			if (originalSourceList.length > 0 && currentTrack) {
				const current = originalSourceList.find((t) => t.id === currentTrack!.id);
				const rest = originalSourceList.filter((t) => t.id !== currentTrack!.id);
				shuffledSourceList = current
					? [current, ...fisherYatesShuffle(rest)]
					: fisherYatesShuffle(originalSourceList);
				sourceIndex = 0;
			}
		} else {
			queue = originalQueue.filter((t) => queue.some((q) => q.queueId === t.queueId));

			if (originalSourceList.length > 0 && currentTrack) {
				sourceIndex = originalSourceList.findIndex((t) => t.id === currentTrack!.id);
			}
			shuffledSourceList = [];
		}
	}

	function setSourceList(list: Track[], currentIndex: number) {
		originalSourceList = list;
		if (shuffled) {
			const current = list[currentIndex];
			const rest = list.filter((_, i) => i !== currentIndex);
			shuffledSourceList = current
				? [current, ...fisherYatesShuffle(rest)]
				: fisherYatesShuffle(list);
			sourceIndex = 0;
		} else {
			shuffledSourceList = [];
			sourceIndex = currentIndex;
		}
	}

	function cycleRepeat() {
		const modes: RepeatMode[] = ['off', 'all', 'one'];
		const idx = modes.indexOf(repeat);
		repeat = modes[(idx + 1) % modes.length];
	}

	function togglePlay() {
		isPlaying = !isPlaying;
	}

	function setProgress(value: number) {
		progress = value;
	}

	function setDuration(value: number) {
		duration = value;
	}

	function clearError() {
		error = null;
	}

	function setLoading(value: boolean) {
		loading = value;
	}

	function setError(message: string) {
		error = message;
		isPlaying = false;
	}

	return {
		get currentTrack() { return currentTrack; },
		get queue() { return queue; },
		get upNext(): QueueTrack[] {
			const fromQueue = queue.slice(0, 3);
			const need = Math.max(0, 3 - fromQueue.length);
			const implicitTracks = need > 0 ? getImplicitNext(need) : [];
			const sig = [
				...fromQueue.map((t) => t.queueId),
				...implicitTracks.map((t) => String(t.id))
			].join(',');
			if (sig === cachedUpNextSignature) return cachedUpNext;
			cachedUpNextSignature = sig;
			cachedUpNext = [...fromQueue, ...implicitTracks.map(toQueueTrack)];
			return cachedUpNext;
		},
		getImplicitUpcoming(count: number): QueueTrack[] {
			const tracks = getImplicitNext(count);
			const sig = tracks.map((t) => String(t.id)).join(',');
			if (sig === cachedImplicitSig) return cachedImplicitUpcoming;
			cachedImplicitSig = sig;
			cachedImplicitUpcoming = tracks.map(toQueueTrack);
			return cachedImplicitUpcoming;
		},
		get isPlaying() { return isPlaying; },
		set isPlaying(v: boolean) { isPlaying = v; },
		get shuffled() { return shuffled; },
		get repeat() { return repeat; },
		get audioUrl() { return audioUrl; },
		get loading() { return loading; },
		get error() { return error; },
		get progress() { return progress; },
		get duration() { return duration; },
		getStreamUrl,
		playTrack,
		playNext,
		addToQueue,
		removeFromQueue,
		clearQueue,
		moveInQueue,
		reorderQueue,
		reorderShuffledList,
		skipNext,
		skipPrev,
		toggleShuffle,
		cycleRepeat,
		togglePlay,
		setProgress,
		setDuration,
		handleTrackEnded,
		clearError,
		setLoading,
		setError,
		setSourceList
	};
}

export const playerState = createPlayerState();
