import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAudioUrl, searchYouTube } from '$lib/server/youtube';
import { db } from '$lib/server/db';
import { tracks } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	const videoIdParam = url.searchParams.get('videoId');
	const trackId = url.searchParams.get('id');

	let videoId = videoIdParam;

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
		console.error('[stream] getAudioUrl failed:', e);
		throw error(502, `Audio resolution failed: ${(e as Error).message}`);
	}

	return new Response(null, {
		status: 302,
		headers: {
			Location: audio.url,
			'Cache-Control': 'no-store'
		}
	});
};
