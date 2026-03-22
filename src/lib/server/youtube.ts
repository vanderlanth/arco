// YouTube InnerTube API — same internal API yt-dlp uses, Android client
// returns directly playable URLs without signature decryption.
const INNERTUBE_URL = 'https://www.youtube.com/youtubei/v1';
const ANDROID_KEY = 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w';

const ANDROID_CONTEXT = {
	client: {
		clientName: 'ANDROID',
		clientVersion: '19.09.37',
		androidSdkVersion: 30,
		hl: 'en',
		gl: 'US'
	}
};

async function innertubePost(endpoint: string, body: object): Promise<Response> {
	return fetch(`${INNERTUBE_URL}/${endpoint}?key=${ANDROID_KEY}&prettyPrint=false`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip'
		},
		body: JSON.stringify({ context: ANDROID_CONTEXT, ...body })
	});
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
	const res = await innertubePost('player', { videoId });
	if (!res.ok) throw new Error(`InnerTube player error: ${res.status}`);

	const data = await res.json();

	if (data.playabilityStatus?.status !== 'OK') {
		throw new Error(`Video not playable: ${data.playabilityStatus?.reason ?? 'unknown'}`);
	}

	const formats: { url?: string; mimeType: string; bitrate: number }[] = (
		data.streamingData?.adaptiveFormats ?? []
	).filter((f: { mimeType: string; url?: string }) => f.mimeType?.startsWith('audio/') && f.url);

	if (!formats.length) throw new Error('No audio streams found');

	const best = formats.sort((a, b) => b.bitrate - a.bitrate)[0];
	const mimeType = best.mimeType.split(';')[0].trim();

	const info: AudioStreamInfo = { url: best.url!, mimeType };
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
	const res = await innertubePost('search', { query, params: 'EgIQAQ%3D%3D' }); // filter: video only
	if (!res.ok) throw new Error(`InnerTube search error: ${res.status}`);

	const data = await res.json();

	const contents =
		data.contents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents ?? [];

	const results: YouTubeSearchResult[] = [];
	for (const item of contents) {
		const v = item.videoRenderer;
		if (!v) continue;

		results.push({
			videoId: v.videoId,
			title: v.title?.runs?.[0]?.text ?? 'Unknown',
			artist: v.ownerText?.runs?.[0]?.text ?? 'Unknown',
			thumbnail: v.thumbnail?.thumbnails?.at(-1)?.url ?? '',
			duration: v.lengthText?.simpleText ?? ''
		});

		if (results.length >= limit) break;
	}

	return results;
}
