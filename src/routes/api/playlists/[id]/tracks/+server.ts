import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { playlistTracks, playlists } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';

export const POST: RequestHandler = async ({ params, request }) => {
	const playlistId = Number(params.id);
	if (!playlistId) throw error(400, 'Invalid playlist id');

	const body = await request.json();
	const trackId = Number(body.trackId);
	if (!trackId) throw error(400, 'trackId is required');

	try {
		await db.insert(playlistTracks).values({
			playlistId,
			trackId,
			addedAt: new Date().toISOString()
		});
	} catch {
		throw error(409, 'Track already in playlist');
	}

	await db
		.update(playlists)
		.set({ trackCount: sql`(SELECT count(*) FROM playlist_tracks WHERE playlist_id = ${playlistId})` })
		.where(eq(playlists.id, playlistId));

	return json({ ok: true }, { status: 201 });
};
