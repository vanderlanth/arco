import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { tracks, playlists } from '$lib/server/db/schema';
import { like, or, eq } from 'drizzle-orm';
import { searchTracks, searchArtists, searchAlbums } from '$lib/server/lastfm';

const LIMIT = 20;

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q');
	if (!q || !q.trim()) throw error(400, 'Missing query');

	const query = q.trim();
	const pattern = `%${query}%`;

	const [playlistTracks, lastfmTracks, artists, albums] = await Promise.allSettled([
		db
			.select({
				id: tracks.id,
				title: tracks.title,
				artist: tracks.artist,
				album: tracks.album,
				albumArt: tracks.albumArt,
				playlistId: playlists.id,
				playlistName: playlists.name,
				playlistSlug: playlists.slug
			})
			.from(tracks)
			.innerJoin(playlists, eq(tracks.playlistId, playlists.id))
			.where(or(like(tracks.title, pattern), like(tracks.artist, pattern)))
			.limit(LIMIT),

		searchTracks(query, LIMIT),
		searchArtists(query, LIMIT),
		searchAlbums(query, LIMIT)
	]);

	return json({
		playlistTracks: playlistTracks.status === 'fulfilled' ? playlistTracks.value : [],
		lastfmTracks: lastfmTracks.status === 'fulfilled' ? lastfmTracks.value : [],
		artists: artists.status === 'fulfilled' ? artists.value : [],
		albums: albums.status === 'fulfilled' ? albums.value : []
	});
};
