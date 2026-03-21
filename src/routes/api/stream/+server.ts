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
		const err = e as { message?: string; stderr?: string };
		const detail = err.stderr?.trim() || err.message || String(e);
		console.error('[stream] getAudioUrl failed:', detail);
		throw error(502, `yt-dlp error: ${detail}`);
	}

	return new Response(null, {
		status: 302,
		headers: {
			Location: audio.url,
			'Cache-Control': 'no-store'
		}
	});
};
