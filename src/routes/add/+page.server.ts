import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { playlists } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url }) => {
	const rawUrl = url.searchParams.get('url') ?? url.searchParams.get('text') ?? '';
	const allPlaylists = await db
		.select({ id: playlists.id, name: playlists.name, slug: playlists.slug })
		.from(playlists)
		.orderBy(desc(playlists.createdAt));
	return { rawUrl, playlists: allPlaylists };
};
