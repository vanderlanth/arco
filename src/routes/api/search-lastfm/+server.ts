import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchTracks } from '$lib/server/lastfm';

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q');
	if (!q || !q.trim()) throw error(400, 'Missing query');

	try {
		const results = await searchTracks(q.trim());
		return json({ results });
	} catch {
		throw error(502, 'Last.fm search unavailable');
	}
};
