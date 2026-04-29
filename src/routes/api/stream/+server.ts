import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Config } from '@sveltejs/adapter-vercel';
import { getAudioUrl, searchYouTube } from '$lib/server/youtube';
import { db } from '$lib/server/db';
import { tracks } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const config: Config = {
	maxDuration: 60
};

export const GET: RequestHandler = async ({ url }) => {
	const videoIdParam = url.searchParams.get('videoId');
	const trackId = url.searchParams.get('id');
	const searchQuery = url.searchParams.get('q');

	let videoId = videoIdParam;

	if (!videoId && searchQuery) {
		const results = await searchYouTube(searchQuery, 1);
		if (results.length === 0) throw error(404, 'No YouTube match found');
		videoId = results[0].videoId;
	}

	if (!videoId && trackId) {
		const track = await db.query.tracks.findFirst({
			where: eq(tracks.id, Number(trackId))
		});
		if (!track) throw error(404, 'Track not found');

		videoId = track.youtubeId;

		if (!videoId) {
			const query = `${track.artist} - ${track.title}`;
			const results = await searchYouTube(query, 1);
			if (results.length === 0) throw error(404, 'No YouTube match found');
			videoId = results[0].videoId;
			await db.update(tracks).set({ youtubeId: videoId }).where(eq(tracks.id, track.id));
		}
	}

	if (!videoId) throw error(400, 'Missing videoId or id');

	let audio;
	try {
		audio = await getAudioUrl(videoId);
	} catch (e) {
		const err = e as { message?: string; stderr?: string };
		const detail = err.stderr?.trim() || err.message || String(e);
		console.error('[stream] getAudioUrl failed:', detail);
		throw error(502, `yt-dlp error: ${detail}`);
	}

	// Proxy audio through our server — avoids CORS issues with Google Video URLs,
	// which have no CORS headers and would block the browser's preload fetch().
	// Same-origin proxy enables blob preloading, which is required for background playback.
	const range = request.headers.get('Range');
	const upstreamHeaders: Record<string, string> = {
		'User-Agent': 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
	};
	if (range) upstreamHeaders['Range'] = range;

	let upstream: globalThis.Response;
	try {
		upstream = await fetch(audio.url, { headers: upstreamHeaders });
	} catch {
		throw error(502, 'Failed to fetch audio from upstream');
	}

	if (!upstream.ok) {
		throw error(502, `Upstream error: ${upstream.status}`);
	}

	const headers = new Headers();
	headers.set('Content-Type', audio.mimeType);
	headers.set('Accept-Ranges', 'bytes');
	headers.set('Cache-Control', 'no-store');

	const contentLength = upstream.headers.get('Content-Length');
	if (contentLength) headers.set('Content-Length', contentLength);

	const contentRange = upstream.headers.get('Content-Range');
	if (contentRange) headers.set('Content-Range', contentRange);

	return new Response(upstream.body, {
		status: upstream.status,
		headers
	});
};
