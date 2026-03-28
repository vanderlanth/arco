import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { playlists, playlistTracks } from '$lib/server/db/schema';
import { eq, and, ne } from 'drizzle-orm';

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

export const PATCH: RequestHandler = async ({ params, request }) => {
	const id = Number(params.id);
	if (!id) throw error(400, 'Invalid playlist id');

	const body = await request.json();
	const name = body.name?.trim();
	const emoji = body.emoji?.trim() || null;
	if (!name) throw error(400, 'Playlist name is required');

	let slug = slugify(name);
	if (!slug) slug = `playlist-${Date.now()}`;

	const existing = await db.query.playlists.findFirst({
		where: (p, { eq: eqFn, and: andFn, ne: neFn }) =>
			andFn(eqFn(p.slug, slug), neFn(p.id, id))
	});
	if (existing) slug = `${slug}-${Date.now()}`;

	const [updated] = await db
		.update(playlists)
		.set({ name, slug, emoji })
		.where(eq(playlists.id, id))
		.returning();

	if (!updated) throw error(404, 'Playlist not found');
	return json(updated);
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (!id) throw error(400, 'Invalid playlist id');

	await db.delete(playlistTracks).where(eq(playlistTracks.playlistId, id));
	const deleted = await db.delete(playlists).where(eq(playlists.id, id)).returning();

	if (!deleted.length) throw error(404, 'Playlist not found');
	return json({ ok: true });
};
