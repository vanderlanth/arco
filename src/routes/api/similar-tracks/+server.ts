import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Track } from '$lib/types';
import { getSimilarTracks } from '$lib/server/lastfm';

export const GET: RequestHandler = async ({ url }) => {
	const artist = url.searchParams.get('artist');
	const track = url.searchParams.get('track');
	if (!artist || !track) throw error(400, 'Missing artist or track');

	const primaryArtist = artist.split(',')[0].trim();

	let similar = await getSimilarTracks(primaryArtist, track);

	if (similar.length === 0) {
		const cleanTrack = track
			.replace(/\s*[\(\[].*?[\)\]]$/g, '')
			.replace(/\s*-\s*(Remaster|Live|Remix|Deluxe|Bonus|feat\.).*$/i, '')
			.trim();
		if (cleanTrack !== track) {
			similar = await getSimilarTracks(primaryArtist, cleanTrack);
		}
	}

	if (similar.length === 0) {
		throw error(404, `No similar tracks found for "${primaryArtist} — ${track}"`);
	}

	const tracks: Track[] = similar.map((t, i) => ({
		id: -(i + 2),
		spotifyId: null,
		title: t.title,
		artist: t.artist,
		album: null,
		albumArt: null,
		durationMs: null,
		addedAt: null,
		youtubeId: null,
		playlistId: null
	}));

	return json({ tracks });
};
