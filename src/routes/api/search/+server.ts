import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchYouTube } from '$lib/server/youtube';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	if (!query) throw error(400, 'Missing search query');

	const results = await searchYouTube(query, 8);
	return json({ results });
};
