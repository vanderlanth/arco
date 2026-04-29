import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

// On Infomaniak shared hosting yt-dlp is installed at ~/yt-dlp
const BINARY_CANDIDATES = [
	join(process.env.HOME ?? '', 'yt-dlp'),
	'/usr/local/bin/yt-dlp',
	'yt-dlp'
];

export function getBinary(): string {
	for (const p of BINARY_CANDIDATES) {
		if (existsSync(p)) return p;
	}
	return 'yt-dlp'; // fallback, let it fail with a clear error
}

async function run(args: string[]) {
	const binary = getBinary();
	return execFileAsync(binary, args);
}

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
	const { stdout } = await run([
		'--no-warnings',
		'--no-playlist',
		'-f', 'bestaudio/best',
		'--get-url',
		'--print', '%(ext)s',
		'--extractor-args', 'youtube:player_client=android,tv_embedded',
		`https://www.youtube.com/watch?v=${videoId}`
	]);

	const lines = stdout.trim().split('\n');
	const ext = lines[0]?.trim() ?? 'webm';
	const url = lines[1]?.trim();

	if (!url) throw new Error('yt-dlp returned no audio URL');

	const info: AudioStreamInfo = {
		url,
		mimeType: MIME_MAP[ext] ?? 'audio/webm'
	};
	audioUrlCache.set(videoId, { info, expiresAt: Date.now() + CACHE_TTL });

	if (audioUrlCache.size > 200) {
		const now = Date.now();
		for (const [key, val] of audioUrlCache) {
			if (val.expiresAt < now) audioUrlCache.delete(key);
		}
	}

	return info;
}

export interface VideoMetadata {
	videoId: string;
	title: string;
	artist: string;
	albumArt: string;
	durationMs: number | null;
}

export async function getVideoMetadata(videoId: string): Promise<VideoMetadata> {
	const { stdout } = await run([
		'--no-warnings',
		'--no-playlist',
		'--dump-json',
		'--extractor-args', 'youtube:player_client=tv_embedded',
		`https://www.youtube.com/watch?v=${videoId}`
	]);
	const item = JSON.parse(stdout.trim());

	let title = item.track ?? '';
	let artist = item.artist ?? item.creator ?? '';

	if (!title || !artist) {
		const raw: string = item.title ?? '';
		const sep = raw.indexOf(' - ');
		if (sep > 0) {
			artist = artist || raw.slice(0, sep).trim();
			title = title || cleanTitle(raw.slice(sep + 3));
		} else {
			title = title || cleanTitle(raw) || 'Unknown';
			artist = artist || (item.channel ?? item.uploader ?? 'Unknown');
		}
	} else {
		title = cleanTitle(title);
	}

	return {
		videoId,
		title,
		artist: artist.replace(/\s*;\s*/g, ', '),
		albumArt: item.thumbnail ?? item.thumbnails?.[0]?.url ?? '',
		durationMs: item.duration ? Math.round(item.duration * 1000) : null
	};
}

export interface YouTubeSearchResult {
	videoId: string;
	title: string;
	artist: string;
	thumbnail: string;
	duration: string;
}

export async function searchYouTube(query: string, limit = 5): Promise<YouTubeSearchResult[]> {
	const { stdout } = await run([
		'--no-warnings',
		'--flat-playlist',
		'--dump-json',
		`ytsearch${limit}:${query}`
	]);

	const results: YouTubeSearchResult[] = [];
	for (const line of stdout.trim().split('\n')) {
		if (!line) continue;
		try {
			const item = JSON.parse(line);
			results.push({
				videoId: item.id,
				title: cleanTitle(item.title ?? '') || 'Unknown',
				artist: item.channel ?? item.uploader ?? 'Unknown',
				thumbnail: item.thumbnails?.[0]?.url ?? '',
				duration: formatDuration(item.duration)
			});
		} catch {
			continue;
		}
	}
	return results;
}

const VIDEO_NOISE = /\s*[\(\[](?:\s*(?:official|music|video|audio|lyrics?|visuali[sz]er|clip|officiel|hd|hq|4k|remaster(?:ed)?(?:\s+\d{4})?)[\s,]*)+[\)\]]/gi;

function cleanTitle(raw: string): string {
	return raw.replace(VIDEO_NOISE, '').replace(/\s{2,}/g, ' ').trim();
}

function formatDuration(seconds: number | null | undefined): string {
	if (!seconds) return '';
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, '0')}`;
}
