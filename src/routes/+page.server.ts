import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { playlists, playlistTracks } from '$lib/server/db/schema';
import { desc, eq, sql } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const allPlaylists = await db
		.select({
			id: playlists.id,
			name: playlists.name,
			slug: playlists.slug,
			trackCount: sql<number>`(SELECT count(*) FROM playlist_tracks WHERE playlist_id = ${playlists.id})`.as('track_count'),
			createdAt: playlists.createdAt
		})
		.from(playlists)
		.orderBy(desc(playlists.createdAt));
	return { playlists: allPlaylists };
};
