import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractSpotifyTrackId, fetchSpotifyTitle } from '$lib/server/spotify';
import { getVideoMetadata, searchYouTube } from '$lib/server/youtube';

function extractYouTubeVideoId(input: string): string | null {
	try {
		const url = new URL(input);
		if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('?')[0];
		if (url.hostname.includes('youtube.com')) return url.searchParams.get('v');
	} catch {
		// not a URL
	}
	return null;
}

export const GET: RequestHandler = async ({ url }) => {
	const rawUrl = url.searchParams.get('url') ?? url.searchParams.get('text') ?? '';
	if (!rawUrl) throw error(400, 'Missing url parameter');

	const spotifyId = extractSpotifyTrackId(rawUrl);
	if (spotifyId) {
		try {
			const title = await fetchSpotifyTitle(spotifyId);
			const results = await searchYouTube(title, 1);
			if (results.length === 0) throw new Error('No YouTube match found');
			const meta = await getVideoMetadata(results[0].videoId);
			return json({
				type: 'youtube',
				spotifyId,
				videoId: meta.videoId,
				title: meta.title,
				artist: meta.artist,
				albumArt: meta.albumArt,
				durationMs: meta.durationMs
			});
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error('[resolve-url] Spotify→YouTube failed:', msg);
			throw error(502, `Could not resolve track: ${msg}`);
		}
	}

	const videoId = extractYouTubeVideoId(rawUrl);
	if (videoId) {
		const meta = await getVideoMetadata(videoId);
		return json({ type: 'youtube', ...meta });
	}

	throw error(400, 'Unrecognized URL — share a Spotify track or YouTube video');
};
