import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { radios, radioTracks } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getSimilarTracks } from '$lib/server/lastfm';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { artist, track, albumArt } = body as {
		artist?: string;
		track?: string;
		albumArt?: string;
	};

	if (!artist || !track) throw error(400, 'Missing artist or track');

	// Last.fm needs a single primary artist — take the first if comma-separated
	const primaryArtist = artist.split(',')[0].trim();

	let similar = await getSimilarTracks(primaryArtist, track);

	// If no results, try stripping parenthetical suffixes from the track name
	// e.g. "Song Name (feat. Someone)" or "Song - Remastered 2024"
	if (similar.length === 0) {
		const cleanTrack = track.replace(/\s*[\(\[].*?[\)\]]$/g, '').replace(/\s*-\s*(Remaster|Live|Remix|Deluxe|Bonus|feat\.).*$/i, '').trim();
		if (cleanTrack !== track) {
			similar = await getSimilarTracks(primaryArtist, cleanTrack);
		}
	}

	if (similar.length === 0) {
		throw error(404, `No similar tracks found for "${primaryArtist} — ${track}"`);
	}

	const [radio] = await db
		.insert(radios)
		.values({
			seedTitle: track,
			seedArtist: artist,
			seedAlbumArt: albumArt ?? null,
			createdAt: new Date().toISOString()
		})
		.returning();

	await db.insert(radioTracks).values(
		similar.map((t, i) => ({
			radioId: radio.id,
			title: t.title,
			artist: t.artist,
			position: i
		}))
	);

	return json({ id: radio.id });
};

export const DELETE: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id');
	if (!id) throw error(400, 'Missing radio id');

	const numId = Number(id);
	await db.delete(radioTracks).where(eq(radioTracks.radioId, numId));
	const deleted = await db.delete(radios).where(eq(radios.id, numId)).returning();

	if (!deleted.length) throw error(404, 'Radio not found');
	return json({ ok: true });
};

export const GET: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id');
	if (!id) throw error(400, 'Missing radio id');

	const [radio] = await db
		.select()
		.from(radios)
		.where(eq(radios.id, Number(id)))
		.limit(1);

	if (!radio) throw error(404, 'Radio not found');

	const tracks = await db
		.select()
		.from(radioTracks)
		.where(eq(radioTracks.radioId, radio.id))
		.orderBy(radioTracks.position);

	return json({ radio, tracks });
};
