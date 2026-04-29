import { LASTFM_API_KEY } from '$env/static/private';

const BASE = 'https://ws.audioscrobbler.com/2.0/';

export interface SimilarTrack {
	title: string;
	artist: string;
}

export interface LastfmTrackResult {
	title: string;
	artist: string;
	albumArt: string | null;
}

export async function searchTracks(query: string, limit = 8): Promise<LastfmTrackResult[]> {
	const url = new URL(BASE);
	url.searchParams.set('method', 'track.search');
	url.searchParams.set('track', query);
	url.searchParams.set('api_key', LASTFM_API_KEY);
	url.searchParams.set('format', 'json');
	url.searchParams.set('limit', String(limit));

	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Last.fm API error: ${res.status} ${res.statusText}`);
	}

	const data = await res.json();
	const tracks = data?.results?.trackmatches?.track;
	if (!Array.isArray(tracks)) return [];

	return tracks.map((t: { name?: string; artist?: string; image?: { '#text': string; size: string }[] }) => {
		const images = t.image ?? [];
		const pick = (size: string) => images.find((i) => i.size === size)?.['#text'];
		const raw = pick('large') ?? pick('extralarge') ?? pick('medium') ?? '';
		return {
			title: t.name ?? 'Unknown',
			artist: t.artist ?? 'Unknown',
			albumArt: raw || null
		};
	});
}

export interface LastfmArtistResult {
	name: string;
	imageUrl: string | null;
	listeners: string | null;
}

export interface LastfmAlbumResult {
	name: string;
	artist: string;
	imageUrl: string | null;
}

export async function searchArtists(query: string, limit = 10): Promise<LastfmArtistResult[]> {
	const url = new URL(BASE);
	url.searchParams.set('method', 'artist.search');
	url.searchParams.set('artist', query);
	url.searchParams.set('api_key', LASTFM_API_KEY);
	url.searchParams.set('format', 'json');
	url.searchParams.set('limit', String(limit));

	const res = await fetch(url);
	if (!res.ok) throw new Error(`Last.fm API error: ${res.status} ${res.statusText}`);

	const data = await res.json();
	const artists = data?.results?.artistmatches?.artist;
	if (!Array.isArray(artists)) return [];

	return artists.map((a: { name?: string; listeners?: string; image?: { '#text': string; size: string }[] }) => {
		const images = a.image ?? [];
		const pick = (size: string) => images.find((i) => i.size === size)?.['#text'];
		const raw = pick('large') ?? pick('extralarge') ?? pick('medium') ?? '';
		return {
			name: a.name ?? 'Unknown',
			imageUrl: raw || null,
			listeners: a.listeners ?? null
		};
	});
}

export async function searchAlbums(query: string, limit = 10): Promise<LastfmAlbumResult[]> {
	const url = new URL(BASE);
	url.searchParams.set('method', 'album.search');
	url.searchParams.set('album', query);
	url.searchParams.set('api_key', LASTFM_API_KEY);
	url.searchParams.set('format', 'json');
	url.searchParams.set('limit', String(limit));

	const res = await fetch(url);
	if (!res.ok) throw new Error(`Last.fm API error: ${res.status} ${res.statusText}`);

	const data = await res.json();
	const albums = data?.results?.albummatches?.album;
	if (!Array.isArray(albums)) return [];

	return albums.map((a: { name?: string; artist?: string; image?: { '#text': string; size: string }[] }) => {
		const images = a.image ?? [];
		const pick = (size: string) => images.find((i) => i.size === size)?.['#text'];
		const raw = pick('large') ?? pick('extralarge') ?? pick('medium') ?? '';
		return {
			name: a.name ?? 'Unknown',
			artist: a.artist ?? 'Unknown',
			imageUrl: raw || null
		};
	});
}

export async function getSimilarTracks(
	artist: string,
	track: string,
	limit = 20
): Promise<SimilarTrack[]> {
	const url = new URL(BASE);
	url.searchParams.set('method', 'track.getsimilar');
	url.searchParams.set('artist', artist);
	url.searchParams.set('track', track);
	url.searchParams.set('api_key', LASTFM_API_KEY);
	url.searchParams.set('format', 'json');
	url.searchParams.set('limit', String(limit));

	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Last.fm API error: ${res.status} ${res.statusText}`);
	}

	const data = await res.json();
	const similar = data?.similartracks?.track;
	if (!Array.isArray(similar)) return [];

	return similar.map((t: { name?: string; artist?: { name?: string } }) => ({
		title: t.name ?? 'Unknown',
		artist: t.artist?.name ?? 'Unknown'
	}));
}
