import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { playlists, tracks, playlistTracks } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
	const [playlist] = await db
		.select()
		.from(playlists)
		.where(eq(playlists.slug, params.slug))
		.limit(1);

	if (!playlist) throw error(404, 'Playlist not found');

	const rows = await db
		.select({ track: tracks })
		.from(playlistTracks)
		.innerJoin(tracks, eq(playlistTracks.trackId, tracks.id))
		.where(eq(playlistTracks.playlistId, playlist.id))
		.orderBy(desc(playlistTracks.addedAt));

	return { playlist, tracks: rows.map((r) => r.track) };
};
