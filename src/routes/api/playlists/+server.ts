import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { playlists } from '$lib/server/db/schema';

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const name = body.name?.trim();
	const emoji = body.emoji?.trim() || null;
	if (!name) throw error(400, 'Playlist name is required');

	let slug = slugify(name);
	if (!slug) slug = `playlist-${Date.now()}`;

	const existing = await db.query.playlists.findFirst({
		where: (p, { eq }) => eq(p.slug, slug)
	});
	if (existing) slug = `${slug}-${Date.now()}`;

	const [row] = await db
		.insert(playlists)
		.values({
			name,
			slug,
			emoji,
			trackCount: 0,
			createdAt: new Date().toISOString()
		})
		.returning();

	return json(row, { status: 201 });
};
