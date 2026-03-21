import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { playlistTracks, playlists } from '$lib/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export const DELETE: RequestHandler = async ({ params }) => {
	const playlistId = Number(params.id);
	const trackId = Number(params.trackId);
	if (!playlistId || !trackId) throw error(400, 'Invalid ids');

	const deleted = await db
		.delete(playlistTracks)
		.where(and(eq(playlistTracks.playlistId, playlistId), eq(playlistTracks.trackId, trackId)))
		.returning();

	if (!deleted.length) throw error(404, 'Track not in playlist');

	await db
		.update(playlists)
		.set({ trackCount: sql`(SELECT count(*) FROM playlist_tracks WHERE playlist_id = ${playlistId})` })
		.where(eq(playlists.id, playlistId));

	return json({ ok: true });
};
