import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const playlists = sqliteTable('playlists', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(),
	trackCount: integer('track_count').notNull().default(0),
	createdAt: text('created_at').notNull()
});

export const tracks = sqliteTable(
	'tracks',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		spotifyId: text('spotify_id'),
		title: text('title').notNull(),
		artist: text('artist').notNull(),
		album: text('album'),
		albumArt: text('album_art'),
		durationMs: integer('duration_ms'),
		addedAt: text('added_at'),
		youtubeId: text('youtube_id'),
		playlistId: integer('playlist_id').references(() => playlists.id)
	},
	(table) => [uniqueIndex('spotify_playlist_uniq').on(table.spotifyId, table.playlistId)]
);

export const playlistTracks = sqliteTable(
	'playlist_tracks',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		playlistId: integer('playlist_id')
			.notNull()
			.references(() => playlists.id, { onDelete: 'cascade' }),
		trackId: integer('track_id')
			.notNull()
			.references(() => tracks.id, { onDelete: 'cascade' }),
		addedAt: text('added_at')
	},
	(table) => [uniqueIndex('playlist_track_uniq').on(table.playlistId, table.trackId)]
);
