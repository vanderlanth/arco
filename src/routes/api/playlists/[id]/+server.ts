import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { playlists, playlistTracks } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const DELETE: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (!id) throw error(400, 'Invalid playlist id');

	await db.delete(playlistTracks).where(eq(playlistTracks.playlistId, id));
	const deleted = await db.delete(playlists).where(eq(playlists.id, id)).returning();

	if (!deleted.length) throw error(404, 'Playlist not found');
	return json({ ok: true });
};
