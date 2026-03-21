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

	const audio = await getAudioUrl(videoId);

	const upstream = await fetch(audio.url, {
		headers: { 'User-Agent': 'Mozilla/5.0' }
	});

	if (!upstream.ok || !upstream.body) {
		throw error(502, 'Failed to fetch audio stream');
	}

	const headers: Record<string, string> = {
		'Content-Type': audio.mimeType,
		'Cache-Control': 'no-store',
		'Accept-Ranges': 'none'
	};

	const cl = upstream.headers.get('content-length');
	if (cl) headers['Content-Length'] = cl;

	return new Response(upstream.body, { status: 200, headers });
};
