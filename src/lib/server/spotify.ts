export function extractSpotifyTrackId(input: string): string | null {
	const urlMatch = input.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/);
	if (urlMatch) return urlMatch[1];
	const uriMatch = input.match(/spotify:track:([A-Za-z0-9]+)/);
	if (uriMatch) return uriMatch[1];
	return null;
}

export interface SpotifyTrackMetadata {
	spotifyId: string;
	title: string;
	artist: string;
	albumArt: string;
	durationMs: number | null;
}

async function getSpotifyAccessToken(): Promise<string> {
	const clientId = process.env.SPOTIFY_CLIENT_ID!;
	const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
	const res = await fetch('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
		},
		body: 'grant_type=client_credentials'
	});
	if (!res.ok) throw new Error(`Spotify token failed: ${res.status}`);
	const data = await res.json();
	return data.access_token;
}

export async function fetchSpotifyMetadata(trackId: string): Promise<SpotifyTrackMetadata> {
	const token = await getSpotifyAccessToken();
	const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) throw new Error(`Spotify API failed: ${res.status}`);
	const data = await res.json();
	return {
		spotifyId: trackId,
		title: data.name ?? 'Unknown',
		artist: data.artists?.map((a: { name: string }) => a.name).join(', ') ?? 'Unknown',
		albumArt: data.album?.images?.[0]?.url ?? '',
		durationMs: data.duration_ms ?? null
	};
}
