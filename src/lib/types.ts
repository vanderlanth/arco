export interface Playlist {
	id: number;
	name: string;
	slug: string;
	emoji?: string | null;
	trackCount: number;
	createdAt: string;
}

export interface Track {
	id: number;
	spotifyId: string | null;
	title: string;
	artist: string;
	album: string | null;
	albumArt: string | null;
	durationMs: number | null;
	addedAt: string | null;
	youtubeId: string | null;
	playlistId: number | null;
}

export interface YouTubeSearchResult {
	videoId: string;
	title: string;
	artist: string;
	thumbnail: string;
	duration: string;
}

export type RepeatMode = 'off' | 'all' | 'one';
