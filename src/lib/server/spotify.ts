import {
	SPOTIFY_CLIENT_ID,
	SPOTIFY_CLIENT_SECRET,
	SPOTIFY_REDIRECT_URI
} from '$env/dynamic/private';

const SCOPES = 'user-library-read';

export function getSpotifyAuthUrl(state: string): string {
	const params = new URLSearchParams({
		response_type: 'code',
		client_id: SPOTIFY_CLIENT_ID,
		scope: SCOPES,
		redirect_uri: SPOTIFY_REDIRECT_URI,
		state
	});
	return `https://accounts.spotify.com/authorize?${params}`;
}

interface TokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token: string;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
	const res = await fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`
		},
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			redirect_uri: SPOTIFY_REDIRECT_URI
		})
	});

	if (!res.ok) {
		throw new Error(`Spotify token exchange failed: ${res.status}`);
	}

	return res.json();
}

interface SpotifyTrack {
	id: string;
	name: string;
	artists: { name: string }[];
	album: {
		name: string;
		images: { url: string; width: number }[];
	};
	duration_ms: number;
}

interface SavedTrackResponse {
	items: { added_at: string; track: SpotifyTrack }[];
	next: string | null;
	total: number;
}

export interface SpotifyLikedTrack {
	spotifyId: string;
	title: string;
	artist: string;
	album: string;
	albumArt: string | null;
	durationMs: number;
	addedAt: string;
}

export async function fetchAllLikedSongs(
	accessToken: string,
	onProgress?: (fetched: number, total: number) => void
): Promise<SpotifyLikedTrack[]> {
	const tracks: SpotifyLikedTrack[] = [];
	let url: string | null = 'https://api.spotify.com/v1/me/tracks?limit=50';

	while (url) {
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${accessToken}` }
		});

		if (!res.ok) {
			const body = await res.text();
			console.error('Spotify API response:', res.status, body);
			throw new Error(`Spotify API error: ${res.status} — ${body}`);
		}

		const data: SavedTrackResponse = await res.json();

		for (const item of data.items) {
			const t = item.track;
			const art = t.album.images.sort((a, b) => b.width - a.width)[0];
			tracks.push({
				spotifyId: t.id,
				title: t.name,
				artist: t.artists.map((a) => a.name).join(', '),
				album: t.album.name,
				albumArt: art?.url ?? null,
				durationMs: t.duration_ms,
				addedAt: item.added_at
			});
		}

		onProgress?.(tracks.length, data.total);
		url = data.next;
	}

	return tracks;
}
