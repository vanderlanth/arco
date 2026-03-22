const INVIDIOUS_INSTANCES = [
	'https://inv.riverside.rocks',
	'https://yt.artemislena.eu',
	'https://invidious.nerdvpn.de',
	'https://invidious.privacydev.net',
	'https://iv.ggtyler.dev'
];

async function invidiousFetch(path: string): Promise<Response> {
	for (const base of INVIDIOUS_INSTANCES) {
		try {
			const res = await fetch(`${base}${path}`, {
				headers: { 'User-Agent': 'Mozilla/5.0' }
			});
			if (res.ok) return res;
		} catch {
			// try next instance
		}
	}
	throw new Error('All Invidious instances failed');
}

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
	const res = await invidiousFetch(`/api/v1/videos/${videoId}?fields=adaptiveFormats`);
	const data = await res.json();

	const formats: { url: string; type: string; bitrate: number; audioQuality?: string }[] =
		(data.adaptiveFormats ?? []).filter(
			(f: { type: string }) => f.type?.startsWith('audio/')
		);

	if (!formats.length) throw new Error('No audio formats returned by Invidious');

	const best = formats.sort((a, b) => b.bitrate - a.bitrate)[0];
	const mimeType = best.type.split(';')[0].trim();

	const info: AudioStreamInfo = { url: best.url, mimeType };
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
	const res = await invidiousFetch(
		`/api/v1/search?q=${encodeURIComponent(query)}&type=video&fields=videoId,title,author,videoThumbnails,lengthSeconds`
	);
	const items: {
		videoId: string;
		title: string;
		author: string;
		videoThumbnails: { url: string; quality: string }[];
		lengthSeconds: number;
	}[] = await res.json();

	return items.slice(0, limit).map((item) => ({
		videoId: item.videoId,
		title: item.title ?? 'Unknown',
		artist: item.author ?? 'Unknown',
		thumbnail: item.videoThumbnails?.find((t) => t.quality === 'medium')?.url ?? item.videoThumbnails?.[0]?.url ?? '',
		duration: formatDuration(item.lengthSeconds)
	}));
}

function formatDuration(seconds: number | null | undefined): string {
	if (!seconds) return '';
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, '0')}`;
}
