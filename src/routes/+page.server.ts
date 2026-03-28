import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { playlists, playlistTracks, radios, radioTracks } from '$lib/server/db/schema';
import { desc, eq, sql } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const allPlaylists = await db
		.select({
			id: playlists.id,
			name: playlists.name,
			slug: playlists.slug,
			emoji: playlists.emoji,
			trackCount: sql<number>`count(${playlistTracks.id})`,
			createdAt: playlists.createdAt
		})
		.from(playlists)
		.leftJoin(playlistTracks, eq(playlistTracks.playlistId, playlists.id))
		.groupBy(playlists.id)
		.orderBy(desc(playlists.createdAt));

	const recentRadios = await db
		.select({
			id: radios.id,
			seedTitle: radios.seedTitle,
			seedArtist: radios.seedArtist,
			seedAlbumArt: radios.seedAlbumArt,
			createdAt: radios.createdAt,
			trackCount: sql<number>`count(${radioTracks.id})`
		})
		.from(radios)
		.leftJoin(radioTracks, eq(radioTracks.radioId, radios.id))
		.groupBy(radios.id)
		.orderBy(desc(radios.createdAt))
		.limit(5);

	return { playlists: allPlaylists, recentRadios };
};
