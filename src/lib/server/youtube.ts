const PIPED_API = 'https://pipedapi.kavin.rocks';

export interface AudioStreamInfo {
	url: string;
	mimeType: string;
}

const audioUrlCache = new Map<string, { info: AudioStreamInfo; expiresAt: number }>();
const audioUrlPending = new Map<string, Promise<AudioStreamInfo>>();
const CACHE_TTL = 3 * 60 * 60 * 1000;

export async function getAudioUrl(videoId: string): Promise<AudioStreamInfo> {
	const cached = audioUrlCache.get(videoId);
	if (cached && cached.expiresAt > Date.now()) return cached.info;

	const pending = audioUrlPending.get(videoId);
	if (pending) return pending;

	const promise = resolveAudioUrl(videoId);
	audioUrlPending.set(videoId, promise);
	try {
		return await promise;
	} finally {
		audioUrlPending.delete(videoId);
	}
}

async function resolveAudioUrl(videoId: string): Promise<AudioStreamInfo> {
	const res = await fetch(`${PIPED_API}/streams/${videoId}`);
	if (!res.ok) throw new Error(`Piped API error: ${res.status}`);

	const data = await res.json();

	const streams: { url: string; mimeType: string; bitrate: number }[] = data.audioStreams ?? [];
	if (!streams.length) throw new Error('No audio streams returned by Piped');

	// Pick highest bitrate stream
	const best = streams.sort((a, b) => b.bitrate - a.bitrate)[0];

	const info: AudioStreamInfo = { url: best.url, mimeType: best.mimeType };
	audioUrlCache.set(videoId, { info, expiresAt: Date.now() + CACHE_TTL });

	if (audioUrlCache.size > 200) {
		const now = Date.now();
		for (const [key, val] of audioUrlCache) {
			if (val.expiresAt < now) audioUrlCache.delete(key);
		}
	}

	return info;
}

export interface YouTubeSearchResult {
	videoId: string;
	title: string;
	artist: string;
	thumbnail: string;
	duration: string;
}

export async function searchYouTube(query: string, limit = 5): Promise<YouTubeSearchResult[]> {
	const url = `${PIPED_API}/search?q=${encodeURIComponent(query)}&filter=all`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Piped search error: ${res.status}`);

	const data = await res.json();
	const items: {
		url: string;
		title: string;
		uploaderName: string;
		thumbnail: string;
		duration: number;
		type: string;
	}[] = data.items ?? [];

	return items
		.filter((item) => item.type === 'stream')
		.slice(0, limit)
		.map((item) => ({
			videoId: item.url.replace('/watch?v=', ''),
			title: item.title ?? 'Unknown',
			artist: item.uploaderName ?? 'Unknown',
			thumbnail: item.thumbnail ?? '',
			duration: formatDuration(item.duration)
		}));
}

function formatDuration(seconds: number | null | undefined): string {
	if (!seconds) return '';
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, '0')}`;
}
