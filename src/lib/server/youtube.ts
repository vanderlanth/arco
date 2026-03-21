import ytdl from '@distube/ytdl-core';
import ytsr from 'ytsr';

export interface AudioStreamInfo {
	url: string;
	mimeType: string;
}

const MIME_MAP: Record<string, string> = {
	webm: 'audio/webm',
	m4a: 'audio/mp4',
	opus: 'audio/ogg',
	ogg: 'audio/ogg',
	mp3: 'audio/mpeg'
};

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
	const infoResult = await ytdl.getInfo(videoId);
	const format = ytdl.chooseFormat(infoResult.formats, {
		quality: 'highestaudio',
		filter: 'audioonly'
	});

	const ext = format.container ?? 'webm';
	const mimeType = MIME_MAP[ext] ?? 'audio/webm';
	const info: AudioStreamInfo = { url: format.url, mimeType };

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

export async function searchYouTube(
	query: string,
	limit = 5
): Promise<YouTubeSearchResult[]> {
	const searchResults = await ytsr(query, { limit });

	const results: YouTubeSearchResult[] = [];
	for (const item of searchResults.items) {
		if (item.type !== 'video') continue;
		results.push({
			videoId: item.id,
			title: item.title ?? 'Unknown',
			artist: item.author?.name ?? 'Unknown',
			thumbnail: item.bestThumbnail?.url ?? '',
			duration: item.duration ?? ''
		});
		if (results.length >= limit) break;
	}
	return results;
}
