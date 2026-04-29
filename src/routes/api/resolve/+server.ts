import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { tracks } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getAudioUrl, searchYouTube } from '$lib/server/youtube';

export const GET: RequestHandler = async ({ url }) => {
	const trackId = url.searchParams.get('id');
	const videoIdParam = url.searchParams.get('videoId');
	const searchQuery = url.searchParams.get('q');

	// Direct YouTube video ID (for YouTube search results)
	if (videoIdParam) {
		const audio = await getAudioUrl(videoIdParam);
		return json({ audioUrl: audio.url, mimeType: audio.mimeType, videoId: videoIdParam });
	}

	// Text search — return just the video ID without fetching audio URL
	if (searchQuery) {
		const results = await searchYouTube(searchQuery, 1);
		if (results.length === 0) throw error(404, 'No YouTube match found');
		return json({ videoId: results[0].videoId });
	}

	if (!trackId) throw error(400, 'Missing track id, videoId, or q');

	const track = await db.query.tracks.findFirst({
		where: eq(tracks.id, Number(trackId))
	});

	if (!track) throw error(404, 'Track not found');

	let videoId = track.youtubeId;

	if (!videoId) {
		const query = `${track.artist} - ${track.title}`;
		const results = await searchYouTube(query, 1);

		if (results.length === 0) {
			throw error(404, 'No YouTube match found');
		}

		videoId = results[0].videoId;

		await db
			.update(tracks)
			.set({ youtubeId: videoId })
			.where(eq(tracks.id, track.id));
	}

	const audio = await getAudioUrl(videoId);

	return json({
		audioUrl: audio.url,
		mimeType: audio.mimeType,
		videoId,
		track: {
			id: track.id,
			title: track.title,
			artist: track.artist,
			album: track.album,
			albumArt: track.albumArt,
			durationMs: track.durationMs
		}
	});
};
