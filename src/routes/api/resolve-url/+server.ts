import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractSpotifyTrackId, fetchSpotifyMetadata } from '$lib/server/spotify';
import { getVideoMetadata } from '$lib/server/youtube';

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
		const meta = await fetchSpotifyMetadata(spotifyId);
		return json({ type: 'spotify', ...meta });
	}

	const videoId = extractYouTubeVideoId(rawUrl);
	if (videoId) {
		const meta = await getVideoMetadata(videoId);
		return json({ type: 'youtube', ...meta });
	}

	throw error(400, 'Unrecognized URL — share a Spotify track or YouTube video');
};
