import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { tracks, playlists, playlistTracks } from '$lib/server/db/schema';
import { sql, eq } from 'drizzle-orm';
import { verifyCsrf } from '$lib/csrf';

export const load: PageServerLoad = async () => {
	const result = await db.select({ count: sql<number>`count(*)` }).from(tracks);
	return { trackCount: result[0]?.count ?? 0 };
};

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		|| 'playlist';
}

async function uniqueSlug(base: string): Promise<string> {
	let slug = base;
	let suffix = 0;
	while (true) {
		const existing = await db
			.select({ id: playlists.id })
			.from(playlists)
			.where(eq(playlists.slug, slug))
			.limit(1);
		if (existing.length === 0) return slug;
		suffix++;
		slug = `${base}-${suffix}`;
	}
}

interface SpotifyExportTrack {
	artist: string;
	album: string;
	track: string;
	uri: string;
}

interface SpotifyExportData {
	tracks: SpotifyExportTrack[];
}

type TrackInsert = {
	spotifyId: string | null;
	title: string;
	artist: string;
	album: string | null;
	albumArt: string | null;
	durationMs: number | null;
	addedAt: string | null;
};

function parseCsvRow(line: string): string[] {
	const fields: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuotes) {
			if (ch === '"' && line[i + 1] === '"') {
				current += '"';
				i++;
			} else if (ch === '"') {
				inQuotes = false;
			} else {
				current += ch;
			}
		} else if (ch === '"') {
			inQuotes = true;
		} else if (ch === ',') {
			fields.push(current);
			current = '';
		} else {
			current += ch;
		}
	}
	fields.push(current);
	return fields;
}

function parseExportifyCsv(raw: string): TrackInsert[] {
	const lines = raw.split(/\r?\n/).filter((l) => l.trim());
	if (lines.length < 2) return [];

	const headers = parseCsvRow(lines[0]).map((h) => h.trim().toLowerCase());

	const col = (name: string) => headers.indexOf(name);
	const iUri = col('track uri');
	const iName = col('track name');
	const iAlbum = col('album name');
	const iArtist = col('artist name(s)');
	const iDuration = col('duration (ms)');
	const iAddedAt = col('added at');

	if (iName === -1 || iArtist === -1) return [];

	const results: TrackInsert[] = [];
	for (let i = 1; i < lines.length; i++) {
		const row = parseCsvRow(lines[i]);
		const title = row[iName]?.trim();
		const artist = row[iArtist]?.trim();
		if (!title || !artist) continue;

		const uri = iUri !== -1 ? row[iUri]?.trim() : '';
		const spotifyId = uri?.startsWith('spotify:track:')
			? uri.replace('spotify:track:', '')
			: null;

		const durationRaw = iDuration !== -1 ? parseInt(row[iDuration], 10) : NaN;

		results.push({
			spotifyId,
			title,
			artist,
			album: (iAlbum !== -1 ? row[iAlbum]?.trim() : null) || null,
			albumArt: null,
			durationMs: Number.isNaN(durationRaw) ? null : durationRaw,
			addedAt: (iAddedAt !== -1 ? row[iAddedAt]?.trim() : null) || null
		});
	}
	return results;
}

function parseSpotifyJson(raw: string): TrackInsert[] {
	let parsed: SpotifyExportData;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return [];
	}

	if (!parsed.tracks || !Array.isArray(parsed.tracks)) return [];

	return parsed.tracks
		.filter((t) => t.track && t.artist)
		.map((t) => {
			const spotifyId = t.uri?.startsWith('spotify:track:')
				? t.uri.replace('spotify:track:', '')
				: null;

			return {
				spotifyId,
				title: t.track,
				artist: t.artist,
				album: t.album || null,
				albumArt: null,
				durationMs: null,
				addedAt: null
			};
		});
}

export const actions: Actions = {
	upload: async ({ request, cookies }) => {
		const formData = await request.formData();

		if (!verifyCsrf(formData.get('csrf_token'), cookies.get('csrf'))) {
			return fail(403, { error: 'Invalid request.' });
		}

		const fileContent = formData.get('tracks_json')?.toString();
		const fileFormat = formData.get('file_format')?.toString();
		const playlistName = formData.get('playlist_name')?.toString()?.trim() || 'Untitled Playlist';

		if (!fileContent) {
			return fail(400, { error: 'No data received.' });
		}

		let songsToInsert: TrackInsert[];

		if (fileFormat === 'csv') {
			songsToInsert = parseExportifyCsv(fileContent);
			if (songsToInsert.length === 0) {
				return fail(400, {
					error: 'Could not parse the CSV. Make sure it\'s an Exportify export with "Track Name" and "Artist Name(s)" columns.'
				});
			}
		} else {
			songsToInsert = parseSpotifyJson(fileContent);
			if (songsToInsert.length === 0) {
				return fail(400, {
					error: 'No valid tracks found. Make sure it\'s the YourLibrary.json from your Spotify data export.'
				});
			}
		}

		const slug = await uniqueSlug(slugify(playlistName));
		const now = new Date().toISOString();

		const [playlist] = await db
			.insert(playlists)
			.values({ name: playlistName, slug, trackCount: 0, createdAt: now })
			.returning({ id: playlists.id });

		const playlistId = playlist.id;

		const BATCH_SIZE = 50;
		let inserted = 0;
		for (let i = 0; i < songsToInsert.length; i += BATCH_SIZE) {
			const batch = songsToInsert.slice(i, i + BATCH_SIZE).map((t) => ({
				...t,
				playlistId
			}));
			const result = await db.insert(tracks).values(batch).onConflictDoNothing();
			inserted += result.rowsAffected;
		}

		const allTrackRows = await db
			.select({ id: tracks.id })
			.from(tracks)
			.where(eq(tracks.playlistId, playlistId));

		const junctionBatch = allTrackRows.map((r) => ({
			playlistId,
			trackId: r.id,
			addedAt: now
		}));

		for (let i = 0; i < junctionBatch.length; i += BATCH_SIZE) {
			await db
				.insert(playlistTracks)
				.values(junctionBatch.slice(i, i + BATCH_SIZE))
				.onConflictDoNothing();
		}

		const countResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(playlistTracks)
			.where(eq(playlistTracks.playlistId, playlistId));

		await db
			.update(playlists)
			.set({ trackCount: countResult[0]?.count ?? inserted })
			.where(eq(playlists.id, playlistId));

		return { success: true, count: inserted, slug };
	}
};
