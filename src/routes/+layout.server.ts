import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { playlists } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

export const load: LayoutServerLoad = async (event) => {
	const allPlaylists = await db
		.select({ id: playlists.id, name: playlists.name, slug: playlists.slug })
		.from(playlists)
		.orderBy(desc(playlists.createdAt));

	return {
		csrfToken: event.locals.csrfToken,
		authenticated: event.locals.authenticated,
		allPlaylists
	};
};
