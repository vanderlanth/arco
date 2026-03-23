import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { tracks, playlistTracks } from '$lib/server/db/schema';
import { isNotNull, like, sql } from 'drizzle-orm';

export const GET: RequestHandler = async () => {
	const rows = await db
		.select({ id: tracks.id, playlistId: tracks.playlistId })
		.from(tracks)
		.where(isNotNull(tracks.playlistId));

	const now = new Date().toISOString();
	const values = rows
		.filter((r) => r.playlistId != null)
		.map((r) => ({
			playlistId: r.playlistId!,
			trackId: r.id,
			addedAt: now
		}));

	let migrated = 0;
	const BATCH = 50;
	for (let i = 0; i < values.length; i += BATCH) {
		const batch = values.slice(i, i + BATCH);
		try {
			const result = await db.insert(playlistTracks).values(batch).onConflictDoNothing();
			migrated += result.rowsAffected;
		} catch {
			// batch may partially conflict
		}
	}

	const artistFix = await db
		.update(tracks)
		.set({ artist: sql`replace(${tracks.artist}, ';', ', ')` })
		.where(like(tracks.artist, '%;%'));

	return json({ migrated, total: values.length, artistsFixed: artistFix.rowsAffected });
};
