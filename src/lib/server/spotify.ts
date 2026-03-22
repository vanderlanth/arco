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
}

export async function fetchSpotifyMetadata(trackId: string): Promise<SpotifyTrackMetadata> {
	const res = await fetch(
		`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`
	);
	if (!res.ok) throw new Error(`Spotify oEmbed failed: ${res.status}`);
	const data = await res.json();
	return {
		spotifyId: trackId,
		title: data.title ?? 'Unknown',
		artist: data.author_name ?? 'Unknown',
		albumArt: data.thumbnail_url ?? ''
	};
}
