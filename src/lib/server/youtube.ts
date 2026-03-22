import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, chmodSync, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

const YT_DLP_DOWNLOAD_URL =
	'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
const TMP_BINARY = '/tmp/yt-dlp';

let resolvedBinary: string | null = null;
let binaryDownloadPromise: Promise<string> | null = null;

async function getBinary(): Promise<string> {
	if (resolvedBinary) return resolvedBinary;

	// On macOS/Windows use the system yt-dlp
	if (process.platform !== 'linux') {
		resolvedBinary = 'yt-dlp';
		return resolvedBinary;
	}

	// Try all known bundled locations on Linux (Vercel Lambda = /var/task)
	const candidates = ['/var/task/bin/yt-dlp', join(process.cwd(), 'bin', 'yt-dlp'), TMP_BINARY];
	for (const p of candidates) {
		if (existsSync(p)) {
			resolvedBinary = p;
			console.log('[yt-dlp] using binary at', p);
			return resolvedBinary;
		}
	}

	// Last resort: download to /tmp (persists for the Lambda container lifetime)
	if (!binaryDownloadPromise) {
		binaryDownloadPromise = (async () => {
			console.log('[yt-dlp] binary not found, downloading to /tmp...');
			const resp = await fetch(YT_DLP_DOWNLOAD_URL, { redirect: 'follow' });
			if (!resp.ok) throw new Error(`Failed to download yt-dlp: HTTP ${resp.status}`);
			await pipeline(resp.body as unknown as NodeJS.ReadableStream, createWriteStream(TMP_BINARY));
			chmodSync(TMP_BINARY, 0o755);
			console.log('[yt-dlp] downloaded successfully');
			return TMP_BINARY;
		})();
	}

	resolvedBinary = await binaryDownloadPromise;
	return resolvedBinary;
}

async function run(args: string[]) {
	const binary = await getBinary();
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
		'--extractor-args', 'youtube:player_client=ios,android',
		'--get-url',
		'--print', '%(ext)s',
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
				title: item.title ?? 'Unknown',
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

function formatDuration(seconds: number | null | undefined): string {
	if (!seconds) return '';
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, '0')}`;
}
