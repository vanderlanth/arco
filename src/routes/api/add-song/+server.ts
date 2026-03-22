import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { tracks, playlists, playlistTracks } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { title, artist, albumArt, spotifyId, youtubeId, durationMs, playlistIds } = body;

	if (!title || !artist) throw error(400, 'title and artist are required');
	if (!Array.isArray(playlistIds) || playlistIds.length === 0)
		throw error(400, 'playlistIds is required');

	const now = new Date().toISOString();

	// Reuse existing track record if possible
	let track;
	if (spotifyId) {
		const [existing] = await db
			.select()
			.from(tracks)
			.where(eq(tracks.spotifyId, spotifyId))
			.limit(1);
		if (existing) track = existing;
	} else if (youtubeId) {
		const [existing] = await db
			.select()
			.from(tracks)
			.where(eq(tracks.youtubeId, youtubeId))
			.limit(1);
		if (existing) track = existing;
	}

	if (!track) {
		[track] = await db
			.insert(tracks)
			.values({ title, artist, albumArt, spotifyId, youtubeId, durationMs, addedAt: now })
			.returning();
	}

	for (const playlistId of playlistIds) {
		try {
			await db.insert(playlistTracks).values({ playlistId, trackId: track.id, addedAt: now });
		} catch {
			// already in playlist — skip
		}
		await db
			.update(playlists)
			.set({
				trackCount: sql`(SELECT count(*) FROM playlist_tracks WHERE playlist_id = ${playlistId})`
			})
			.where(eq(playlists.id, playlistId));
	}

	return json({ track }, { status: 201 });
};
